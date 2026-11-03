import crypto from 'node:crypto';
import { json, requireTenantMember, serviceKey, supabaseBase } from './_auth.js';
import { SCOPES, site, redirectUri, secret, clientId, calendarCookie, signedState, readState, encrypt, db, exchangeToken, google, connectionFor, hasScope, accessToken } from './_google.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = { 'Content-Type': 'application/json' };
const googleReturn = (res, message) => {
  res.setHeader('Set-Cookie', calendarCookie('', 0));
  res.setHeader('Cache-Control', 'no-store');
  res.status(302); res.setHeader('Location', `${site()}/admin#google=${encodeURIComponent(message)}`); return res.end();
};
async function callback(req, res, url) {
  const stateValue = url.searchParams.get('state');
  const expected = String(req.headers.cookie || '').match(/(?:^|;\s*)bp_google_calendar_state=([^;]+)/)?.[1];
  const state = readState(stateValue);
  if (!state || stateValue !== expected || state.kind !== 'integrations') return json(res, 400, { error: 'Autorização Google inválida ou expirada. Conecte novamente pelo painel.' });
  if (url.searchParams.get('error')) return googleReturn(res, 'cancelled');
  if (!url.searchParams.get('code')) return googleReturn(res, 'failed');
  const members = await db(`tenant_members?select=role&user_id=eq.${state.userId}&tenant_id=eq.${state.tenantId}&limit=1`);
  if (!members?.length || !['owner','admin','manager','agent'].includes(members[0].role)) return googleReturn(res, 'access_denied');
  const tokens = await exchangeToken({ code: url.searchParams.get('code'), redirect_uri: redirectUri(), grant_type: 'authorization_code' });
  const auth = { user: { id: state.userId }, member: { tenant_id: state.tenantId } };
  const existing = await connectionFor(auth);
  if (!tokens.refresh_token && !existing) return googleReturn(res, 'refresh_required');
  const user = await google('https://www.googleapis.com/oauth2/v3/userinfo', tokens.access_token);
  // Do not reuse a refresh token from a different Google account.
  if (!tokens.refresh_token && existing.google_email !== user.email) return googleReturn(res, 'refresh_required');
  const row = {
    user_id: state.userId, tenant_id: state.tenantId, google_email: user.email,
    calendar_id: 'primary', token_scope: tokens.scope || '', updated_at: new Date().toISOString(),
    refresh_token_ciphertext: tokens.refresh_token ? encrypt(tokens.refresh_token) : existing.refresh_token_ciphertext
  };
  if (existing && existing.google_email !== user.email) row.drive_folder_id = null;
  await db('google_calendar_connections?on_conflict=user_id,tenant_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
  return googleReturn(res, 'connected');
}
async function folderFor(connection, access) {
  if (connection.drive_folder_id) return connection.drive_folder_id;
  // Deterministic marker avoids duplicate folders if the request is retried.
  const query = new URLSearchParams({ q: `trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='bp_connection' and value='${connection.id}' }`, fields: 'files(id)', pageSize: '1' });
  const known = await google(`https://www.googleapis.com/drive/v3/files?${query}`, access);
  const folder = known.files?.[0] || await google('https://www.googleapis.com/drive/v3/files?fields=id', access, {
    method: 'POST', headers, body: JSON.stringify({ name: 'B&P Advocacia — Documentos do CRM', mimeType: 'application/vnd.google-apps.folder', appProperties: { bp_connection: connection.id } })
  });
  await db(`google_calendar_connections?id=eq.${connection.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ drive_folder_id: folder.id }) });
  return folder.id;
}
async function syncAppointment(auth, connection, body, access) {
  if (!UUID.test(body.appointment_id || '')) throw new Error('invalid_record');
  const rows = await db(`legal_appointments?select=id,starts_at,status,kind&tenant_id=eq.${auth.member.tenant_id}&id=eq.${body.appointment_id}&limit=1`);
  const appointment = rows?.[0]; if (!appointment) throw new Error('not_found');
  const start = new Date(appointment.starts_at);
  // Never export client names, case titles, process numbers, notes or confidential locations.
  const eventId = `bp${connection.id.replace(/-/g, '')}${appointment.id.replace(/-/g, '')}`;
  const event = {
    summary: appointment.kind === 'hearing' ? 'B&P — Audiência (consultar CRM)' : 'B&P — Compromisso (consultar CRM)',
    description: 'Informações reservadas disponíveis exclusivamente no CRM do escritório.',
    visibility: 'private', status: appointment.status === 'cancelled' ? 'cancelled' : 'confirmed',
    start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: new Date(start.getTime() + 3600000).toISOString(), timeZone: 'America/Sao_Paulo' },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] }
  };
  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events`;
  let result;
  try { result = await google(`${endpoint}/${eventId}`, access, { method: 'PATCH', headers, body: JSON.stringify(event) }); }
  catch (error) {
    if (error.status !== 404) throw error;
    result = await google(endpoint, access, { method: 'POST', headers, body: JSON.stringify({ ...event, id: eventId }) });
  }
  await db('google_calendar_events?on_conflict=connection_id,appointment_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ connection_id: connection.id, appointment_id: appointment.id, google_event_id: result.id, last_synced_at: new Date().toISOString() })
  });
  return { synced: true, htmlLink: result.htmlLink || null };
}
async function syncContactUnlocked(auth, connection, body, access) {
  if (!UUID.test(body.customer_id || '')) throw new Error('invalid_record');
  const rows = await db(`customers?select=id,full_name,email,phone_e164,status,consent_status&tenant_id=eq.${auth.member.tenant_id}&id=eq.${body.customer_id}&limit=1`);
  const customer = rows?.[0]; if (!customer) throw new Error('not_found');
  if (customer.consent_status !== 'opted_in' || customer.status !== 'active') throw new Error('contact_consent');
  const links = await db(`google_contact_links?select=resource_name&connection_id=eq.${connection.id}&customer_id=eq.${customer.id}&limit=1`);
  const person = { names: [{ givenName: customer.full_name }], emailAddresses: customer.email ? [{ value: customer.email }] : [], phoneNumbers: customer.phone_e164 ? [{ value: customer.phone_e164 }] : [] };
  let resource = links?.[0]?.resource_name;
  let result;
  if (resource) {
    const current = await google(`https://people.googleapis.com/v1/${resource}?personFields=metadata,names,emailAddresses,phoneNumbers`, access);
    result = await google(`https://people.googleapis.com/v1/${resource}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers`, access, {
      method: 'PATCH', headers, body: JSON.stringify({ ...person, resourceName: resource, etag: current.etag, metadata: current.metadata })
    });
  } else {
    result = await google('https://people.googleapis.com/v1/people:createContact', access, { method: 'POST', headers, body: JSON.stringify(person) });
  }
  await db('google_contact_links?on_conflict=connection_id,customer_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ connection_id: connection.id, customer_id: customer.id, resource_name: result.resourceName, updated_at: new Date().toISOString() })
  });
  return { synced: true, updated: Boolean(resource) };
}
async function syncContact(auth, connection, body, access) {
  if (!UUID.test(body.customer_id || '')) throw new Error('invalid_record');
  const lease=crypto.randomUUID();
  const lock=crypto.createHash('sha256').update(`${connection.id}:${body.customer_id}`).digest('hex');
  const acquired=await db('rpc/acquire_google_operation_lock',{method:'POST',body:JSON.stringify({p_key:lock,p_lease:lease})});
  if(acquired!==true)throw new Error('operation_running');
  try{return await syncContactUnlocked(auth,connection,body,access);}
  finally{await db(`google_operation_locks?lock_key=eq.${lock}&lease_id=eq.${lease}`,{method:'DELETE'}).catch(()=>{});}
}
async function uploadDocument(connection, body, access) {
  const name = String(body.name || '').replace(/[\r\n]/g, '').slice(0, 180);
  const mime = String(body.mime_type || '');
  const allowed = ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png','text/plain'];
  if (!name || !allowed.includes(mime) || typeof body.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64)) throw new Error('invalid_document');
  const bytes = Buffer.from(body.base64, 'base64');
  if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('invalid_document');
  const folder = await folderFor(connection, access);
  const boundary = `bp${crypto.randomBytes(16).toString('hex')}`;
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folder] })}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--`)
  ]);
  const file = await google('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', access, {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: payload
  });
  return { uploaded: true, file };
}
export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const route = url.pathname;
  if (!site() || !clientId() || !secret() || !supabaseBase() || !serviceKey()) return json(res, 503, { error: 'Integrações Google não configuradas.' });
  try {
    if (route.endsWith('/callback')) return await callback(req, res, url);
    const readOnly = route.endsWith('/status') || route.endsWith('/drive/files');
    if (req.method !== (readOnly ? 'GET' : 'POST')) return json(res, 405, { error: 'Método não permitido.' });
    if (req.method === 'POST' && req.headers.origin && req.headers.origin !== new URL(site()).origin) return json(res, 403, { error: 'Origem não autorizada.' });
    const auth = await requireTenantMember(req, readOnly ? [] : ['owner','admin','manager','agent']);
    if (auth.error) return json(res, auth.status, { error: 'Entre com uma conta autorizada do escritório.' });
    if (route.endsWith('/connect')) {
      const state = signedState({ kind: 'integrations', userId: auth.user.id, tenantId: auth.member.tenant_id, nonce: crypto.randomBytes(24).toString('hex'), exp: Date.now() + 600000 });
      res.setHeader('Set-Cookie', calendarCookie(state, 600));
      const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorize.search = new URLSearchParams({ client_id: clientId(), redirect_uri: redirectUri(), response_type: 'code', scope: ['openid','email','profile',...Object.values(SCOPES)].join(' '), access_type: 'offline', prompt: 'consent select_account', state }).toString();
      return json(res, 200, { url: authorize.toString() });
    }
    const connection = await connectionFor(auth);
    if (route.endsWith('/status')) return json(res, 200, { connected: Boolean(connection), googleEmail: connection?.google_email || null, capabilities: Object.fromEntries(Object.keys(SCOPES).map(name => [name, hasScope(connection, name)])), documentMaxBytes: 2 * 1024 * 1024 });
    if (route.endsWith('/disconnect')) {
      if (connection) await db(`google_calendar_connections?id=eq.${connection.id}`, { method: 'DELETE' });
      return json(res, 200, { disconnected: true });
    }
    if (!connection) return json(res, 409, { error: 'Conecte sua conta Google no painel de Integrações.' });
    const scope = route.includes('/drive/') ? 'drive' : route.includes('/contacts/') ? 'contacts' : 'calendar';
    if (!hasScope(connection, scope)) return json(res, 409, { error: 'Permissão pendente. Reconecte sua conta Google e autorize esta integração.' });
    const access = await accessToken(connection);
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (route.endsWith('/drive/folder')) {
      const folderId = await folderFor(connection, access);
      return json(res, 200, { folderId, webViewLink: `https://drive.google.com/drive/folders/${folderId}` });
    }
    if (route.endsWith('/drive/files')) {
      if (!connection.drive_folder_id) return json(res, 200, { files: [] });
      const query = new URLSearchParams({ q: `'${connection.drive_folder_id}' in parents and trashed = false`, fields: 'files(id,name,mimeType,modifiedTime,webViewLink)', pageSize: '100', orderBy: 'modifiedTime desc' });
      const files = await google(`https://www.googleapis.com/drive/v3/files?${query}`, access);
      return json(res, 200, { files: files.files || [] });
    }
    if (route.endsWith('/drive/upload')) return json(res, 201, await uploadDocument(connection, body, access));
    if (route.endsWith('/contacts/sync')) return json(res, 200, await syncContact(auth, connection, body, access));
    if (route.endsWith('/calendar/sync')) return json(res, 200, await syncAppointment(auth, connection, body, access));
    return json(res, 404, { error: 'Integração não encontrada.' });
  } catch (error) {
    const messages = {
      operation_running: 'Este contato já está sendo sincronizado. Aguarde a conclusão antes de tentar novamente.',
      google_permission: 'Ative a API correspondente (Calendar, Drive ou People) no Google Cloud e confira o consentimento. Reconecte se necessário.',
      google_reconnect: 'Permissão Google expirada ou revogada. Reconecte sua conta.',
      invalid_record: 'Selecione um registro válido.', not_found: 'Registro não encontrado neste escritório.',
      invalid_document: 'Envie PDF, DOCX, JPG, PNG ou TXT com até 2 MB.',
      contact_consent: 'Somente clientes ativos com consentimento autorizado podem ser exportados aos Contatos.'
    };
    return json(res, ['invalid_record','invalid_document'].includes(error.message) ? 400 : error.message === 'contact_consent' ? 422 : 502, { error: messages[error.message] || 'Integração indisponível. Tente novamente ou reconecte a conta Google.' });
  }
}
