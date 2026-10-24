// QA mock of the Resend REST API on $RESEND_PORT (4112). In-memory, nothing leaves this machine.
// Checks request shapes against the Resend OpenAPI spec for the endpoints the site uses, and logs every request to
// $QA_OUT/logs/resend-log.jsonl. Test hooks: GET /__state, POST /__reset, POST /__mode (body: ok | down | slow),
// POST /__unsubscribe (body: email) to mimic a contact clicking Resend's unsubscribe link.
import http from 'node:http';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.RESEND_PORT ?? 4112);
const KEY = process.env.RESEND_MOCK_KEY ?? 're_qa_mock_key';
const LOG = (process.env.QA_OUT ?? '/tmp/tracelings-qa') + '/logs/resend-log.jsonl';
fs.mkdirSync(LOG.replace(/[^/]+$/, ''), { recursive: true }); fs.writeFileSync(LOG, '');
const log = (o: any) => fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), ...o }) + '\n');

type Obj = Record<string, any>;
let S: { contacts: Obj[]; segments: Obj[]; props: Obj[]; topics: Obj[]; events: Obj[]; sentEvents: Obj[]; templates: Obj[]; automations: Obj[]; broadcasts: Obj[]; emails: Obj[]; domains: Obj[]; contactSegments: Record<string, string[]> };
const reset = () => { S = { contacts: [], segments: [], props: [], topics: [], events: [], sentEvents: [], templates: [], automations: [], broadcasts: [], emails: [], domains: [], contactSegments: {} }; };
reset();
let mode = 'ok';
// Stand-in for the owner's Zapier webhook (NOTIFY_WEBHOOK_URL=http://127.0.0.1:$RESEND_PORT/__notify).
let notifyMode = 'ok';
const notifies: number[] = [];
const now = () => new Date().toISOString().replace('T', ' ').replace('Z', '+00');

const send = (res: http.ServerResponse, code: number, o: any) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
const err = (res: http.ServerResponse, code: number, name: string, message: string) => send(res, code, { statusCode: code, name, message });
const page = (u: URL, list: Obj[]) => {
  const limit = u.searchParams.get('limit') ? Number(u.searchParams.get('limit')) : 20;
  if (limit < 1 || limit > 100) return null;
  const after = u.searchParams.get('after');
  let start = 0;
  if (after) { const i = list.findIndex((x) => x.id === after); start = i + 1; }
  const data = list.slice(start, start + limit);
  return { object: 'list', has_more: start + limit < list.length, data };
};
const body = (req: http.IncomingMessage) => new Promise<string>((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });
const findContact = (idOrEmail: string) => S.contacts.find((c) => c.id === idOrEmail || c.email === idOrEmail.toLowerCase());
const publicContact = (c: Obj) => ({ object: 'contact', id: c.id, email: c.email, first_name: null, last_name: null, created_at: c.created_at, unsubscribed: c.unsubscribed,
  properties: Object.fromEntries(Object.entries(c.properties).map(([k, v]) => [k, { value: v, type: S.props.find((p) => p.key === k)?.type ?? 'string' }])) });
const listContact = (c: Obj) => ({ id: c.id, email: c.email, first_name: null, last_name: null, created_at: c.created_at, unsubscribed: c.unsubscribed });

function checkProps(res: http.ServerResponse, props: any): boolean {
  if (props === undefined) return true;
  if (typeof props !== 'object' || Array.isArray(props)) { err(res, 422, 'validation_error', 'properties must be an object'); return false; }
  for (const [k, v] of Object.entries(props)) {
    const def = S.props.find((p) => p.key === k);
    if (!def) { err(res, 422, 'validation_error', `Property ${k} does not exist`); return false; }
    if (v !== null && typeof v !== def.type) { err(res, 422, 'validation_error', `Property ${k} must be a ${def.type}`); return false; }
  }
  return true;
}

