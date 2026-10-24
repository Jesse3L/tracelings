// The admin actions behind /api/admin/email: domain, one-time setup (properties, segments, topic, events,
// templates, welcome automations), broadcasts, test sends and stats. Server only.
import { rs, listAll, enc, ResendError } from './resend';
import { segmentIds, _resetEmailCache } from './email';
import { SEGMENTS, PROPERTIES, TOPIC_NAME, TOPIC_DESCRIPTION, INTERESTS, welcomeEvent, type Interest, type SegmentKey } from '../email/audience';
import { allTemplates, FROM, LAUNCH, WELCOME_DAYS, withUnsubscribe, type LaunchKey } from '../email/templates';
import { SITE } from '../../config';

export const SENDING_DOMAIN = 'tracelings.com';
const REPLY_TO = SITE.email;

// ---------- domain ----------
interface DomainRecord { record: string; name: string; type: string; ttl?: string; status?: string; value: string; priority?: number }
const publicRecords = (records: DomainRecord[] | undefined) =>
  (records ?? []).map((r) => ({ record: r.record, type: r.type, name: r.name, value: r.value, ttl: r.ttl, priority: r.priority, status: r.status }));

async function findDomain(): Promise<{ id: string; status: string } | undefined> {
  const list = await listAll<{ id: string; name: string; status: string }>('/domains');
  return list.find((d) => d.name === SENDING_DOMAIN);
}

export async function domainCreate(opts: { open_tracking?: boolean; click_tracking?: boolean }) {
  const found = await findDomain();
  if (found) return { existed: true, ...(await domainStatus()) };
  const d = await rs<any>('/domains', { body: {
    name: SENDING_DOMAIN, region: 'us-east-1',
    open_tracking: opts.open_tracking === true, click_tracking: opts.click_tracking === true,
  } });
  return {
    existed: false, id: d.id, name: d.name, status: d.status, records: publicRecords(d.records),
    note: 'Add each record in Vercel DNS for tracelings.com. If a name ends in ".tracelings.com", enter only the part before it.',
  };
}

export async function domainStatus() {
  const found = await findDomain();
  if (!found) {
    // Show the other domains on the account (names and status only) so a plan's domain limit is easy to sort out.
    const others = (await listAll<{ name: string; status: string }>('/domains')).map((x) => ({ name: x.name, status: x.status }));
    return { found: false, name: SENDING_DOMAIN, others };
  }
  const d = await rs<any>(`/domains/${enc(found.id)}`);
  return { found: true, id: d.id, name: d.name, status: d.status, open_tracking: d.open_tracking, click_tracking: d.click_tracking, records: publicRecords(d.records) };
}

export async function domainVerify() {
  const found = await findDomain();
  if (!found) return { found: false, name: SENDING_DOMAIN };
  await rs(`/domains/${enc(found.id)}/verify`, { method: 'POST' });
  return { verifying: true, ...(await domainStatus()) };
}

// ---------- welcome automations ----------
export type WelcomeVariant = Interest | 'teacher';
export const WELCOME_VARIANTS: readonly WelcomeVariant[] = [...INTERESTS, 'teacher'];
export const automationName = (v: WelcomeVariant) => `Tracelings welcome: ${v}`;
export const templateAlias = (key: string) => `tl-${key}`;

/** Template keys a welcome variant sends, in order. */
export function welcomeTemplateKeys(v: WelcomeVariant): string[] {
  if (v === 'teacher') return ['welcome-teacher'];
  return [`welcome-0-${v}`, `welcome-2-${v}`, 'welcome-5', 'welcome-9', 'welcome-14'];
}

/**
 * The automation graph for one variant. Linear, with no step reached from two places:
 *   trigger -> day 0 -> wait -> member? -> day 2 -> wait -> member? -> day 5 -> ... -> day 14 -> mark done.
 * A member check that matches ends the run with welcome_status = 'stopped-member'. Resend itself skips every
 * remaining send once a contact unsubscribes.
 */
