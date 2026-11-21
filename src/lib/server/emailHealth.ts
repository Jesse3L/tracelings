// Email list health for the owner's daily digest (server only): list size, unsubscribes (with who unsubscribed since
// the last digest), how the recent broadcasts did, and whether the welcome series is switched on.
// Who unsubscribed is worked out by comparing today's unsubscribed contact ids with the last saved snapshot
// (`email-snap/YYYY-MM-DD.json` in the events Blob store: contact ids only, never addresses).
// Never throws: on any Resend or storage problem the digest gets `{ error }` and still sends.
import { rs, listAll, enc, sleep } from './resend';
import { prop, type Contact } from './email';
import { WELCOME_VARIANTS, automationName, SENDING_DOMAIN } from './emailAdmin';
import { readSnapshot, writeSnapshot, listSnapshots, deleteSnapshots } from './events';

export interface BroadcastRow {
  name: string; sentAt: string | null;
  delivered: number | null; opened: number | null; clicked: number | null; unsubscribed: number | null; bounced: number | null;
}
export interface EmailHealth {
  contacts: number; subscribed: number; unsubscribed: number; members: number;
  /** Contacts added on the digest's day (Chicago time). */
  newContacts: number;
  /** Addresses that unsubscribed since the last snapshot; null when there is no earlier snapshot to compare with. */
  newUnsubscribes: string[] | null;
  openTracking: boolean | null;
  clickTracking: boolean | null;
  broadcasts: BroadcastRow[];
  /** Welcome series per interest: 'enabled', 'disabled' or 'missing'. */
  welcome: { variant: string; status: string }[];
  error?: string;
}

const KEEP_SNAPSHOTS_DAYS = 14;
const chicagoDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
const dayOf = (at: unknown) => { const t = Date.parse(String(at ?? '')); return Number.isNaN(t) ? '' : chicagoDay.format(t); };

async function count(path: string): Promise<number | null> {
  try { return (await listAll(path, 5000)).length; } catch { return null; }
}

async function gather(date: string): Promise<EmailHealth> {
  const contacts = await listAll<Contact & { created_at?: string }>('/contacts', 20_000);
  const unsubIds = contacts.filter((c) => c.unsubscribed).map((c) => c.id);
  const members = contacts.filter((c) => prop(c, 'member') === 'true').length;

  // Who unsubscribed since the last snapshot taken before this day.
  let newUnsubscribes: string[] | null = null;
  try {
    const earlier = (await listSnapshots()).filter((d) => d < date).sort();
    const prev = earlier.length ? await readSnapshot(earlier[earlier.length - 1]) : null;
    if (prev) {
      const had = new Set(prev.unsub);
      newUnsubscribes = contacts.filter((c) => c.unsubscribed && !had.has(c.id)).map((c) => c.email);
    }
    await writeSnapshot(date, { unsub: unsubIds });
    const old = earlier.filter((d) => d < new Date(Date.parse(`${date}T00:00:00Z`) - KEEP_SNAPSHOTS_DAYS * 86_400_000).toISOString().slice(0, 10));
    if (old.length) await deleteSnapshots(old);
  } catch (e) { console.error('email snapshot failed', (e as Error).message); }

  let openTracking: boolean | null = null, clickTracking: boolean | null = null;
  try {
    const d = (await listAll<{ id: string; name: string }>('/domains')).find((x) => x.name === SENDING_DOMAIN);
    if (d) { const full = await rs<any>(`/domains/${enc(d.id)}`); openTracking = full.open_tracking === true; clickTracking = full.click_tracking === true; }
  } catch { /* leave unknown */ }

  // The 3 most recent sent broadcasts from the last 30 days, one recipient list per number (spaced for Resend's rate limit).
  const since = Date.now() - 30 * 86_400_000;
  const sentB = (await listAll<any>('/broadcasts', 300).catch(() => []))
    .filter((b) => b.status === 'sent' && Date.parse(b.sent_at ?? '') >= since)
    .sort((a, b) => String(b.sent_at).localeCompare(String(a.sent_at))).slice(0, 3);
  const broadcasts: BroadcastRow[] = [];
  for (const b of sentB) {
    const row: BroadcastRow = { name: String(b.name ?? 'Broadcast'), sentAt: b.sent_at ?? null, delivered: null, opened: null, clicked: null, unsubscribed: null, bounced: null };
    for (const type of ['delivered', 'opened', 'clicked', 'unsubscribed', 'bounced'] as const) {
      if (type === 'opened' && openTracking === false) continue;
      if (type === 'clicked' && clickTracking === false) continue;
      row[type] = await count(`/broadcasts/${enc(b.id)}/recipients?type=${type}`);
      await sleep(300);
    }
    broadcasts.push(row);
  }

  let welcome: { variant: string; status: string }[] = [];
  try {
    const autos = await listAll<{ name: string; status: string }>('/automations');
    welcome = WELCOME_VARIANTS.map((v) => ({ variant: v, status: autos.find((a) => a.name === automationName(v))?.status ?? 'missing' }));
  } catch { /* leave empty */ }

  return {
    contacts: contacts.length, subscribed: contacts.length - unsubIds.length, unsubscribed: unsubIds.length, members,
    newContacts: contacts.filter((c) => dayOf(c.created_at) === date).length,
    newUnsubscribes, openTracking, clickTracking, broadcasts, welcome,
  };
}

/** Email list numbers for a digest day. Resolves within `timeoutMs`; returns `{ error }` instead of throwing. */
export async function emailHealth(date: string, timeoutMs = 45_000): Promise<EmailHealth | { error: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      gather(date),
      new Promise<{ error: string }>((r) => { timer = setTimeout(() => r({ error: 'timed out' }), timeoutMs); }),
    ]);
  } catch (e) {
    console.error('email health failed', (e as Error).message);
    return { error: 'Resend not reachable' };
  } finally { clearTimeout(timer); }
}
