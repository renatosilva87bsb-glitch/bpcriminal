const supabaseBase = () => String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const publicKey = () => process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function json(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(payload);
}

export async function supabaseFetch(path, options = {}) {
  const url = supabaseBase();
  const key = options.key || serviceKey();
  if (!url || !key) throw new Error('supabase_not_configured');
  const headers = { apikey: key, 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (!headers.Authorization && key && !String(key).startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(`${url}/rest/v1/${path}`, { ...options, headers, signal: options.signal || AbortSignal.timeout(8000) });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data };
}

export async function requireTenantMember(req, roles = []) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const url = supabaseBase();
  const key = publicKey();
  if (!token || !url || !key) return { error: 'unauthorized', status: 401 };
  const authResponse = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  if (!authResponse.ok) return { error: 'unauthorized', status: 401 };
  const user = await authResponse.json();
  const selected=String(req.headers['x-bp-tenant-id']||'');
  if(selected&&!/^[0-9a-f-]{36}$/i.test(selected))return {error:'invalid_office',status:400};
  const membership = await supabaseFetch(`tenant_members?select=tenant_id,role&user_id=eq.${encodeURIComponent(user.id)}${selected?'&tenant_id=eq.'+encodeURIComponent(selected):''}&order=created_at.asc&limit=2`);
  if(Array.isArray(membership.data)&&membership.data.length>1&&!selected)return {error:'Selecione o escritório no painel.',status:409};
  const member = Array.isArray(membership.data) ? membership.data[0] : null;
  if (!member || (roles.length && !roles.includes(member.role))) return { error: 'forbidden', status: 403 };
  return { token, user, member };
}

export function bearerHeaders(token) {
  const key = publicKey();
  return { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export { supabaseBase, publicKey, serviceKey };
