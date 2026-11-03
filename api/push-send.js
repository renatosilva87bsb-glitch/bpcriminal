import webpush from 'web-push';
const json = (res, status, payload) => { res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store'); return res.status(status).json(payload); };
export default async function handler(req,res) {
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return json(res,405,{error:'Método não permitido.'}); }
  const origin = req.headers.origin; if (process.env.PUBLIC_SITE_URL && origin && origin !== new URL(process.env.PUBLIC_SITE_URL).origin) return json(res,403,{error:'Origem não autorizada.'});
  const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY, secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pub=process.env.VAPID_PUBLIC_KEY, priv=process.env.VAPID_PRIVATE_KEY, subject=process.env.VAPID_SUBJECT;
  const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
  if (!url||!key||!secret||!pub||!priv||!subject||!token) return json(res,503,{error:'Serviço de notificações ainda não configurado.'});
  try {
    const auth=await fetch(`${url.replace(/\/$/,'')}/auth/v1/user`,{headers:{apikey:key,Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(7000)});
    if (!auth.ok) return json(res,401,{error:'Sessão inválida.'});
    const user=await auth.json();
    const headers={apikey:secret,'Content-Type':'application/json'}; if(!secret.startsWith('sb_secret_')) headers.Authorization=`Bearer ${secret}`;
    const memberships=await fetch(`${url.replace(/\/$/,'')}/rest/v1/firm_memberships?select=firm_id,role&user_id=eq.${encodeURIComponent(user.id)}&is_active=eq.true&limit=1`,{headers,signal:AbortSignal.timeout(7000)});
    if(!memberships.ok) return json(res,503,{error:'Falha ao validar permissões.'});
    const member=(await memberships.json())[0]; if(!member||!['owner','admin'].includes(member.role)) return json(res,403,{error:'Apenas proprietários e administradores podem enviar notificações.'});
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    const title=String(body?.title||'B&P Advocacia').trim().slice(0,80), message=String(body?.body||'Você tem uma nova notificação institucional.').trim().slice(0,180);
    const path=String(body?.url||'/'); if(!path.startsWith('/')||path.startsWith('//')) return json(res,400,{error:'Destino inválido.'});
    webpush.setVapidDetails(subject,pub,priv);
    const list=await fetch(`${url.replace(/\/$/,'')}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth_secret&firm_id=eq.${member.firm_id}`,{headers,signal:AbortSignal.timeout(7000)});
    if(!list.ok) return json(res,503,{error:'Não foi possível consultar as inscrições.'});
    const subscriptions=await list.json(); let sent=0, expired=0;
    await Promise.all(subscriptions.map(async s=>{try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth_secret}},JSON.stringify({title,body:message,url:path}),{TTL:60});sent++;}catch(e){if(e.statusCode===404||e.statusCode===410){expired++;await fetch(`${url.replace(/\/$/,'')}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`,{method:'DELETE',headers});}}}));
    return json(res,200,{ok:true,sent,expired});
  } catch { return json(res,503,{error:'Falha ao enviar notificações.'}); }
}
