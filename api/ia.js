import { createHash } from 'node:crypto';
import { bearerHeaders, json, requireTenantMember, serviceKey, supabaseBase, supabaseFetch } from './_auth.js';
import { getNews } from './news.js';

const MODE_INSTRUCTIONS = {
  triage: 'Classifique a solicitação em prioridade operacional e sugira apenas os próximos passos internos de triagem. Não dê orientação jurídica ao cliente, não conclua mérito e não prometa resultado.',
  summary: 'Resuma o texto fornecido em tópicos factuais, separando fatos informados, lacunas e perguntas para o advogado responsável. Não invente fatos, leis, prazos ou jurisprudência.',
  deadline_plan: 'Converta as informações fornecidas em uma lista de tarefas internas e perguntas de conferência. Não determine prazo jurídico sem validação humana e não substitua consulta ao processo oficial.',
  internal_draft: 'Crie um rascunho interno de comunicação ou nota, em linguagem sóbria, objetiva e sem promessa de resultado. Marque claramente pontos que precisam de revisão humana.',
  petition_review: 'Revise a estrutura de uma petição sanitizada. Aponte clareza, coerência entre fatos e pedidos, requisitos formais a conferir, fundamentos que precisam de fonte oficial, riscos de afirmações sem prova e sugestões de melhoria. Não reescreva como peça pronta, não invente jurisprudência e não faça avaliação definitiva do mérito.',
  contract_review: 'Revise um contrato sanitizado. Liste cláusulas ambíguas, lacunas, obrigações, prazos, condições de rescisão, responsabilidade, proteção de dados e pontos que exigem negociação ou conferência normativa. Sugira redações alternativas apenas como rascunho interno e sinalize cada ponto para revisão humana.',
  legal_update: 'Produza um boletim interno de atualização jurídica a partir do texto e das fontes oficiais fornecidas. Separe fatos da fonte, hipótese de impacto, pontos que exigem leitura do texto integral, vigência, transição e confirmação pelo advogado. Nunca trate título de notícia como lei vigente.'
};
const sensitivePatterns = [
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, // CPF
  /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/, // CNJ
  /\b\+?\d[\d\s().-]{8,}\d\b/, // telefone
  /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/, // e-mail
  /\b(?:senha|password|token|chave\s+privada|seed|cart[aã]o)\b/i,
  /\b(?:rg|cpf|documento\s+pessoal|documentos?\s+anexad)\b/i
];
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const containsSensitive = text => sensitivePatterns.some(pattern => pattern.test(text));

async function officialContext() {
  const fallback = [
    'Planalto — Portal da Legislação: https://www4.planalto.gov.br/legislacao',
    'LexML — pesquisa legislativa e jurídica: https://www.lexml.gov.br/',
    'STF — jurisprudência e legislação anotada: https://portal.stf.jus.br/jurisprudencia/',
    'STJ — RSS de notícias e jurisprudência: https://www.stj.jus.br/sites/portalp/Paginas/RSS.aspx',
    'CNJ — API Pública DataJud: https://www.cnj.jus.br/sistemas/datajud/api-publica/'
  ];
  try {
    const news = await getNews();
    const live = news.items.slice(0, 8).map(item => `- ${item.source}: ${item.title} — ${item.url}`);
    return [...fallback, ...live].join('\n');
  } catch {
    return fallback.join('\n');
  }
}