export function automationGraph(v: WelcomeVariant, templateIds: Record<string, string>) {
  const keys = welcomeTemplateKeys(v);
  const steps: any[] = [{ key: 'start', type: 'trigger', config: { event_name: welcomeEvent(v) } }];
  const connections: any[] = [];
  const send = (k: string, i: number) => ({ key: `email_${i}`, type: 'send_email', config: { template: { id: templateIds[k] }, from: FROM, reply_to: REPLY_TO } });
  steps.push(send(keys[0], 0));
  connections.push({ from: 'start', to: 'email_0', type: 'default' });
  let prev = 'email_0';
  for (let i = 1; i < keys.length; i++) {
    const days = WELCOME_DAYS[i] - WELCOME_DAYS[i - 1];
    steps.push({ key: `wait_${i}`, type: 'delay', config: { duration: `${days} days` } });
    steps.push({ key: `member_${i}`, type: 'condition', config: { type: 'rule', field: 'contact.properties.member', operator: 'eq', value: 'true' } });
    steps.push({ key: `stop_${i}`, type: 'contact_update', config: { properties: { welcome_status: 'stopped-member' } } });
    steps.push(send(keys[i], i));
    connections.push({ from: prev, to: `wait_${i}`, type: 'default' });
    connections.push({ from: `wait_${i}`, to: `member_${i}`, type: 'default' });
    connections.push({ from: `member_${i}`, to: `stop_${i}`, type: 'condition_met' });
    connections.push({ from: `member_${i}`, to: `email_${i}`, type: 'condition_not_met' });
    prev = `email_${i}`;
  }
  steps.push({ key: 'done', type: 'contact_update', config: { properties: { welcome_status: 'done' } } });
  connections.push({ from: prev, to: 'done', type: 'default' });
  return { name: automationName(v), steps, connections };
}

// ---------- setup ----------
export interface SetupOptions { enable?: boolean; rebuild_automations?: boolean }

export async function setup(opts: SetupOptions = {}) {
  const report: Record<string, any> = { properties: {}, segments: {}, topic: null, events: {}, templates: {}, automations: {} };

  // 1. Contact properties
  const props = await listAll<{ key: string }>('/contact-properties');
  for (const p of PROPERTIES) {
    if (props.some((x) => x.key === p.key)) { report.properties[p.key] = 'exists'; continue; }
    await rs('/contact-properties', { body: { key: p.key, type: p.type, ...(p.fallback_value ? { fallback_value: p.fallback_value } : {}) } });
    report.properties[p.key] = 'created';
  }

  // 2. Segments. The free Resend plan allows 3, so first remove the two we used to make ('everyone', 'homeschool')
  // if they are still empty; never touch any other segment.
  let segs = await listAll<{ id: string; name: string }>('/segments');
  for (const old of segs.filter((x) => x.name === 'everyone' || x.name === 'homeschool' || x.name === 'members')) {
    const members = await listAll(`/segments/${enc(old.id)}/contacts`, 5);
    if (members.length === 0) { await rs(`/segments/${enc(old.id)}`, { method: 'DELETE' }); report.segments[`removed:${old.name}`] = { id: old.id, status: 'removed' }; }
  }
  segs = await listAll<{ id: string; name: string }>('/segments');
  for (const k of Object.keys(SEGMENTS) as SegmentKey[]) {
    const hit = segs.find((s) => s.name === SEGMENTS[k]);
    if (hit) { report.segments[k] = { id: hit.id, status: 'exists' }; continue; }
    const r = await rs<{ id: string }>('/segments', { body: { name: SEGMENTS[k] } });
    report.segments[k] = { id: r.id, status: 'created' };
  }
  _resetEmailCache();

  // 3. Topic (opt-in by default, shown on Resend's unsubscribe page)
  const topics = await listAll<{ id: string; name: string }>('/topics');
  const topic = topics.find((t) => t.name === TOPIC_NAME);
  if (topic) report.topic = { id: topic.id, status: 'exists' };
  else {
    const r = await rs<{ id: string }>('/topics', { body: { name: TOPIC_NAME, default_subscription: 'opt_in', description: TOPIC_DESCRIPTION, visibility: 'public' } });
    report.topic = { id: r.id, status: 'created' };
  }

  // 4. Trigger events
  const events = await listAll<{ name: string }>('/events');
  for (const v of WELCOME_VARIANTS) {
    const name = welcomeEvent(v);
    if (events.some((e) => e.name === name)) { report.events[name] = 'exists'; continue; }
    await rs('/events', { body: { name, schema: { source: 'string' } } });
    report.events[name] = 'created';
  }

  // 5. Templates: created or updated from code, then published (the automations send published templates).
  const all = allTemplates();
  const existing = await listAll<{ id: string; alias?: string; name: string }>('/templates');
  const templateIds: Record<string, string> = {};
  const keys = [...new Set(WELCOME_VARIANTS.flatMap(welcomeTemplateKeys))];
  for (const key of keys) {
    const t = all[key];
    const alias = templateAlias(key);
    const body = { name: `Tracelings ${key}`, alias, from: FROM, reply_to: [REPLY_TO], subject: t.subject, html: t.html, text: t.text };
    const hit = existing.find((x) => x.alias === alias);
    let id: string;
    if (hit) { await rs(`/templates/${enc(hit.id)}`, { method: 'PATCH', body }); id = hit.id; }
    else id = (await rs<{ id: string }>('/templates', { body })).id;
    await rs(`/templates/${enc(id)}/publish`, { method: 'POST' });
    templateIds[key] = id;
    report.templates[key] = { id, status: hit ? 'updated' : 'created' };
  }

  // 6. One automation per welcome variant. Resend can't edit an enabled automation, so an existing one is left
  //    alone unless it is disabled and rebuild_automations is set.
  const autos = await listAll<{ id: string; name: string; status: string }>('/automations');
  for (const v of WELCOME_VARIANTS) {
    const graph = automationGraph(v, templateIds);
    const hit = autos.find((a) => a.name === graph.name);
    if (hit) {
      if (opts.rebuild_automations && hit.status === 'disabled') {
        await rs(`/automations/${enc(hit.id)}`, { method: 'PATCH', body: { steps: graph.steps, connections: graph.connections } });
        report.automations[v] = { id: hit.id, status: hit.status, action: 'rebuilt' };
      } else {
        report.automations[v] = { id: hit.id, status: hit.status, action: hit.status === 'enabled' && opts.rebuild_automations ? 'left (enabled: disable it first to rebuild)' : 'exists' };
      }
      if (opts.enable && hit.status !== 'enabled') {
        await rs(`/automations/${enc(hit.id)}`, { method: 'PATCH', body: { status: 'enabled' } });
        report.automations[v].status = 'enabled';
      }
      continue;
    }
    const r = await rs<{ id: string }>('/automations', { body: { ...graph, status: opts.enable ? 'enabled' : 'disabled' } });
    report.automations[v] = { id: r.id, status: opts.enable ? 'enabled' : 'disabled', action: 'created' };
  }
  return report;
}