function checkAutomation(res: http.ServerResponse, b: Obj): boolean {
  const steps: Obj[] = b.steps, conns: Obj[] = b.connections;
  if (!Array.isArray(steps) || !Array.isArray(conns)) { err(res, 422, 'validation_error', 'steps and connections are required together'); return false; }
  const keys = new Set<string>();
  for (const s of steps) {
    if (!s.key || keys.has(s.key)) { err(res, 422, 'validation_error', `duplicate or missing key ${s.key}`); return false; }
    keys.add(s.key);
    if (!['trigger', 'send_email', 'delay', 'wait_for_event', 'condition', 'contact_update', 'contact_delete', 'add_to_segment'].includes(s.type)) { err(res, 422, 'validation_error', `bad type ${s.type}`); return false; }
    if (typeof s.config !== 'object') { err(res, 422, 'validation_error', 'config required'); return false; }
    if (s.type === 'trigger' && !S.events.some((e) => e.name === s.config.event_name)) { err(res, 422, 'validation_error', `event ${s.config.event_name} not found`); return false; }
    if (s.type === 'send_email') {
      const t = S.templates.find((x) => x.id === s.config.template?.id || x.alias === s.config.template?.id);
      if (!t || t.status !== 'published') { err(res, 422, 'validation_error', `template ${s.config.template?.id} not published`); return false; }
    }
    if (s.type === 'delay' && !/^\d+ (minute|hour|day|week)s?$/.test(s.config.duration ?? '')) { err(res, 422, 'validation_error', `bad duration ${s.config.duration}`); return false; }
    if (s.type === 'condition' && !(['rule', 'and', 'or'].includes(s.config.type) && (s.config.type !== 'rule' || (s.config.field && s.config.operator)))) { err(res, 422, 'validation_error', 'bad condition'); return false; }
    if (s.type === 'contact_update' && !checkProps(res, s.config.properties)) return false;
  }
  if (steps[0]?.type !== 'trigger') { err(res, 422, 'validation_error', 'first step must be a trigger'); return false; }
  for (const c of conns) {
    if (!keys.has(c.from) || !keys.has(c.to)) { err(res, 422, 'validation_error', `connection ${c.from}->${c.to} references a missing step`); return false; }
    if (c.type && !['default', 'condition_met', 'condition_not_met', 'timeout', 'event_received'].includes(c.type)) { err(res, 422, 'validation_error', 'bad connection type'); return false; }
  }
  for (const s of steps.filter((x) => x.type === 'condition')) {
    const out = conns.filter((c) => c.from === s.key).map((c) => c.type);
    if (!out.includes('condition_met') || !out.includes('condition_not_met')) { err(res, 422, 'validation_error', `condition ${s.key} needs both branches`); return false; }
  }
  return true;
}

