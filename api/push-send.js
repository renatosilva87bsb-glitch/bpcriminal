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
    const selected=String(req.headers['x-bp-tenant-id']||'');if(selected&&!/^[0-9a-f-]{36}$/i.test(selected))return json(res,400,{error:'Escritório inválido.'});
    const memberships=await fetch(`${url.replace(/\/$/,'')}/rest/v1/tenant_members?select=tenant_id,role&user_id=eq.${encodeURIComponent(user.id)}${selected?'&tenant_id=eq.'+encodeURIComponent(selected):''}&order=created_at.asc&limit=2`,{headers,signal:AbortSignal.timeout(7000)});
    if(!memberships.ok) return json(res,503,{error:'Falha ao validar permissões.'});
    const memberRows=await memberships.json();if(memberRows.length>1&&!selected)return json(res,409,{error:'Selecione o escritório no painel.'});const member=memberRows[0]; if(!member) return json(res,403,{error:'Apenas proprietários e administradores podem enviar notificações.'});
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    const selfTest=body?.type==='test';
    if(!selfTest&&!['owner','admin'].includes(member.role))return json(res,403,{error:'Envio institucional restrito ao administrador.'});
    const title='B&P Advocacia', message=selfTest?'Notificações ativadas. Este é um teste do seu dispositivo.':'Há uma atualização operacional. Consulte o CRM seguro do escritório.';
    const path=String(body?.url||'/'); if(!path.startsWith('/')||path.startsWith('//')) return json(res,400,{error:'Destino inválido.'});
    webpush.setVapidDetails(subject,pub,priv);
    const list=await fetch(`${url.replace(/\/$/,'')}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth_secret&tenant_id=eq.${member.tenant_id}${selfTest?'&user_id=eq.'+encodeURIComponent(user.id):''}&limit=100`,{headers,signal:AbortSignal.timeout(7000)});
    if(!list.ok) return json(res,503,{error:'Não foi possível consultar as inscrições.'});
    const subscriptions=await list.json(); let sent=0, expired=0;
    await Promise.all(subscriptions.map(async s=>{try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth_secret}},JSON.stringify({title,body:message,url:path}),{TTL:60});sent++;}catch(e){if(e.statusCode===404||e.statusCode===410){expired++;await fetch(`${url.replace(/\/$/,'')}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`,{method:'DELETE',headers});}}}));
    return json(res,200,{ok:true,sent,expired});
  } catch { return json(res,503,{error:'Falha ao enviar notificações.'}); }
}
