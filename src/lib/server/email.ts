// Email list on Resend: sign-ups, imports and member tagging. Server only. Every function here is best effort
// for the site: callers on the download path and the member path never wait on Resend for long and never fail
// because of it. Logs never include an email address.
import { rs, listAll, resendConfigured, isNotFound, ResendError, enc } from './resend';
import { SEGMENTS, type SegmentKey, segmentsFor, interestFor, isTeacher, welcomeEvent, today } from '../email/audience';

export { resendConfigured };

// ---------- segment ids (looked up by name, cached per instance) ----------
let segCache: { at: number; ids: Partial<Record<SegmentKey, string>> } | null = null;
export async function segmentIds(fresh = false): Promise<Partial<Record<SegmentKey, string>>> {
  if (!fresh && segCache && Date.now() - segCache.at < 10 * 60_000) return segCache.ids;
  const list = await listAll<{ id: string; name: string }>('/segments');
  const ids: Partial<Record<SegmentKey, string>> = {};
  for (const k of Object.keys(SEGMENTS) as SegmentKey[]) {
    const hit = list.find((s) => s.name === SEGMENTS[k]);
    if (hit) ids[k] = hit.id;
  }
  segCache = { at: Date.now(), ids };
  return ids;
}
export const _resetEmailCache = () => { segCache = null; };

export interface Contact { id: string; email: string; unsubscribed: boolean; properties?: Record<string, unknown> }

