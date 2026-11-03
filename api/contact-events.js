import { json, requireTenantMember, supabaseFetch } from './_auth.js';

const allowedChannels = new Set(['whatsapp','phone','email','web','other']);
const allowedDirections = new Set(['inbound','outbound','internal']);
const allowedTypes = new Set(['contact','handoff','callback','appointment','note','consent','opt_out']);
const sensitive = /\b(?:cpf|rg|senha|token|processo\s*n[ºo]|documento|dados\s+banc)/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Método não permitido.' }); }
  const auth = await requireTenantMember(req, ['owner', 'admin', 'manager', 'agent']);
  if (auth.error) return json(res, auth.status, { error: auth.error });
  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return null; } })() : req.body;
  const channel = String(body?.channel || 'whatsapp');
  const direction = String(body?.direction || 'outbound');
  const eventType = String(body?.event_type || 'contact');
  const summary = String(body?.safe_summary || '').trim();
  if (!allowedChannels.has(channel) || !allowedDirections.has(direction) || !allowedTypes.has(eventType) || summary.length < 2 || summary.length > 500) return json(res, 400, { error: 'Informe um registro operacional válido.' });
  if (sensitive.test(summary)) return json(res, 422, { error: 'O histórico seguro aceita apenas um resumo operacional sem dados sigilosos.' });
  try {
    const result = await supabaseFetch('legal_contact_events', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ tenant_id: auth.member.tenant_id, customer_id: body?.customer_id || null, conversation_id: body?.conversation_id || null, actor_id: auth.user.id, channel, direction, event_type: eventType, safe_summary: summary, external_ref: body?.external_ref ? String(body.external_ref).slice(0, 180) : null }) });
    if (!result.response.ok) return json(res, 503, { error: 'Não foi possível salvar o registro de contato.' });
    return json(res, 201, { ok: true, event: Array.isArray(result.data) ? result.data[0] : result.data });
  } catch { return json(res, 503, { error: 'Falha temporária de comunicação.' }); }
}