export async function setAutomations(status: 'enabled' | 'disabled') {
  const autos = await listAll<{ id: string; name: string; status: string }>('/automations');
  const out: Record<string, string> = {};
  for (const v of WELCOME_VARIANTS) {
    const hit = autos.find((a) => a.name === automationName(v));
    if (!hit) { out[v] = 'missing (run setup)'; continue; }
    if (hit.status !== status) await rs(`/automations/${enc(hit.id)}`, { method: 'PATCH', body: { status } });
    out[v] = status;
  }
  return out;
}

// ---------- broadcasts ----------
export const isLaunchKey = (k: unknown): k is LaunchKey => typeof k === 'string' && k in LAUNCH;

async function topicId(): Promise<string | undefined> {
  const topics = await listAll<{ id: string; name: string }>('/topics');
  return topics.find((t) => t.name === TOPIC_NAME)?.id;
}

/**
 * Creates a DRAFT broadcast from a built-in launch template. Never sends.
 * Re-creating a launch draft after the copy changes: a draft with the same name is refreshed in place
 * (PATCH /broadcasts/{id}) instead of piling up duplicates. A scheduled one is refused until it is cancelled
 * with broadcast-cancel (which turns it back into a draft). `fresh: true` always makes a new draft.
 */
export async function broadcastCreate(template: LaunchKey, segmentOverride?: SegmentKey, opts: { fresh?: boolean } = {}) {
  const def = LAUNCH[template];
  const segment = segmentOverride ?? def.segment;
  const ids = await segmentIds(true);
  const segment_id = ids[segment];
  if (!segment_id) throw new ResendError(400, 'setup_needed', `Segment "${SEGMENTS[segment]}" not found. Run setup first.`);
  const tid = await topicId();
  const c = def.build();
  const content = {
    name: def.name, segment_id, from: FROM, reply_to: [REPLY_TO], subject: c.subject, preview_text: c.preview,
    html: c.html, text: c.text, ...(tid ? { topic_id: tid } : {}),
  };
  const out = { status: 'draft', template, segment, subject: c.subject, suggested_send: def.sendAfterDays ? `${def.sendAfterDays} days after launch-a` : 'first' };
  if (!opts.fresh) {
    const same = (await listAll<{ id: string; name: string; status: string }>('/broadcasts', 300)).filter((b) => b.name === def.name);
    const scheduled = same.find((b) => b.status === 'scheduled');
    if (scheduled) throw new ResendError(409, 'scheduled_exists', `"${def.name}" is scheduled (${scheduled.id}). Cancel it with broadcast-cancel first, then run broadcast-create again.`);
    const draft = same.find((b) => b.status === 'draft');
    if (draft) {
      await rs(`/broadcasts/${enc(draft.id)}`, { method: 'PATCH', body: content });
      return { id: draft.id, updated: true, ...out };
    }
  }
  const r = await rs<{ id: string }>('/broadcasts', { body: { ...content, send: false } });
  return { id: r.id, updated: false, ...out };
}

