// Small private records for the owner's daily digest (server only), one JSON blob per event in the private Vercel
// Blob store (env BLOB_READ_WRITE_TOKEN, the same store as programStore):
//   events/YYYY-MM-DD/<ts>-<rand>.json     a download: { at, path, what, pages, member, vid, place }
//   signups/YYYY-MM-DD/<ts>-<rand>.json    an email sign-up: { at, email, source }
//   checkouts/YYYY-MM-DD/<ts>-<rand>.json  a checkout start: { at, plan }
// The date is the America/Chicago calendar day. Downloads never hold a name or anything typed: `what` is checked
// against lib/what.ts and `vid` is a random device code. Writes never slow or break a request: recordEvent() always
// resolves, within RECORD_TIMEOUT_MS, and swallows every error.
import { randomBytes } from 'node:crypto';
import { put, list, get, del } from '@vercel/blob';

const env = (k: string): string | undefined => ((import.meta.env ?? {}) as Record<string, string | undefined>)[k] ?? process.env[k];

export const RECORD_TIMEOUT_MS = 1500;
export const KEEP_DAYS = 35;
export type Kind = 'events' | 'signups' | 'checkouts';
export const KINDS: readonly Kind[] = ['events', 'signups', 'checkouts'];

export interface DownloadEvent { at: string; path: string; what: string | null; pages: number | null; member: boolean; vid: string | null; place: string | null }
export interface SignupEvent { at: string; email: string; source: string }
export interface CheckoutEvent { at: string; plan: string }

// ---------- Chicago dates ----------
const chicago = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
/** 'YYYY-MM-DD' of a moment, on the America/Chicago calendar. */
export const chicagoDate = (at: Date | number = Date.now()) => chicago.format(typeof at === 'number' ? new Date(at) : at);
export const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
/** Calendar arithmetic on 'YYYY-MM-DD' (no time zone involved). */
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** Yesterday in Chicago, for a cron that runs early in the morning. */
export const chicagoYesterday = (now: Date | number = Date.now()) => addDays(chicagoDate(now), -1);

// ---------- Storage backend (Vercel Blob in production; memory when no token outside production, and in tests) ----------
export interface EventStore {
  put(path: string, text: string): Promise<void>;
  /** Every pathname under a prefix. */
  list(prefix: string): Promise<string[]>;
  /** The top-level "folders" under a prefix, e.g. 'events/2026-10-23/'. */
  folders(prefix: string): Promise<string[]>;
  read(path: string): Promise<string | null>;
  del(paths: string[]): Promise<void>;
}

const blobStore: EventStore = {
  async put(path, text) {
    await put(path, text, { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: false });
  },
  async list(prefix) {
    const out: string[] = [];
    let cursor: string | undefined;
    do {
      const r = await list({ prefix, cursor, limit: 1000 });
      out.push(...r.blobs.map((b) => b.pathname));
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor && out.length < 20_000);
    return out;
  },
  async folders(prefix) {
    const out: string[] = [];
    let cursor: string | undefined;
    do {
      const r = await list({ prefix, cursor, limit: 1000, mode: 'folded' });
      out.push(...r.folders);
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return out;
  },
  async read(path) {
    const r = await get(path, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return await new Response(r.stream).text();
  },
  async del(paths) {
    for (let i = 0; i < paths.length; i += 500) await del(paths.slice(i, i + 500));
  },
};

export function memoryStore(): EventStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async put(path, text) { if (data.has(path)) throw new Error('exists'); data.set(path, text); },
    async list(prefix) { return [...data.keys()].filter((k) => k.startsWith(prefix)).sort(); },
    async folders(prefix) {
      const set = new Set<string>();
      for (const k of data.keys()) if (k.startsWith(prefix)) { const rest = k.slice(prefix.length); const i = rest.indexOf('/'); if (i >= 0) set.add(prefix + rest.slice(0, i + 1)); }
      return [...set].sort();
    },
    async read(path) { return data.get(path) ?? null; },
    async del(paths) { for (const p of paths) data.delete(p); },
  };
}

