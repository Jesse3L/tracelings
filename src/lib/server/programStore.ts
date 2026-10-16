// Private storage for the personalized program (server only). One JSON doc per paying family in the private
// Vercel Blob store `tracelings-program` (env BLOB_READ_WRITE_TOKEN), keyed by sha256(SESSION_SECRET + lowercase email),
// so the store never holds an email address. It never holds a child's name either: every profile is rebuilt
// field by field from the ChildProfile type, and a request that carries a name-like field is refused.
import { createHash } from 'node:crypto';
import { get, head, put, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob';
import type { ChildProfile, ChildPlan, CheckIn, FamilyDoc, ProgramWeek, SkillId, SkillState, ThemeId, WeekContent } from '../program/types';
import { PLANS as BASE_PLANS, type Level } from '../homeschool';

const env = (k: string): string | undefined => ((import.meta.env ?? {}) as Record<string, string | undefined>)[k] ?? process.env[k];

// ---------- Limits ----------
export const MAX_CHILDREN = 4;
export const MAX_WEEKS = 60;                // a plan is about 36 weeks, plus inserted review weeks
export const MAX_CHECKINS = 400;            // oldest dropped first
export const MAX_DOC_BYTES = 1_500_000;     // cached content for 4 kids x 60 weeks is well under this
export const REDOS_PER_WEEK = 2;
export const FAMILY_MONTHLY_CAP = Number(env('PROGRAM_FAMILY_MONTHLY_MAX') ?? '') || 60;
export const GLOBAL_MONTHLY_CAP = Number(env('PROGRAM_AI_MONTHLY_MAX') ?? '') || 3000;

// ---------- Allowed values (mirror src/lib/program/types.ts) ----------
export const THEME_IDS: readonly ThemeId[] = ['dinosaurs', 'trucks', 'unicorns', 'ocean', 'space', 'farm', 'bugs', 'castles', 'trains', 'sports', 'pets', 'jungle'];
export const SKILL_IDS: readonly SkillId[] = ['name-writing', 'letter-names', 'letter-sounds', 'blending', 'word-families', 'sight-words', 'count-10', 'count-20', 'numerals', 'compare', 'add-5', 'add-10'];
const SKILL_STATES: readonly SkillState[] = ['not-yet', 'learning', 'got-it'];
const LEVELS: readonly Level[] = ['pre-k', 'kindergarten'];
const AGES = [3, 4, 5, 6, 7] as const;
const DAYS = [3, 4, 5] as const;
const MINUTES = [10, 15, 20, 30] as const;
const PROFILE_KEYS = new Set(['id', 'ageYears', 'skills', 'interests', 'daysPerWeek', 'minutesPerDay', 'faith', 'createdAt']);
// Fields that could carry a child's name. Seeing one means a client bug, so the whole request is refused.
const NAME_KEYS = /^(name|names|first_?name|last_?name|full_?name|nick_?name|child_?name|kid_?name|display_?name|label)$/i;

export class InvalidInput extends Error {
  constructor(public code: string) { super(code); }
}

export const childIdOk = (v: unknown): v is string => typeof v === 'string' && /^c_[a-z0-9]{4,24}$/.test(v);
const isoOk = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v));
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T>(list: readonly T[], v: unknown): v is T => list.includes(v as T);

