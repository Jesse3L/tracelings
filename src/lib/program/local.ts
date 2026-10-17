// The personalized program's data on this device (localStorage key "tl-program").
// Child profiles (no names) can also be saved to the server by Part B; names are only ever stored here.
import type { ChildProfile, SkillId, SkillState, ThemeId } from './types';
import { THEME_IDS } from './themes';

export const PROGRAM_KEY = 'tl-program';

export interface LocalProgram {
  children: ChildProfile[];
  names: Record<string, string>; // childId -> first name, this device only
}

const empty = (): LocalProgram => ({ children: [], names: {} });

const SKILLS: SkillId[] = ['name-writing', 'letter-names', 'letter-sounds', 'blending', 'word-families', 'sight-words', 'count-10', 'count-20', 'numerals', 'compare', 'add-5', 'add-10'];
const STATES: SkillState[] = ['not-yet', 'learning', 'got-it'];

/** Checks and cleans a stored profile; anything odd is dropped rather than trusted. */
export function cleanProfile(raw: unknown): ChildProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !/^c_[a-z0-9]{4,16}$/.test(r.id)) return null;
  const age = Number(r.ageYears);
  if (![3, 4, 5, 6, 7].includes(age)) return null;
  const skills: ChildProfile['skills'] = {};
  if (r.skills && typeof r.skills === 'object') {
    for (const [k, v] of Object.entries(r.skills as Record<string, unknown>)) {
      if (SKILLS.includes(k as SkillId) && STATES.includes(v as SkillState)) skills[k as SkillId] = v as SkillState;
    }
  }
  const interests = (Array.isArray(r.interests) ? r.interests : []).filter((t): t is ThemeId => THEME_IDS.includes(t as ThemeId)).slice(0, 3);
  if (!interests.length) return null;
  const days = Number(r.daysPerWeek), mins = Number(r.minutesPerDay);
  return {
    id: r.id,
    ageYears: age as ChildProfile['ageYears'],
    skills,
    interests,
    daysPerWeek: ([3, 4, 5].includes(days) ? days : 5) as ChildProfile['daysPerWeek'],
    minutesPerDay: ([10, 15, 20, 30].includes(mins) ? mins : 15) as ChildProfile['minutesPerDay'],
    faith: r.faith === true,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt.slice(0, 32) : new Date().toISOString(),
  };
}

/** Most kids kept on one device. Higher than the account's 4 so a profile not yet saved never pushes out a saved one. */
export const MAX_LOCAL_CHILDREN = 8;

const dedupe = (list: ChildProfile[]) => list.filter((c, i) => list.findIndex((x) => x.id === c.id) === i);

export function loadLocalProgram(): LocalProgram {
  try {
    const raw = localStorage.getItem(PROGRAM_KEY);
    if (!raw) return empty();
    const data = JSON.parse(raw) as Partial<LocalProgram>;
    const children = dedupe((Array.isArray(data.children) ? data.children : []).map(cleanProfile).filter((c): c is ChildProfile => !!c));
    // Names are keyed by child id. Keep every non-empty name for a child we still have.
    const names: Record<string, string> = {};
    for (const c of children) {
      const n = data.names?.[c.id];
      if (typeof n === 'string' && n.trim()) names[c.id] = n.slice(0, 24);
    }
    return { children, names };
  } catch {
    return empty();
  }
}

/**
 * Saves the device's kids and names. `keep` lists child ids that must never be dropped (the ones on the account):
 * past MAX_LOCAL_CHILDREN the oldest profiles not in `keep` go first, never a kept one, so a name for a child
 * who is on the account is never lost.
 */
export function saveLocalProgram(p: LocalProgram, keep: string[] = []): void {
  let children = dedupe(p.children);
  while (children.length > MAX_LOCAL_CHILDREN) {
    const i = children.findIndex((c) => !keep.includes(c.id));
    if (i < 0) break;
    children = children.filter((_, j) => j !== i);
  }
  const names: Record<string, string> = {};
  for (const c of children) {
    const n = p.names[c.id];
    if (typeof n === 'string' && n.trim()) names[c.id] = n.slice(0, 24);
  }
  try { localStorage.setItem(PROGRAM_KEY, JSON.stringify({ children, names })); } catch { /* storage unavailable */ }
}

/** Adds or replaces one child (by id), and their name on this device. An empty name removes the stored name. */
export function upsertLocalChild(profile: ChildProfile, name?: string, keep: string[] = []): LocalProgram {
  const cur = loadLocalProgram();
  const i = cur.children.findIndex((c) => c.id === profile.id);
  const children = i >= 0 ? cur.children.map((c, j) => (j === i ? profile : c)) : [...cur.children, profile];
  const names = { ...cur.names };
  if (name !== undefined) {
    const clean = name.replace(/\s+/g, ' ').trim().slice(0, 24);
    if (clean) names[profile.id] = clean;
    else delete names[profile.id];
  }
  saveLocalProgram({ children, names }, [profile.id, ...keep]);
  return loadLocalProgram();
}

/** Removes children and their names from this device entirely (no blank stub left behind). */
export function removeLocalChildren(ids: string[]): LocalProgram {
  const cur = loadLocalProgram();
  const next = { children: cur.children.filter((c) => !ids.includes(c.id)), names: Object.fromEntries(Object.entries(cur.names).filter(([k]) => !ids.includes(k))) };
  saveLocalProgram(next);
  return next;
}

/** Forgets every child and name on this device (sign-out with "Also remove kids' names from this device"). */
export function clearLocalProgram(): void {
  try { localStorage.removeItem(PROGRAM_KEY); } catch { /* storage unavailable */ }
}

/** A random child id made in the browser, e.g. "c_8f2k1x". */
export function newChildId(): string {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  const rnd = typeof crypto !== 'undefined' && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(8)) : Uint8Array.from({ length: 8 }, () => Math.floor(Math.random() * 256));
  for (const b of rnd) s += abc[b % abc.length];
  return `c_${s}`;
}
