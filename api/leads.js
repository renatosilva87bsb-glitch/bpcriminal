import { createHmac } from 'node:crypto';
import { json, supabaseFetch, serviceKey } from './_auth.js';

const allowedAreas = new Set(['Direito Criminal','Direito Empresarial','Direito Civil','Direito do Trabalho','Família e Sucessões','Direito Tributário','Direito Previdenciário','Outra / Não sei identificar']);
const allowedUrgency = new Set(['routine','priority','urgent']);

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Método não permitido.' }); }
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) return json(res, 415, { error: 'Formato de envio não suportado.' });
  if (Number(req.headers['content-length'] || 0) > 8192) return json(res, 413, { error: 'Solicitação muito grande.' });
  const configuredOrigin = process.env.PUBLIC_SITE_URL;
  const origin = req.headers.origin;
  if (configuredOrigin && origin && new URL(configuredOrigin).origin !== origin) return json(res, 403, { error: 'Origem não autorizada.' });
  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return null; } })() : req.body;
  if (!body || typeof body !== 'object') return json(res, 400, { error: 'Dados inválidos.' });
  if (body.website) return json(res, 202, { ok: true });
  const requestId = String(body.request_id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return json(res, 400, { error: 'Identificador da solicitação inválido. Atualize a página e tente novamente.' });
  const fullName = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const leadSource = 'site';
  const leadUrgency = String(body.urgency || '');
  const practiceArea = String(body.practice_area || '');
  if (body.consent !== true) return json(res, 400, { error: 'É necessário autorizar o tratamento dos dados para retorno.' });
  if (fullName.length < 2 || fullName.length > 160) return json(res, 400, { error: 'Informe um nome válido.' });
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13 || phone.length > 25) return json(res, 400, { error: 'Informe um telefone válido com DDD.' });
  if (email && (email.length > 160 || !/^\S+@\S+\.\S+$/.test(email))) return json(res, 400, { error: 'Informe um e-mail válido.' });
  if (!allowedAreas.has(practiceArea) || !allowedUrgency.has(leadUrgency)) return json(res, 400, { error: 'Selecione uma área e uma natureza de contato válidas.' });

  try {
    let tenantId = process.env.PUBLIC_LEAD_TENANT_ID || '';
    if(!tenantId){const tenants=await supabaseFetch('tenants?select=id&limit=2');if(!tenants.response.ok||!Array.isArray(tenants.data)||tenants.data.length!==1)return json(res,503,{error:'Triagem indisponível. Utilize o telefone institucional.'});tenantId=tenants.data[0].id;}
    const existing = await supabaseFetch(`customers?select=id&tenant_id=eq.${encodeURIComponent(tenantId)}&lead_request_id=eq.${encodeURIComponent(requestId)}&limit=1`);
    if (Array.isArray(existing.data) && existing.data[0]?.id) return json(res, 200, { ok: true, reference: existing.data[0].id });
    const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    const bucket=createHmac('sha256',process.env.LEAD_HASH_SECRET||serviceKey()).update(ip).digest('hex');
    const limited=await supabaseFetch('rpc/consume_public_lead_limit',{method:'POST',body:JSON.stringify({p_bucket:bucket})});
    if(!limited.response.ok)return json(res,503,{error:'Controle de envio temporariamente indisponível.'});
    if(limited.data!==true)return json(res,429,{error:'Muitas solicitações. Aguarde um minuto ou utilize o telefone institucional.'});
    const customer = {
      tenant_id: tenantId,
      full_name: fullName,
      phone_e164: `+${digits.length<=11?'55':''}${digits}`,
      email: email || null,
      status: 'lead',
      consent_status: 'opted_in',
      lead_source: leadSource,
      lead_urgency: leadUrgency,
      lead_practice_area: practiceArea,
      lead_request_id: requestId,
      notes: `Área informada: ${practiceArea}. Primeiro contato pelo site; não solicitar documentos sigilosos neste canal.`
    };
    const created = await supabaseFetch('customers', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(customer) });
    if(created.response.status===409){const duplicate=await supabaseFetch(`customers?select=id&tenant_id=eq.${encodeURIComponent(tenantId)}&lead_request_id=eq.${encodeURIComponent(requestId)}&limit=1`);if(duplicate.data?.[0])return json(res,200,{ok:true,reference:duplicate.data[0].id});}
    if (!created.response.ok) return json(res, 503, { error: 'Não foi possível registrar a solicitação. Utilize o telefone institucional.' });
    const row = Array.isArray(created.data) ? created.data[0] : created.data;
    return json(res, 201, { ok: true, reference: row?.id || requestId });
  } catch {
    return json(res, 503, { error: 'Falha temporária de comunicação. Utilize o telefone institucional.' });
  }
}