/** Rebuilds a ChildProfile from untrusted input, keeping only known fields. Throws InvalidInput on anything wrong. */
export function cleanProfile(raw: unknown): ChildProfile {
  if (!isObj(raw)) throw new InvalidInput('bad_profile');
  for (const k of Object.keys(raw)) if (NAME_KEYS.test(k)) throw new InvalidInput('name_not_allowed');
  if (!childIdOk(raw.id)) throw new InvalidInput('bad_child_id');
  if (!oneOf(AGES, raw.ageYears)) throw new InvalidInput('bad_age');
  if (!oneOf(DAYS, raw.daysPerWeek)) throw new InvalidInput('bad_days');
  if (!oneOf(MINUTES, raw.minutesPerDay)) throw new InvalidInput('bad_minutes');
  if (typeof raw.faith !== 'boolean') throw new InvalidInput('bad_faith');
  if (!isoOk(raw.createdAt)) throw new InvalidInput('bad_created');
  if (!Array.isArray(raw.interests) || raw.interests.length < 1 || raw.interests.length > 3) throw new InvalidInput('bad_interests');
  const interests: ThemeId[] = [];
  for (const t of raw.interests) {
    if (!oneOf(THEME_IDS, t)) throw new InvalidInput('bad_interests');
    if (!interests.includes(t)) interests.push(t);
  }
  const skills: ChildProfile['skills'] = {};
  if (raw.skills !== undefined) {
    if (!isObj(raw.skills)) throw new InvalidInput('bad_skills');
    for (const [k, v] of Object.entries(raw.skills)) {
      if (!oneOf(SKILL_IDS, k) || !oneOf(SKILL_STATES, v)) throw new InvalidInput('bad_skills');
      skills[k] = v;
    }
  }
  return {
    id: raw.id, ageYears: raw.ageYears, skills, interests,
    daysPerWeek: raw.daysPerWeek, minutesPerDay: raw.minutesPerDay, faith: raw.faith, createdAt: new Date(raw.createdAt).toISOString(),
  };
}
/** True when the input had keys that cleanProfile dropped (reported back so the client can see it). */
export const hadUnknownKeys = (raw: unknown) => isObj(raw) && Object.keys(raw).some((k) => !PROFILE_KEYS.has(k));

/** Rebuilds a ChildPlan from untrusted input. Week numbers must exist in the base plans; themes must be the child's. */
export function cleanPlan(raw: unknown, child: ChildProfile): ChildPlan {
  if (!isObj(raw)) throw new InvalidInput('bad_plan');
  if (raw.childId !== child.id) throw new InvalidInput('bad_plan_child');
  if (!oneOf(LEVELS, raw.level)) throw new InvalidInput('bad_plan_level');
  if (!Array.isArray(raw.weeks) || raw.weeks.length < 1 || raw.weeks.length > MAX_WEEKS) throw new InvalidInput('bad_plan_weeks');
  const weeks: ProgramWeek[] = raw.weeks.map((w: unknown, i: number) => {
    if (!isObj(w)) throw new InvalidInput('bad_plan_week');
    if (w.index !== i + 1) throw new InvalidInput('bad_plan_week_index');
    if (!oneOf(LEVELS, w.level)) throw new InvalidInput('bad_plan_week_level');
    const n = BASE_PLANS[w.level].weeks.length;
    if (!Number.isInteger(w.baseWeek) || (w.baseWeek as number) < 1 || (w.baseWeek as number) > n) throw new InvalidInput('bad_plan_base_week');
    if (!oneOf(THEME_IDS, w.theme)) throw new InvalidInput('bad_plan_theme');
    if (!Array.isArray(w.focus) || w.focus.length > SKILL_IDS.length || !w.focus.every((s) => oneOf(SKILL_IDS, s))) throw new InvalidInput('bad_plan_focus');
    const out: ProgramWeek = { index: i + 1, level: w.level, baseWeek: w.baseWeek as number, theme: w.theme, focus: [...new Set(w.focus as SkillId[])] };
    if (w.extraReview === true) out.extraReview = true;
    // The week's math step (its own track in the engine): a number 1 to 20, or adding within 5 or 10.
    if (w.math !== undefined) {
      if (!isObj(w.math) || Object.keys(w.math).some((k) => k !== 'number' && k !== 'addTo')) throw new InvalidInput('bad_plan_math');
      const { number, addTo } = w.math as { number?: unknown; addTo?: unknown };
      if (addTo !== undefined) {
        if (addTo !== 5 && addTo !== 10) throw new InvalidInput('bad_plan_math');
        out.math = { addTo };
      } else if (number !== undefined) {
        if (!Number.isInteger(number) || (number as number) < 0 || (number as number) > 20) throw new InvalidInput('bad_plan_math');
        out.math = { number: number as number };
      }
    }
    return out;
  });
  if (!Number.isInteger(raw.current) || (raw.current as number) < 1 || (raw.current as number) > weeks.length) throw new InvalidInput('bad_plan_current');
  return { childId: child.id, level: raw.level, weeks, current: raw.current as number };
}

