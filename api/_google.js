import crypto from 'node:crypto';
import { supabaseFetch } from './_auth.js';

export const SCOPES = {
  calendar: 'https://www.googleapis.com/auth/calendar.events',
  drive: 'https://www.googleapis.com/auth/drive.file',
  contacts: 'https://www.googleapis.com/auth/contacts'
};
export const site = () => String(process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
export const redirectUri = () => `${site()}/api/google/oauth/callback`;
export const secret = () => process.env.GOOGLE_CLIENT_SECRET || '';
export const clientId = () => process.env.GOOGLE_CLIENT_ID || '';
export const calendarCookie = (value, age) => `bp_google_calendar_state=${value}; Max-Age=${age}; Path=/; HttpOnly; SameSite=None; Secure`;

export function signedState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}
export function readState(value) {
  try {
    const [body, signature] = String(value || '').split('.');
    const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
    if (!signature || Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const state = JSON.parse(Buffer.from(body, 'base64url').toString());
    return state.exp > Date.now() && typeof state.nonce === 'string' ? state : null;
  } catch { return null; }
}
const encryptionKey = () => crypto.createHash('sha256').update(secret()).digest();
export function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}
export function decrypt(value) {
  const [iv, tag, data] = String(value).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString();
}
export async function db(path, options = {}) {
  const result = await supabaseFetch(path, options);
  if (!result.response.ok) throw new Error('database_unavailable');
  return result.data;
}
export async function exchangeToken(params) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), client_secret: secret(), ...params }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error === 'invalid_grant' ? 'google_reconnect' : 'google_token');
  return data;
}
export async function google(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options, headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) },
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 403 ? 'google_permission' : response.status === 401 ? 'google_reconnect' : 'google_request');
    error.status = response.status;
    throw error;
  }
  return data;
}
export async function connectionFor(auth) {
  const rows = await db(`google_calendar_connections?select=id,google_email,calendar_id,refresh_token_ciphertext,token_scope,drive_folder_id&user_id=eq.${encodeURIComponent(auth.user.id)}&tenant_id=eq.${encodeURIComponent(auth.member.tenant_id)}&limit=1`);
  return rows?.[0] || null;
}
export function hasScope(connection, name) {
  return String(connection?.token_scope || '').split(' ').includes(SCOPES[name]);
}
export async function accessToken(connection) {
  const tokens = await exchangeToken({ grant_type: 'refresh_token', refresh_token: decrypt(connection.refresh_token_ciphertext) });
  return tokens.access_token;
}