/**
 * Cancels a broadcast (POST /broadcasts/{id}/cancel). Resend only cancels `scheduled` broadcasts (they go back to
 * draft and nothing is sent) and `queued` ones (they become canceled; emails already sent stay sent).
 */
export async function broadcastCancel(id: string) {
  const b = await rs<any>(`/broadcasts/${enc(id)}`);
  if (b.status !== 'scheduled' && b.status !== 'queued') throw new ResendError(409, 'not_cancelable', `Broadcast is ${b.status ?? 'unknown'}. Only scheduled or queued broadcasts can be cancelled.`);
  await rs(`/broadcasts/${enc(id)}/cancel`, { method: 'POST' });
  const after = await rs<any>(`/broadcasts/${enc(id)}`).catch(() => null);
  return { id, was: b.status, status: after?.status ?? (b.status === 'scheduled' ? 'draft' : 'canceled'), name: b.name, subject: b.subject };
}

export async function broadcastSend(id: string, scheduledAt?: string) {
  const b = await rs<any>(`/broadcasts/${enc(id)}`);
  if (b.status && b.status !== 'draft') throw new ResendError(409, 'not_draft', `Broadcast is ${b.status}, not a draft.`);
  await rs(`/broadcasts/${enc(id)}/send`, { body: scheduledAt ? { scheduled_at: scheduledAt } : {} });
  return { id, sent: !scheduledAt, scheduled_at: scheduledAt ?? null, subject: b.subject, segment_id: b.segment_id };
}

// ---------- test send ----------
export async function testSend(templateKey: string, to: string) {
  const t = allTemplates()[templateKey];
  if (!t) throw new ResendError(400, 'unknown_template', 'Unknown template');
  const c = withUnsubscribe(t, `${SITE.url}/privacy/`);
  const r = await rs<{ id: string }>('/emails', { body: { from: FROM, to: [to], reply_to: REPLY_TO, subject: `[Test] ${c.subject}`, html: c.html, text: c.text, tags: [{ name: 'kind', value: 'test' }] } });
  return { id: r.id, template: templateKey };
}

// ---------- stats ----------
async function countMembers(): Promise<number | null> {
  try {
    const all = await listAll<{ properties?: Record<string, unknown> }>('/contacts', 5000);
    return all.filter((c) => String(c.properties?.member ?? '') === 'true').length;
  } catch { return null; }
}

export async function stats() {
  const ids = await segmentIds(true);
  const segments: Record<string, { contacts: number; subscribed: number; unsubscribed: number } | null> = {};
  for (const k of Object.keys(SEGMENTS) as SegmentKey[]) {
    const id = ids[k];
    if (!id) { segments[k] = null; continue; }
    const list = await listAll<{ unsubscribed: boolean }>(`/segments/${enc(id)}/contacts`);
    const unsub = list.filter((c) => c.unsubscribed).length;
    segments[k] = { contacts: list.length, subscribed: list.length - unsub, unsubscribed: unsub };
  }
  const broadcasts = (await listAll<any>('/broadcasts', 300))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6);
  const recent = [];
  for (const b of broadcasts) {
    const row: Record<string, any> = { id: b.id, name: b.name, status: b.status, sent_at: b.sent_at, scheduled_at: b.scheduled_at };
    if (b.status === 'sent') {
      for (const type of ['delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed']) {
        try { row[type] = (await listAll(`/broadcasts/${enc(b.id)}/recipients?type=${type}`, 2000)).length; } catch { row[type] = null; }
      }
    }
    recent.push(row);
  }
  const autos = await listAll<{ id: string; name: string; status: string }>('/automations');
  const automations = Object.fromEntries(WELCOME_VARIANTS.map((v) => [v, autos.find((a) => a.name === automationName(v))?.status ?? 'missing']));
  // Every segment on the Resend account (names only), so the plan's segment limit is easy to sort out.
  const all_segments = (await listAll<{ name: string }>('/segments')).map((x) => x.name);
  return { segments, members: await countMembers(), broadcasts: recent, automations, all_segments };
}