export function cleanCheckIn(raw: unknown, plan: ChildPlan): CheckIn {
  if (!isObj(raw)) throw new InvalidInput('bad_checkin');
  if (raw.childId !== plan.childId) throw new InvalidInput('bad_child_id');
  if (!Number.isInteger(raw.weekIndex) || (raw.weekIndex as number) < 1 || (raw.weekIndex as number) > plan.weeks.length) throw new InvalidInput('bad_week');
  if (!isObj(raw.results)) throw new InvalidInput('bad_results');
  const results: CheckIn['results'] = {};
  for (const [k, v] of Object.entries(raw.results)) {
    if (!oneOf(SKILL_IDS, k) || (v !== 'got-it' && v !== 'still-working')) throw new InvalidInput('bad_results');
    results[k] = v;
  }
  if (!Object.keys(results).length) throw new InvalidInput('empty_results');
  return { childId: plan.childId, weekIndex: raw.weekIndex as number, results, at: new Date().toISOString() };
}

// ---------- Keys ----------
export const weekKey = (childId: string, weekIndex: number) => `${childId}:${weekIndex}`;
export const monthNow = () => new Date().toISOString().slice(0, 7);

export function familyKey(email: string): string {
  const secret = env('SESSION_SECRET');
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET missing');
  return createHash('sha256').update(secret + email.trim().toLowerCase()).digest('hex');
}

export const emptyFamily = (): FamilyDoc => ({ children: [], plans: {}, checkIns: [], content: {}, usage: { month: monthNow(), generations: 0, redos: {} } });

/** Fills missing parts of a stored doc and resets the monthly count when the month changes. */
function normalize(d: Partial<FamilyDoc> | null): FamilyDoc {
  const base = emptyFamily();
  if (!d || typeof d !== 'object') return base;
  const usage = { ...base.usage, ...(d.usage ?? {}) };
  if (usage.month !== monthNow()) { usage.month = monthNow(); usage.generations = 0; }
  usage.redos ??= {};
  return { children: d.children ?? [], plans: d.plans ?? {}, checkIns: d.checkIns ?? [], content: d.content ?? {}, usage };
}

// ---------- Backend (Vercel Blob in production; memory when no token outside production, and in tests) ----------
export interface Backend {
  read(path: string): Promise<{ text: string; etag: string } | null>;
  /** ifMatch: the etag read before (write only if unchanged). Undefined: create only (fail if it exists). Throws Conflict. */
  write(path: string, text: string, ifMatch?: string): Promise<void>;
}
export class Conflict extends Error {}

