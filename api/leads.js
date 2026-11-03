import { createHash } from 'node:crypto';

const allowedAreas = new Set(['Direito Criminal','Direito Empresarial','Direito Civil','Direito do Trabalho','Família e Sucessões','Direito Tributário','Direito Previdenciário','Outra / Não sei identificar']);
const allowedUrgency = new Set(['routine','priority','urgent']);
const json = (res, status, payload) => { res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store'); return res.status(status).json(payload); };

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return json(res,405,{error:'Método não permitido.'}); }
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.toLowerCase().includes('application/json')) return json(res,415,{error:'Formato de envio não suportado.'});
  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > 8192) return json(res,413,{error:'Solicitação muito grande.'});
  const origin = req.headers.origin;
  const configuredOrigin = process.env.PUBLIC_SITE_URL;
  if (configuredOrigin && origin && new URL(configuredOrigin).origin !== origin) return json(res,403,{error:'Origem não autorizada.'});
  if (!origin && process.env.VERCEL_ENV === 'production') return json(res,403,{error:'Origem não autorizada.'});
  const body = typeof req.body === 'string' ? (()=>{try{return JSON.parse(req.body)}catch{return null}})() : req.body;
  if (!body || typeof body !== 'object') return json(res,400,{error:'Dados inválidos.'});
  if (body.website) return json(res,202,{ok:true});
  const requestId = String(body.request_id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return json(res,400,{error:'Identificador da solicitação inválido. Atualize a página e tente novamente.'});
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const area = String(body.practice_area || '');
  const urgency = String(body.urgency || '');
  if (body.consent !== true) return json(res,400,{error:'É necessário autorizar o tratamento dos dados para retorno.'});
  if (name.length < 2 || name.length > 100) return json(res,400,{error:'Informe um nome válido.'});
  const digits = phone.replace(/\D/g,'');
  if (digits.length < 10 || digits.length > 13 || phone.length > 25) return json(res,400,{error:'Informe um telefone válido com DDD.'});
  if (email && (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json(res,400,{error:'Informe um e-mail válido.'});
  if (!allowedAreas.has(area) || !allowedUrgency.has(urgency)) return json(res,400,{error:'Selecione uma área e uma natureza de contato válidas.'});

  const supabaseUrl = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hashSecret = process.env.LEAD_HASH_SECRET;
  if (!supabaseUrl || !secret || !hashSecret) return json(res,503,{error:'O canal de atendimento está temporariamente indisponível. Utilize o telefone institucional.'});
  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  const ipHash = createHash('sha256').update(`${hashSecret}:${ip}`).digest('hex');
  try {
    const headers = {'Content-Type':'application/json','apikey':secret};
    // New sb_secret keys are opaque API keys, not JWTs: send only via apikey.
    // Legacy service_role keys are JWTs and still require the Bearer header.
    if (!secret.startsWith('sb_secret_')) headers.Authorization = `Bearer ${secret}`;
    const response = await fetch(`${supabaseUrl.replace(/\/$/,'')}/rest/v1/rpc/create_public_lead`, {
      method:'POST', headers,
      body:JSON.stringify({p_request_id:requestId,p_name:name,p_phone:phone,p_email:email||null,p_practice_area:area,p_urgency:urgency,p_ip_hash:ipHash}), signal:AbortSignal.timeout(8000)
    });
    const text = await response.text();
    if (!response.ok) {
      if (text.includes('rate_limited')) return json(res,429,{error:'Muitas solicitações em pouco tempo. Tente novamente mais tarde.'});
      return json(res,503,{error:'Não foi possível registrar a solicitação. Utilize o telefone institucional.'});
    }
    return json(res,201,{ok:true,reference:text.replaceAll('"','')});
  } catch (error) {
    return json(res,503,{error:'Falha temporária de comunicação. Utilize o telefone institucional.'});
  }
}
