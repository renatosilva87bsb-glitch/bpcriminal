const json = (res, status, payload) => { res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store'); return res.status(status).json(payload); };
async function authUser(token, url, key) {
  const response = await fetch(`${url.replace(/\/$/,'')}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(7000) });
  if (!response.ok) return null;
  return response.json();
}
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return json(res,405,{error:'Método não permitido.'}); }
  const origin = req.headers.origin; if (process.env.PUBLIC_SITE_URL && origin && origin !== new URL(process.env.PUBLIC_SITE_URL).origin) return json(res,403,{error:'Origem não autorizada.'});
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!url || !key || !secret || !token) return json(res,503,{error:'Notificações ainda não configuradas.'});
  try {
    const user = await authUser(token,url,key);
    if (!user?.id) return json(res,401,{error:'Sessão inválida.'});
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const sub = body?.subscription;
    if (!sub?.endpoint || typeof sub.endpoint !== 'string' || sub.endpoint.length > 2048 || !sub.keys?.p256dh || !sub.keys?.auth) return json(res,400,{error:'Inscrição push inválida.'});
    let endpoint;try{endpoint=new URL(sub.endpoint);}catch{return json(res,400,{error:'Endpoint push inválido.'});}
    const permitted=['fcm.googleapis.com','updates.push.services.mozilla.com','push.services.mozilla.com','web.push.apple.com','notify.windows.com','notification.windows.com'];
    if(endpoint.protocol!=='https:'||endpoint.port||endpoint.username||endpoint.password||!permitted.some(host=>endpoint.hostname===host||endpoint.hostname.endsWith('.'+host)))return json(res,400,{error:'Provedor push não permitido.'});
    const headers = { apikey: secret, Authorization: secret.startsWith('sb_secret_') ? undefined : `Bearer ${secret}`, 'Content-Type':'application/json' };
    if (!headers.Authorization) delete headers.Authorization;
    const selected=String(req.headers['x-bp-tenant-id']||'');if(selected&&!/^[0-9a-f-]{36}$/i.test(selected))return json(res,400,{error:'Escritório inválido.'});
    const membershipResponse = await fetch(`${url.replace(/\/$/,'')}/rest/v1/tenant_members?select=tenant_id&user_id=eq.${encodeURIComponent(user.id)}${selected?'&tenant_id=eq.'+encodeURIComponent(selected):''}&order=created_at.asc&limit=2`, {headers,signal:AbortSignal.timeout(7000)});
    if (!membershipResponse.ok) return json(res,503,{error:'Não foi possível validar o vínculo institucional.'});
    const memberships = await membershipResponse.json();
    if(memberships.length>1&&!selected)return json(res,409,{error:'Selecione o escritório no painel.'});
    if (!memberships.length) return json(res,403,{error:'Usuário sem vínculo ativo com o escritório.'});
    const saved = await fetch(`${url.replace(/\/$/,'')}/rest/v1/push_subscriptions?on_conflict=endpoint`, {method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({tenant_id:memberships[0].tenant_id,user_id:user.id,endpoint:sub.endpoint,p256dh:sub.keys.p256dh,auth_secret:sub.keys.auth,updated_at:new Date().toISOString()}),signal:AbortSignal.timeout(7000)});
    if (!saved.ok) return json(res,503,{error:'Não foi possível salvar a inscrição de notificações.'});
    return json(res,201,{ok:true});
  } catch { return json(res,400,{error:'Solicitação de inscrição inválida.'}); }
}