export async function getContact(email: string, timeoutMs?: number): Promise<Contact | null> {
  try {
    return await rs<Contact>(`/contacts/${enc(email)}`, { timeoutMs });
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

/** A contact property value, whether Resend returns it plain or as { value, type }. */
export function prop(c: Contact | null, key: string): string | undefined {
  const v = c?.properties?.[key] as any;
  if (v == null) return undefined;
  return typeof v === 'object' && 'value' in v ? String(v.value) : String(v);
}

interface NewContact { email: string; source: string; role?: string; signupDate?: string; segmentSource?: string }

/** Creates a contact. Returns its id, or null when it already exists (a race with another request). */
async function createContact(c: NewContact, timeoutMs?: number): Promise<string | null> {
  const segSource = c.segmentSource ?? c.source;
  const teacher = isTeacher(c.email, segSource, c.role);
  const ids = await segmentIds();
  const segments = segmentsFor(c.email, segSource, c.role).map((k) => ids[k]).filter(Boolean).map((id) => ({ id: id! }));
  try {
    const r = await rs<{ id: string }>('/contacts', {
      timeoutMs,
      body: {
        email: c.email,
        unsubscribed: false,
        properties: {
          source: c.source,
          signup_date: c.signupDate ?? today(),
          member: 'false',
          interest: interestFor(segSource),
          audience: teacher ? 'teacher' : 'family',
        },
        ...(segments.length ? { segments } : {}),
      },
    });
    return r.id;
  } catch (e) {
    if (e instanceof ResendError && (e.status === 409 || (e.status === 422 && /exist/i.test(e.message)))) return null;
    throw e;
  }
}

export type SignupResult = { saved: boolean; created: boolean; welcome: boolean };

/**
 * A new download sign-up: creates the contact (source, signup_date, segments) and starts the welcome series.
 * An existing contact is left exactly as it is: never re-subscribed, never sent the welcome series again.
 */
export async function addSignup(email: string, source: string, role?: string): Promise<SignupResult> {
  if (!resendConfigured()) return { saved: false, created: false, welcome: false };
  try {
    const existing = await getContact(email, 4000);
    if (existing) return { saved: true, created: false, welcome: false };
    const id = await createContact({ email, source, role }, 4000);
    if (!id) return { saved: true, created: false, welcome: false };
    const variant = isTeacher(email, source, role) ? 'teacher' : interestFor(source);
    try {
      await rs('/events/send', { timeoutMs: 4000, body: { event: welcomeEvent(variant), contact_id: id, payload: { source } } });
      return { saved: true, created: true, welcome: true };
    } catch {
      console.error('resend: welcome event failed');
      return { saved: true, created: true, welcome: false };
    }
  } catch (e) {
    console.error('resend: sign-up not saved', (e as ResendError).status ?? '');
    return { saved: false, created: false, welcome: false };
  }
}

export interface ImportItem { email: string; source?: string; role?: string; date?: string }
export interface ImportResult { received: number; valid: number; created: number; existing: number; unsubscribed: number; invalid: number; failed: number }

/**
 * Imports the existing list. Every new contact gets source = `importSource` (default 'import-oct-2026'), with the
 * original sign-up source (when given) used only to pick segments. Existing contacts are skipped untouched, so an
 * unsubscribed address is never re-subscribed. Imports never start the welcome series.
 */
export async function importContacts(items: ImportItem[], importSource: string, cleanEmail: (v: unknown) => string, pauseMs = 120): Promise<ImportResult> {
  const seen = new Set<string>();
  const list: ImportItem[] = [];
  let invalid = 0;
  for (const it of items) {
    const email = cleanEmail(it.email);
    if (!email) { invalid++; continue; }
    if (seen.has(email)) continue;
    seen.add(email);
    list.push({ ...it, email });
  }
  const out: ImportResult = { received: items.length, valid: list.length, created: 0, existing: 0, unsubscribed: 0, invalid, failed: 0 };
  await segmentIds(true);
  for (const it of list) {
    try {
      const c = await getContact(it.email);
      if (c) { if (c.unsubscribed) out.unsubscribed++; else out.existing++; }
      else {
        const date = typeof it.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(it.date) && !Number.isNaN(Date.parse(it.date)) ? it.date.slice(0, 10) : undefined;
        const src = typeof it.source === 'string' && /^[a-z0-9-]{2,40}$/.test(it.source) ? it.source : undefined;
        const role = typeof it.role === 'string' ? it.role : undefined;
        const id = await createContact({ email: it.email, source: importSource, segmentSource: src ?? importSource, role, signupDate: date });
        if (id) out.created++; else out.existing++;
      }
    } catch {
      out.failed++;
    }
    if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
  }
  return out;
}

// ---------- members ----------
const tagged = new Map<string, number>();
/**
 * Marks an existing contact as a member (member = 'true', into `members`, out of `prospects`), which also stops the
 * welcome series at its next step. Never creates a contact (members who never joined the list stay off it).
 * Throttled per instance; never throws.
 */
export async function markMember(email: string, timeoutMs = 2500): Promise<'tagged' | 'missing' | 'skipped' | 'failed'> {
  if (!resendConfigured() || !email) return 'skipped';
  const last = tagged.get(email);
  if (last && Date.now() - last < 6 * 3600_000) return 'skipped';
  tagged.set(email, Date.now());
  if (tagged.size > 2000) for (const [k, t] of tagged) if (Date.now() - t > 6 * 3600_000) tagged.delete(k);
  try {
    const c = await getContact(email, timeoutMs);
    if (!c) return 'missing';
    if (prop(c, 'member') !== 'true') await rs(`/contacts/${enc(c.id)}`, { method: 'PATCH', timeoutMs, body: { properties: { member: 'true' } } });
    const ids = await segmentIds();
    if (ids.prospects) await rs(`/contacts/${enc(c.id)}/segments/${enc(ids.prospects)}`, { method: 'DELETE', timeoutMs }).catch(() => {});
    return 'tagged';
  } catch {
    tagged.delete(email);
    console.error('resend: member tag failed');
    return 'failed';
  }
}

export interface BackfillResult { checked: number; eligible: number; started: number; failed: number; dry_run: boolean }

/**
 * Starts the welcome series for sign-ups that arrived while the automations were switched off. Picks contacts that
 * signed up on the site (not the import) on or after `since`, are subscribed, not members, and have never started or
 * finished the series (welcome_status 'none'). Marks each with welcome_status 'started' so a second run skips them.
 */
export async function welcomeBackfill(since: string, dryRun: boolean): Promise<BackfillResult> {
  const all = await listAll<Contact & { id: string; email: string; unsubscribed?: boolean }>('/contacts', 5000);
  const out: BackfillResult = { checked: all.length, eligible: 0, started: 0, failed: 0, dry_run: dryRun };
  for (const listed of all) {
    // The list endpoint may leave out properties; fetch the full contact when it does.
    const c = listed.properties ? listed : ((await rs<any>(`/contacts/${enc(listed.id)}`).catch(() => null)) ?? listed);
    const source = prop(c, 'source') ?? '';
    const status = prop(c, 'welcome_status') ?? 'none';
    const date = prop(c, 'signup_date') ?? '';
    if (c.unsubscribed || !source || source.startsWith('import') || prop(c, 'member') === 'true') continue;
    if (status !== 'none' || !date || date < since) continue;
    out.eligible++;
    if (dryRun) continue;
    const variant = prop(c, 'audience') === 'teacher' ? 'teacher' : (prop(c, 'interest') as any) ?? interestFor(source);
    try {
      await rs(`/contacts/${enc(c.id)}`, { method: 'PATCH', body: { properties: { welcome_status: 'started' } } });
      await rs('/events/send', { body: { event: welcomeEvent(variant), contact_id: c.id, payload: { source } } });
      out.started++;
    } catch { out.failed++; }
    await new Promise((r) => setTimeout(r, 150));
  }
  return out;
}