async function writeAudit(tenantId, actorId, action, metadata) {
  try {
    await supabaseFetch('audit_events', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ tenant_id: tenantId, actor_id: actorId, action, resource_type: 'legal_ai', metadata }) });
  } catch { /* auditoria não deve vazar dados nem impedir resposta já concluída */ }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Método não permitido.' }); }
  const auth = await requireTenantMember(req, ['owner', 'admin', 'manager', 'agent']);
  if (auth.error) return json(res, auth.status, { error: auth.error });
  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return null; } })() : req.body;
  const mode = String(body?.mode || '');
  const input = String(body?.input || '').trim();
  if (!MODE_INSTRUCTIONS[mode] || input.length < 10 || input.length > 12000) return json(res, 400, { error: 'Informe uma tarefa e um texto interno dentro do limite permitido.' });
  if (containsSensitive(input)) return json(res, 422, { error: 'Remova CPF, processo, telefone, e-mail, senha, documento ou outro dado pessoal antes de usar a IA.' });
  const base = supabaseBase();
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const apiKey = process.env.GEMINI_API_KEY;
  if (!base || !apiKey || !serviceKey()) return json(res, 503, { error: 'A IA interna ainda não foi configurada no ambiente seguro.' });
  const started = Date.now();
  const inputHash = hash(input);
  try {
    const limitResponse = await fetch(`${base}/rest/v1/rpc/consume_ai_rate_limit`, { method: 'POST', headers: { ...bearerHeaders(auth.token), Prefer: 'return=representation' }, body: JSON.stringify({ p_tenant_id: auth.member.tenant_id, p_limit: 20 }), signal: AbortSignal.timeout(8000) });
    const limitText = await limitResponse.text();
    if (!limitResponse.ok) return json(res, 503, { error: 'O controle de uso da IA está indisponível. Solicite a verificação do administrador.' });
    if (limitText === 'false') {
      await writeAudit(auth.member.tenant_id, auth.user.id, 'ai_rate_limited', { mode, model });
      return json(res, 429, { error: 'Limite de uso da IA atingido. Tente novamente em alguns minutos.' });
    }
    const sourceContext = ['petition_review', 'contract_review', 'legal_update'].includes(mode)
      ? await officialContext()
      : 'Use somente o texto fornecido e não faça afirmações jurídicas atuais sem conferência humana.';
    const prompt = [
      'Você é um assistente interno de um escritório de advocacia brasileiro.',
      'Seu trabalho é apoiar a equipe, nunca atender o público, substituir o advogado ou decidir estratégia jurídica.',
      'Não invente legislação, jurisprudência, prazos, fatos ou resultados.',
      'Não peça nem repita dados pessoais. A resposta deve ser um rascunho interno, com revisão humana obrigatória.',
      'Quando houver fontes abaixo, use-as somente como pistas verificáveis: cite o órgão e o link, diferencie notícia de norma, confira texto integral, vigência, alterações, vetos, transição e contexto antes de qualquer uso.',
      MODE_INSTRUCTIONS[mode],
      '',
      'TEXTO INTERNO (já sanitizado pelo advogado):',
      input,
      '',
      'FONTES PÚBLICAS OFICIAIS PARA CONFERÊNCIA:',
      sourceContext
    ].join('\n');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.15, maxOutputTokens: 1800 } }),
      signal: AbortSignal.timeout(30000)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(response.status === 429 ? 'provider_limit' : response.status === 404 ? 'provider_model' : 'model_error');
    const output = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!output) throw new Error('empty_output');
    const latency = Date.now() - started;
    await supabaseFetch('legal_ai_runs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ tenant_id: auth.member.tenant_id, actor_id: auth.user.id, mode, model, input_sha256: inputHash, output_sha256: hash(output), status: 'completed', latency_ms: latency, human_review_required: true }) });
    await writeAudit(auth.member.tenant_id, auth.user.id, 'ai_completed', { mode, model, latency_ms: latency, human_review_required: true });
    return json(res, 200, { ok: true, output, review_required: true, model });
  } catch (error) {
    const latency = Date.now() - started;
    await supabaseFetch('legal_ai_runs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ tenant_id: auth.member.tenant_id, actor_id: auth.user.id, mode, model, input_sha256: inputHash, status: 'failed', latency_ms: latency, human_review_required: true }) }).catch(() => {});
    await writeAudit(auth.member.tenant_id, auth.user.id, 'ai_failed', { mode, model });
    return json(res, 503, { error: error.message === 'provider_limit' ? 'Cota do provedor de IA atingida. Confira os limites e a cobrança no Google AI Studio.' : error.message === 'provider_model' ? 'O modelo de IA configurado está indisponível. Solicite atualização ao administrador.' : 'Não foi possível gerar o rascunho interno. Nenhum dado foi armazenado como prompt ou resposta.' });
  }
}