const blobBackend: Backend = {
  async read(path) {
    // The etag must come from the Blob API (head), the same source put() checks ifMatch against. The ETag header on
    // the download response is the CDN's and never matches, so every conditional write failed as "stale".
    let meta;
    try { meta = await head(path); } catch (e) { if (e instanceof BlobNotFoundError) return null; throw e; }
    const r = await get(path, { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return { text: await new Response(r.stream).text(), etag: meta.etag };
  },
  async write(path, text, ifMatch) {
    try {
      await put(path, text, { access: 'private', contentType: 'application/json', addRandomSuffix: false, cacheControlMaxAge: 60,
        ...(ifMatch ? { allowOverwrite: true, ifMatch } : { allowOverwrite: false }) });
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) throw new Conflict('stale');
      // A create-only write that lost the race: the blob exists now, so read it again and retry.
      if (!ifMatch && (await blobBackend.read(path).catch(() => null))) throw new Conflict('exists');
      throw e;
    }
  },
};

export function memoryBackend(): Backend {
  const m = new Map<string, { text: string; etag: string }>();
  let n = 0;
  return {
    async read(path) { return m.get(path) ?? null; },
    async write(path, text, ifMatch) {
      const cur = m.get(path);
      if (ifMatch ? !cur || cur.etag !== ifMatch : cur) throw new Conflict('stale');
      m.set(path, { text, etag: `e${++n}` });
    },
  };
}

let backend: Backend | null = null;
export function setBackend(b: Backend | null) { backend = b; }
export const storeConfigured = () => Boolean(backend || env('BLOB_READ_WRITE_TOKEN') || env('VERCEL_ENV') !== 'production');
function store(): Backend {
  if (backend) return backend;
  if (env('BLOB_READ_WRITE_TOKEN')) return (backend = blobBackend);
  if (env('VERCEL_ENV') === 'production') throw new Error('BLOB_READ_WRITE_TOKEN missing');
  console.warn('programStore: no BLOB_READ_WRITE_TOKEN, using memory storage (local only)');
  return (backend = memoryBackend());
}

const familyPath = (key: string) => `families/${key}.json`;
const globalPath = (month: string) => `usage/global-${month}.json`;

export async function loadFamily(key: string): Promise<{ doc: FamilyDoc; etag?: string }> {
  const r = await store().read(familyPath(key));
  if (!r) return { doc: emptyFamily() };
  let parsed: Partial<FamilyDoc> | null = null;
  try { parsed = JSON.parse(r.text); } catch { console.error('programStore: unreadable family doc'); }
  return { doc: normalize(parsed), etag: r.etag };
}

/** Read, change and write a family doc. Retries when another request wrote it in between. */
export async function updateFamily<T>(key: string, change: (doc: FamilyDoc) => T | Promise<T>): Promise<{ doc: FamilyDoc; result: T }> {
  for (let attempt = 0; ; attempt++) {
    const { doc, etag } = await loadFamily(key);
    const result = await change(doc);
    if (doc.checkIns.length > MAX_CHECKINS) doc.checkIns = doc.checkIns.slice(-MAX_CHECKINS);
    const text = JSON.stringify(doc);
    if (text.length > MAX_DOC_BYTES) throw new InvalidInput('too_large');
    try {
      await store().write(familyPath(key), text, etag);
      return { doc, result };
    } catch (e) {
      if (e instanceof Conflict && attempt < 5) { await new Promise((r) => setTimeout(r, 20 + Math.random() * 80)); continue; }
      throw e;
    }
  }
}

// ---------- Global monthly AI guard ----------
// One small counter blob per month. Read-modify-write with an etag check; under heavy races it can overshoot by a
// few calls, which is fine for a spend guard (the Anthropic console spend limit is the hard stop).
export async function reserveGlobalAi(): Promise<boolean> {
  const path = globalPath(monthNow());
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await store().read(path);
    let count = 0;
    try { count = r ? Number(JSON.parse(r.text).count) || 0 : 0; } catch { count = 0; }
    if (count >= GLOBAL_MONTHLY_CAP) return false;
    try {
      await store().write(path, JSON.stringify({ count: count + 1, updatedAt: new Date().toISOString() }), r?.etag);
      return true;
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
    }
  }
  return false; // too much contention: play safe and use a template
}

export async function globalAiCount(): Promise<number> {
  const r = await store().read(globalPath(monthNow()));
  try { return r ? Number(JSON.parse(r.text).count) || 0 : 0; } catch { return 0; }
}

/** The keys of cached content, for the dashboard (not the content itself). */
export const cachedKeys = (doc: FamilyDoc) => Object.keys(doc.content);
export type { WeekContent };