http.createServer(async (req, res) => {
  const raw = await body(req);
  const u = new URL(req.url!, 'http://x');
  const p = u.pathname.replace(/\/$/, '');
  const auth = req.headers.authorization ?? '';
  log({ method: req.method, path: p, query: u.search, body: raw.length > 4000 ? raw.slice(0, 4000) + '…' : raw, auth: auth === `Bearer ${KEY}` ? 'ok' : 'bad', idem: req.headers['idempotency-key'] ?? null });
  if (p === '/__state') return send(res, 200, S);
  if (p === '/__reset') { reset(); mode = 'ok'; notifyMode = 'ok'; return send(res, 200, { ok: true }); }
  if (p === '/__mode') { mode = raw || 'ok'; return send(res, 200, { mode }); }
  if (p === '/__notify') { notifyMode === 'down' ? err(res, 500, 'down', 'down') : send(res, 200, { ok: true }); notifies.push(raw.length); return; }
  if (p === '/__notify-mode') { notifyMode = raw || 'ok'; return send(res, 200, { notifyMode }); }
  if (p === '/__notifies') return send(res, 200, { count: notifies.length });
  if (p === '/__unsubscribe') { const c = findContact(raw.trim()); if (c) c.unsubscribed = true; return send(res, c ? 200 : 404, { ok: !!c }); }
  if (auth !== `Bearer ${KEY}`) return err(res, 401, 'missing_api_key', 'Missing or invalid API key');
  if (mode === 'down') return err(res, 500, 'internal_server_error', 'down');
  if (mode === 'slow') await new Promise((r) => setTimeout(r, 10_000));
  let b: Obj = {};
  if (raw) { try { b = JSON.parse(raw); } catch { return err(res, 400, 'invalid_json', 'bad json'); } }
  const m = req.method!;
  const seg = p.split('/').filter(Boolean).map(decodeURIComponent);

  // ---- domains
  if (p === '/domains' && m === 'POST') {
    if (!b.name) return err(res, 422, 'validation_error', 'name required');
    if (S.domains.some((d) => d.name === b.name)) return err(res, 403, 'validation_error', 'domain already registered');
    const d = { id: randomUUID(), name: b.name, status: 'not_started', created_at: now(), region: b.region ?? 'us-east-1', open_tracking: !!b.open_tracking, click_tracking: !!b.click_tracking,
      records: [
        { record: 'SPF', name: 'send.mail', type: 'MX', ttl: 'Auto', status: 'not_started', value: 'feedback-smtp.us-east-1.amazonses.com', priority: 10 },
        { record: 'SPF', name: 'send.mail', type: 'TXT', ttl: 'Auto', status: 'not_started', value: '"v=spf1 include:amazonses.com ~all"' },
        { record: 'DKIM', name: 'resend._domainkey.mail', type: 'TXT', ttl: 'Auto', status: 'not_started', value: 'p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ' },
      ] };
    S.domains.push(d);
    return send(res, 201, d);
  }
  if (p === '/domains' && m === 'GET') return send(res, 200, page(u, S.domains.map(({ records, ...d }) => d)));
  if (seg[0] === 'domains' && seg.length === 2 && m === 'GET') { const d = S.domains.find((x) => x.id === seg[1]); return d ? send(res, 200, { object: 'domain', ...d }) : err(res, 404, 'not_found', 'Domain not found'); }
  if (seg[0] === 'domains' && seg[2] === 'verify' && m === 'POST') { const d = S.domains.find((x) => x.id === seg[1]); if (!d) return err(res, 404, 'not_found', 'Domain not found'); d.status = 'pending'; return send(res, 200, { object: 'domain', id: d.id }); }

  // ---- contact properties
  if (p === '/contact-properties' && m === 'GET') return send(res, 200, page(u, S.props));
  if (p === '/contact-properties' && m === 'POST') {
    if (!/^[A-Za-z0-9_]{1,50}$/.test(b.key ?? '') || !['string', 'number'].includes(b.type)) return err(res, 422, 'validation_error', 'bad property');
    if (b.fallback_value !== undefined && typeof b.fallback_value !== b.type) return err(res, 422, 'validation_error', 'fallback type');
    if (S.props.some((x) => x.key === b.key)) return err(res, 409, 'validation_error', 'exists');
    const o = { id: randomUUID(), key: b.key, type: b.type, fallback_value: b.fallback_value ?? null, created_at: now() };
    S.props.push(o); return send(res, 201, { object: 'contact_property', id: o.id });
  }
  // ---- segments
  if (p === '/segments' && m === 'GET') return send(res, 200, page(u, S.segments));
  if (p === '/segments' && m === 'POST') { if (!b.name) return err(res, 422, 'validation_error', 'name'); const o = { id: randomUUID(), name: b.name, created_at: now() }; S.segments.push(o); return send(res, 201, { object: 'segment', id: o.id }); }
  if (seg[0] === 'segments' && seg[2] === 'contacts' && m === 'GET') {
    if (!S.segments.some((s) => s.id === seg[1])) return err(res, 404, 'not_found', 'Segment not found');
    const list = S.contacts.filter((c) => (S.contactSegments[c.id] ?? []).includes(seg[1])).map(listContact);
    return send(res, 200, page(u, list));
  }
  // ---- topics
  if (p === '/topics' && m === 'GET') return send(res, 200, page(u, S.topics));
  if (p === '/topics' && m === 'POST') {
    if (!b.name || b.name.length > 50 || !['opt_in', 'opt_out'].includes(b.default_subscription)) return err(res, 422, 'validation_error', 'bad topic');
    if (b.description && b.description.length > 200) return err(res, 422, 'validation_error', 'description too long');
    const o = { id: randomUUID(), name: b.name, description: b.description, default_subscription: b.default_subscription, visibility: b.visibility ?? 'private', created_at: now() };
    S.topics.push(o); return send(res, 201, { object: 'topic', id: o.id });
  }
  // ---- contacts
  if (p === '/contacts' && m === 'POST') {
    if (typeof b.email !== 'string' || !b.email.includes('@')) return err(res, 422, 'validation_error', 'email');
    if (findContact(b.email)) return err(res, 409, 'validation_error', 'Contact already exists');
    if (!checkProps(res, b.properties)) return;
    if (b.segments !== undefined && (!Array.isArray(b.segments) || b.segments.some((s: any) => !S.segments.some((x) => x.id === s?.id)))) return err(res, 422, 'validation_error', 'bad segment id');
    const c = { id: randomUUID(), email: b.email.toLowerCase(), unsubscribed: !!b.unsubscribed, properties: { ...(b.properties ?? {}) }, created_at: now() };
    S.contacts.push(c);
    S.contactSegments[c.id] = (b.segments ?? []).map((s: any) => s.id);
    return send(res, 201, { object: 'contact', id: c.id });
  }
  if (p === '/contacts' && m === 'GET') return send(res, 200, page(u, S.contacts.map(listContact)));
  if (seg[0] === 'contacts' && seg.length === 2) {
    const c = findContact(seg[1]);
    if (!c) return err(res, 404, 'not_found', 'Contact not found');
    if (m === 'GET') return send(res, 200, publicContact(c));
    if (m === 'PATCH') {
      if (!checkProps(res, b.properties)) return;
      for (const [k, v] of Object.entries(b.properties ?? {})) { if (v === null) delete c.properties[k]; else c.properties[k] = v; }
      if (typeof b.unsubscribed === 'boolean') c.unsubscribed = b.unsubscribed;
      return send(res, 200, { object: 'contact', id: c.id });
    }
  }
  if (seg[0] === 'contacts' && seg[2] === 'segments' && seg.length === 4) {
    const c = findContact(seg[1]);
    if (!c) return err(res, 404, 'not_found', 'Contact not found');
    if (!S.segments.some((s) => s.id === seg[3])) return err(res, 404, 'not_found', 'Segment not found');
    const list = (S.contactSegments[c.id] ??= []);
    if (m === 'POST') { if (!list.includes(seg[3])) list.push(seg[3]); return send(res, 200, { object: 'contact_segment', contact_id: c.id, segment_id: seg[3] }); }
    if (m === 'DELETE') { S.contactSegments[c.id] = list.filter((x) => x !== seg[3]); return send(res, 200, { object: 'contact_segment', deleted: true }); }
  }
  // ---- events
  if (p === '/events' && m === 'GET') return send(res, 200, page(u, S.events));
  if (p === '/events' && m === 'POST') {
    if (!b.name || /^resend:/.test(b.name)) return err(res, 422, 'validation_error', 'bad name');
    if (S.events.some((e) => e.name === b.name)) return err(res, 409, 'validation_error', 'exists');
    const o = { id: randomUUID(), name: b.name, schema: b.schema ?? null, created_at: now() }; S.events.push(o); return send(res, 201, { object: 'event', id: o.id });
  }
  if (p === '/events/send' && m === 'POST') {
    if (!b.event || (!b.contact_id === !b.email)) return err(res, 422, 'validation_error', 'event and exactly one of contact_id or email');
    S.sentEvents.push({ event: b.event, contact_id: b.contact_id ?? null, email: b.email ?? null, payload: b.payload ?? null });
    return send(res, 202, { object: 'event', event: b.event });
  }
  // ---- templates
  if (p === '/templates' && m === 'GET') return send(res, 200, page(u, S.templates.map(({ html, text, ...t }) => t)));
  if (p === '/templates' && m === 'POST') {
    if (!b.name || !b.html) return err(res, 422, 'validation_error', 'name and html required');
    if (b.reply_to !== undefined && !Array.isArray(b.reply_to)) return err(res, 422, 'validation_error', 'reply_to must be an array');
    if (b.alias && S.templates.some((t) => t.alias === b.alias)) return err(res, 409, 'validation_error', 'alias exists');
    const o = { id: randomUUID(), status: 'draft', published_at: null, created_at: now(), updated_at: now(), ...b };
    S.templates.push(o); return send(res, 201, { object: 'template', id: o.id });
  }
  if (seg[0] === 'templates' && seg.length === 2 && m === 'PATCH') {
    const t = S.templates.find((x) => x.id === seg[1] || x.alias === seg[1]); if (!t) return err(res, 404, 'not_found', 'Template not found');
    if (b.reply_to !== undefined && !Array.isArray(b.reply_to)) return err(res, 422, 'validation_error', 'reply_to must be an array');
    Object.assign(t, b, { updated_at: now(), has_unpublished_versions: true }); return send(res, 200, { object: 'template', id: t.id });
  }
  if (seg[0] === 'templates' && seg[2] === 'publish' && m === 'POST') {
    const t = S.templates.find((x) => x.id === seg[1] || x.alias === seg[1]); if (!t) return err(res, 404, 'not_found', 'Template not found');
    t.status = 'published'; t.published_at = now(); t.has_unpublished_versions = false; return send(res, 200, { object: 'template', id: t.id });
  }
  // ---- automations
  if (p === '/automations' && m === 'GET') return send(res, 200, page(u, S.automations.map(({ steps, connections, ...a }) => a)));
  if (p === '/automations' && m === 'POST') {
    if (!b.name) return err(res, 422, 'validation_error', 'name');
    if (!checkAutomation(res, b)) return;
    const o = { object: 'automation', id: randomUUID(), name: b.name, status: b.status ?? 'disabled', steps: b.steps, connections: b.connections, created_at: now(), updated_at: now() };
    S.automations.push(o); return send(res, 201, { object: 'automation', id: o.id });
  }
  if (seg[0] === 'automations' && seg.length === 2) {
    const a = S.automations.find((x) => x.id === seg[1]); if (!a) return err(res, 404, 'not_found', 'Automation not found');
    if (m === 'GET') return send(res, 200, a);
    if (m === 'PATCH') {
      if (b.steps || b.connections) {
        if (a.status === 'enabled') return err(res, 422, 'validation_error', 'cannot edit an enabled automation');
        if (!checkAutomation(res, b)) return;
        a.steps = b.steps; a.connections = b.connections;
      }
      if (b.status) a.status = b.status;
      return send(res, 200, { object: 'automation', id: a.id });
    }
  }
  // ---- broadcasts
  if (p === '/broadcasts' && m === 'POST') {
    for (const f of ['segment_id', 'from', 'subject']) if (!b[f]) return err(res, 422, 'validation_error', `${f} required`);
    if (!S.segments.some((s) => s.id === b.segment_id)) return err(res, 404, 'not_found', 'Segment not found');
    if (b.reply_to !== undefined && !Array.isArray(b.reply_to)) return err(res, 422, 'validation_error', 'reply_to must be an array');
    if (b.topic_id && !S.topics.some((t) => t.id === b.topic_id)) return err(res, 404, 'not_found', 'Topic not found');
    const o = { id: randomUUID(), ...b, status: b.send ? 'sent' : 'draft', created_at: now(), sent_at: b.send ? now() : null, scheduled_at: null };
    S.broadcasts.push(o); return send(res, 201, { object: 'broadcast', id: o.id });
  }
  if (p === '/broadcasts' && m === 'GET') return send(res, 200, page(u, S.broadcasts.map(({ html, text, ...x }) => x)));
  if (seg[0] === 'broadcasts' && seg.length === 2 && m === 'GET') { const x = S.broadcasts.find((y) => y.id === seg[1]); return x ? send(res, 200, { object: 'broadcast', ...x }) : err(res, 404, 'not_found', 'Broadcast not found'); }
  if (seg[0] === 'broadcasts' && seg.length === 2 && m === 'PATCH') {
    const x = S.broadcasts.find((y) => y.id === seg[1]); if (!x) return err(res, 404, 'not_found', 'Broadcast not found');
    if (x.status !== 'draft') return err(res, 422, 'validation_error', 'only drafts can be updated');
    if (b.reply_to !== undefined && !Array.isArray(b.reply_to)) return err(res, 422, 'validation_error', 'reply_to must be an array');
    if ('send' in b || 'scheduled_at' in b) return err(res, 422, 'validation_error', 'send is not an update field');
    Object.assign(x, b, { updated_at: now() }); return send(res, 200, { object: 'broadcast', id: x.id });
  }
  if (seg[0] === 'broadcasts' && seg[2] === 'cancel' && m === 'POST') {
    const x = S.broadcasts.find((y) => y.id === seg[1]); if (!x) return err(res, 404, 'not_found', 'Broadcast not found');
    if (x.status === 'scheduled') { x.status = 'draft'; x.scheduled_at = null; }
    else if (x.status === 'queued') x.status = 'canceled';
    else return err(res, 422, 'validation_error', `cannot cancel a ${x.status} broadcast`);
    return send(res, 200, { object: 'broadcast', id: x.id });
  }
  if (seg[0] === 'broadcasts' && seg[2] === 'send' && m === 'POST') {
    const x = S.broadcasts.find((y) => y.id === seg[1]); if (!x) return err(res, 404, 'not_found', 'Broadcast not found');
    if (x.status !== 'draft') return err(res, 422, 'validation_error', 'not a draft');
    if (b.scheduled_at) { x.status = 'scheduled'; x.scheduled_at = b.scheduled_at; } else { x.status = 'sent'; x.sent_at = now(); }
    return send(res, 200, { id: x.id });
  }
  if (seg[0] === 'broadcasts' && seg[2] === 'recipients' && m === 'GET') {
    const x = S.broadcasts.find((y) => y.id === seg[1]); if (!x) return err(res, 404, 'not_found', 'Broadcast not found');
    const members = x.status === 'sent' ? S.contacts.filter((c) => !c.unsubscribed && (S.contactSegments[c.id] ?? []).includes(x.segment_id)) : [];
    const type = u.searchParams.get('type');
    const list = (type === 'delivered' || type === 'sent' ? members : type === 'opened' ? members.slice(0, 1) : []).map((c) => ({ id: c.id, contact_id: c.id, email: c.email }));
    return send(res, 200, page(u, list));
  }
  // ---- emails
  if (p === '/emails' && m === 'POST') {
    for (const f of ['from', 'to', 'subject']) if (!b[f]) return err(res, 422, 'validation_error', `${f} required`);
    const o = { id: randomUUID(), ...b }; S.emails.push(o); return send(res, 200, { id: o.id });
  }
  return err(res, 404, 'not_found', `mock: no route ${m} ${p}`);
}).listen(PORT, '127.0.0.1', () => console.log(`resend mock on ${PORT}`));
