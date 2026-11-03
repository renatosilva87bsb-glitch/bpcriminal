import crypto from 'node:crypto';
import calendarHandler from './google-calendar.js';

const json = (res, status, payload) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); return res.status(status).json(payload); };
const siteUrl = () => String(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
const redirectUri = () => `${siteUrl()}/api/google/oauth/callback`;
const cookie = (value, maxAge) => `bp_google_oauth_state=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax; Secure`;

export default async function handler(req, res) {
  if (String(req.headers?.cookie || '').includes('bp_google_calendar_state=')) return calendarHandler(req, res);
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return json(res, 405, { error: 'Método não permitido.' }); }
  const url = new URL(req.url || '/', 'http://localhost');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!siteUrl() || !clientId || !clientSecret || !supabaseUrl || !publishableKey) return json(res, 503, { error: 'Google OAuth ainda não foi configurado.' });

  if (url.pathname.endsWith('/start')) {
    const state = crypto.randomBytes(32).toString('base64url');
    res.setHeader('Set-Cookie', cookie(state, 600));
    const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorize.searchParams.set('client_id', clientId);
    authorize.searchParams.set('redirect_uri', redirectUri());
    authorize.searchParams.set('response_type', 'code');
    authorize.searchParams.set('scope', 'openid email profile');
    authorize.searchParams.set('state', state);
    authorize.searchParams.set('access_type', 'offline');
    authorize.searchParams.set('prompt', 'select_account');
    res.statusCode = 302; res.setHeader('Location', authorize.toString()); return res.end();
  }

  if (url.searchParams.get('error')) return json(res, 400, { error: 'Autorização Google cancelada ou recusada.' });
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookies = String(req.headers?.cookie || '');
  const expected = cookies.match(/(?:^|;\s*)bp_google_oauth_state=([^;]+)/)?.[1] || '';
  if (!code || !state || !expected || state.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expected))) return json(res, 400, { error: 'Estado OAuth inválido ou expirado.' });

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri(), grant_type: 'authorization_code' }), signal: AbortSignal.timeout(10000) });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.id_token) return json(res, 502, { error: 'Não foi possível concluir a autorização Google.' });
    const sessionResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=id_token`, { method: 'POST', headers: { apikey: publishableKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'google', id_token: tokens.id_token, access_token: tokens.access_token }), signal: AbortSignal.timeout(10000) });
    const session = await sessionResponse.json();
    if (!sessionResponse.ok || !session.access_token || !session.refresh_token) return json(res, 502, { error: 'Google autorizou, mas o Supabase não criou a sessão.' });
    res.setHeader('Set-Cookie', cookie('', 0));
    const destination = new URL('/admin/', siteUrl());
    destination.hash = new URLSearchParams({ access_token: session.access_token, refresh_token: session.refresh_token, type: 'bearer' }).toString();
    res.statusCode = 302; res.setHeader('Cache-Control', 'no-store'); res.setHeader('Location', destination.toString()); return res.end();
  } catch { return json(res, 502, { error: 'Falha segura ao concluir o login Google.' }); }
}