let store: EventStore | null = null;
export function setEventStore(s: EventStore | null) { store = s; }
function current(): EventStore | null {
  if (store) return store;
  if (env('BLOB_READ_WRITE_TOKEN')) return (store = blobStore);
  if (env('VERCEL_ENV') === 'production') return null; // not configured: records are skipped, nothing breaks
  return (store = memoryStore());
}
export const eventsConfigured = () => Boolean(store || env('BLOB_READ_WRITE_TOKEN') || env('VERCEL_ENV') !== 'production');

// ---------- Writing ----------
const pathFor = (kind: Kind, at: Date) => `${kind}/${chicagoDate(at)}/${at.getTime()}-${randomBytes(4).toString('hex')}.json`;

/** Saves one record. Always resolves (true when saved), never throws, never takes longer than the timeout. */
export function recordEvent(kind: 'events', data: Omit<DownloadEvent, 'at'>, timeoutMs?: number): Promise<boolean>;
export function recordEvent(kind: 'signups', data: Omit<SignupEvent, 'at'>, timeoutMs?: number): Promise<boolean>;
export function recordEvent(kind: 'checkouts', data: Omit<CheckoutEvent, 'at'>, timeoutMs?: number): Promise<boolean>;
export function recordEvent(kind: Kind, data: Record<string, unknown>, timeoutMs = RECORD_TIMEOUT_MS): Promise<boolean> {
  try {
    const s = current();
    if (!s) return Promise.resolve(false);
    const at = new Date();
    const write = s.put(pathFor(kind, at), JSON.stringify({ at: at.toISOString(), ...data })).then(() => true, (e) => {
      console.error('event record failed', kind, (e as Error)?.name ?? 'error');
      return false;
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<boolean>((r) => { timer = setTimeout(() => r(false), timeoutMs); });
    return Promise.race([write, late]).finally(() => clearTimeout(timer));
  } catch {
    return Promise.resolve(false);
  }
}

// ---------- Reading ----------
async function readAll<T>(s: EventStore, prefix: string): Promise<T[]> {
  const paths = await s.list(prefix);
  const out: T[] = [];
  for (let i = 0; i < paths.length; i += 16) {
    const texts = await Promise.all(paths.slice(i, i + 16).map((p) => s.read(p).catch(() => null)));
    for (const t of texts) { if (!t) continue; try { out.push(JSON.parse(t)); } catch { /* skip a broken record */ } }
  }
  return out.sort((a: any, b: any) => String(a.at).localeCompare(String(b.at)));
}

export interface DayRecords { date: string; events: DownloadEvent[]; signups: SignupEvent[]; checkouts: CheckoutEvent[] }

export async function loadDay(date: string): Promise<DayRecords> {
  const s = current();
  if (!s) throw new Error('BLOB_READ_WRITE_TOKEN missing');
  const [events, signups, checkouts] = await Promise.all([
    readAll<DownloadEvent>(s, `events/${date}/`), readAll<SignupEvent>(s, `signups/${date}/`), readAll<CheckoutEvent>(s, `checkouts/${date}/`),
  ]);
  return { date, events, signups, checkouts };
}

/** Deletes every record of a day before `today - KEEP_DAYS` (all three kinds). Returns how many blobs went. */
export async function pruneOld(today = chicagoDate(), keepDays = KEEP_DAYS): Promise<number> {
  const s = current();
  if (!s) return 0;
  const cutoff = addDays(today, -keepDays);
  let n = 0;
  for (const kind of KINDS) {
    const old = (await s.folders(`${kind}/`)).filter((f) => { const d = f.slice(kind.length + 1, kind.length + 11); return isDate(d) && d < cutoff; });
    for (const f of old) {
      const paths = await s.list(f);
      if (paths.length) { await s.del(paths); n += paths.length; }
    }
  }
  return n;
}
