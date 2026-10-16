// Placement and the rules engine for the personalized program (see docs/program-plan.md).
// Pure and deterministic: the same profile always gives the same plan. No names, no dates, no randomness.
//
// A plan is built from the existing free 36-week plans (PLANS in homeschool.ts):
// - placement picks Pre-K or Kindergarten from age plus what the child can already do;
// - weeks that teach skills the child already has ("got it") are skipped;
// - extra review weeks go in where a skill is "learning";
// - math runs on its own track, so a child who counts to 20 isn't held to "the number 3" just because
//   they're on an early letter week (ProgramWeek.math);
// - the theme rotates week by week through the child's interests;
// - pace (days per week, minutes per day) only changes how pages are spread over the days, never the order.
import { PLANS, LETTER_ORDER, type Level, type Week } from '../homeschool';
import type { ChildProfile, ChildPlan, CheckIn, ProgramWeek, SkillId, SkillState, ThemeId } from './types';

/** Target plan length. Skips can make a plan shorter; review weeks can make it a little longer. */
export const PLAN_WEEKS = 36;
const MAX_WEEKS = 40;

export const SKILL_LABELS: Record<SkillId, { label: string; parent: string }> = {
  'name-writing': { label: 'Writes their name', parent: 'Writes their own first name (wobbly is fine)' },
  'letter-names': { label: 'Letter names', parent: 'Names most capital and lowercase letters' },
  'letter-sounds': { label: 'Letter sounds', parent: 'Knows the sound most letters make (s says /s/)' },
  blending: { label: 'Blending', parent: 'Can blend sounds into a short word (c-a-t, cat)' },
  'word-families': { label: 'Word families', parent: 'Reads short word families like cat, hat, mat' },
  'sight-words': { label: 'Sight words', parent: 'Reads a few sight words like the, and, see' },
  'count-10': { label: 'Counting to 10', parent: 'Counts 10 objects, touching each one once' },
  'count-20': { label: 'Counting to 20', parent: 'Counts 20 objects, touching each one once' },
  numerals: { label: 'Numbers', parent: 'Recognizes and writes the numbers 1 to 10' },
  compare: { label: 'More or less', parent: 'Can tell which group has more' },
  'add-5': { label: 'Adding within 5', parent: 'Adds small numbers, like 2 and 3, with fingers or objects' },
  'add-10': { label: 'Adding within 10', parent: 'Adds numbers up to 10, like 4 and 5' },
};
export const SKILL_ORDER: SkillId[] = ['name-writing', 'letter-names', 'letter-sounds', 'blending', 'word-families', 'sight-words', 'count-10', 'count-20', 'numerals', 'compare', 'add-5', 'add-10'];

const st = (p: ChildProfile, s: SkillId): SkillState => p.skills[s] ?? 'not-yet';
const got = (p: ChildProfile, s: SkillId) => st(p, s) === 'got-it';
const learning = (p: ChildProfile, s: SkillId) => st(p, s) === 'learning';

// ---------- Level ----------

/** Pre-K or Kindergarten. Age is a starting point; what the child can do moves them. */
export function placeLevel(p: ChildProfile): Level {
  const letters = got(p, 'letter-names') ? 2 : learning(p, 'letter-names') ? 1 : 0;
  const sounds = got(p, 'letter-sounds') ? 2 : learning(p, 'letter-sounds') ? 1 : 0;
  const reading = (got(p, 'blending') ? 1 : 0) + (got(p, 'word-families') ? 1 : 0) + (st(p, 'sight-words') !== 'not-yet' ? 1 : 0);
  const math = (got(p, 'count-10') ? 1 : 0) + (got(p, 'numerals') ? 1 : 0) + (st(p, 'add-5') !== 'not-yet' ? 1 : 0);
  const score = letters + sounds + reading + math;
  if (p.ageYears <= 3) return letters === 2 && sounds === 2 ? 'kindergarten' : 'pre-k';
  if (p.ageYears === 4) return letters === 2 && sounds >= 1 && score >= 6 ? 'kindergarten' : 'pre-k';
  if (p.ageYears === 5) return letters >= 1 || score >= 3 ? 'kindergarten' : 'pre-k';
  return letters === 0 && sounds === 0 && score <= 1 ? 'pre-k' : 'kindergarten';
}

// ---------- Skills a base week teaches ----------

/** Literacy skills a base week works on (math is added from the math track). */
export function literacyFocus(level: Level, w: Week): SkillId[] {
  if (w.kind === 'name') return ['name-writing', ...(level === 'kindergarten' ? ['sight-words' as const] : [])];
  if (level === 'pre-k') return w.kind === 'letter' ? ['letter-names', 'letter-sounds'] : ['letter-names', 'letter-sounds'];
  if (w.kind === 'letter') return ['letter-sounds', 'letter-names', 'sight-words'];
  if (w.kind === 'family') return ['blending', 'word-families', 'sight-words'];
  return ['word-families', 'blending'];
}

// ---------- Math track ----------

export interface MathStep { number?: number; addTo?: 5 | 10 }

const mathSkills = (m: MathStep): SkillId[] => m.addTo === 10 ? ['add-10'] : m.addTo === 5 ? ['add-5', 'compare'] : m.number! > 10 ? ['count-20', 'numerals', 'compare'] : m.number! >= 5 ? ['count-10', 'numerals', 'compare'] : ['count-10', 'numerals'];

/** The ordered math steps for a level, starting where the child is. One step per plan week; steps repeat when the plan runs longer. */
export function mathSteps(level: Level, p: ChildProfile): MathStep[] {
  // Number 0 (Kindergarten week 1) is left out: the themed counting pages start at 1.
  const base: MathStep[] = PLANS[level].weeks.filter((w) => w.number !== 0).map((w) => (w.addTo ? { addTo: w.addTo } : { number: w.number ?? 1 }));
  // Pre-K only goes to 20 in the free plan; children who already count well go on to adding within 5.
  if (level === 'pre-k') for (let i = 0; i < 8; i++) base.push({ addTo: 5 });
  let start = 0;
  const idxOf = (pred: (m: MathStep) => boolean) => { const i = base.findIndex(pred); return i < 0 ? base.length - 1 : i; };
  if (got(p, 'count-10') && got(p, 'numerals')) start = idxOf((m) => (m.number ?? 99) >= 11 || !!m.addTo);
  if (got(p, 'count-20') && got(p, 'numerals')) start = Math.max(start, idxOf((m) => !!m.addTo));
  if (got(p, 'add-5')) start = Math.max(start, idxOf((m) => m.addTo === 10));
  let steps = base.slice(start);
  // Still learning: hold each early step a second week.
  const hold = (pred: (m: MathStep) => boolean) => { steps = steps.flatMap((m) => (pred(m) ? [m, m] : [m])).slice(0, base.length + 8); };
  if (learning(p, 'count-10')) hold((m) => (m.number ?? 99) <= 5);
  if (learning(p, 'add-5')) hold((m) => m.addTo === 5);
  if (!steps.length) steps = [base[base.length - 1]];
  return steps;
}

// ---------- Plan ----------

type Draft = Omit<ProgramWeek, 'index' | 'theme' | 'focus'> & { lit: SkillId[] };

/** Base weeks the child already has. */
function skipped(level: Level, w: Week, p: ChildProfile): boolean {
  if (w.kind === 'name') return got(p, 'name-writing');
  if (level === 'pre-k') {
    // A Pre-K child who already names and sounds out letters keeps only the review weeks, as a quick check.
    if (got(p, 'letter-names') && got(p, 'letter-sounds')) return w.kind === 'letter';
    return false;
  }
  if (w.kind === 'letter') return got(p, 'letter-sounds') && got(p, 'letter-names');
  if (w.kind === 'family' && got(p, 'word-families') && got(p, 'blending')) {
    // Reads word families already: keep one family per vowel plus the vowel reviews.
    const fams = PLANS.kindergarten.weeks.filter((x) => x.kind === 'family' && x.family![0] === w.family![0]);
    return fams[0].n !== w.n;
  }
  return false;
}

/** Where extra review weeks go for skills that are still "learning". */
function reviewAfter(level: Level, w: Week, p: ChildProfile): boolean {
  if (level === 'pre-k') {
    if (w.kind !== 'review') return false;
    const shaky = learning(p, 'letter-names') || learning(p, 'letter-sounds');
    // After the 2nd, 4th and 6th review weeks (weeks 9, 17, 25): a breather every couple of months.
    return shaky && [9, 17, 25].includes(w.n);
  }
  if (w.kind === 'letter') return learning(p, 'letter-sounds') && [5, 9, 13].includes(w.n);
  if (w.kind === 'vowel-review') return learning(p, 'word-families') || learning(p, 'blending') ? [19, 24].includes(w.n) : false;
  return false;
}

/** Rotates the theme through the child's interests, one week each. */
export const themeFor = (interests: ThemeId[], index: number): ThemeId => {
  const list = interests.length ? interests : (['dinosaurs'] as ThemeId[]);
  return list[(index - 1) % list.length];
};

function finish(childId: string, level: Level, drafts: Draft[], p: Pick<ChildProfile, 'interests'>, math: MathStep[], current = 1): ChildPlan {
  const weeks: ProgramWeek[] = drafts.slice(0, MAX_WEEKS).map((d, i) => {
    const base = baseWeekOf({ level: d.level, baseWeek: d.baseWeek } as ProgramWeek);
    const m: MathStep = d.math ?? math[Math.min(i, math.length - 1)] ?? (base.addTo ? { addTo: base.addTo } : { number: base.number ?? 1 });
    const focus = [...new Set([...d.lit, ...mathSkills(m)])];
    const out: ProgramWeek = { index: i + 1, level: d.level, baseWeek: d.baseWeek, theme: themeFor(p.interests, i + 1), focus, math: m };
    if (d.extraReview) out.extraReview = true;
    return out;
  });
  return { childId, level, weeks, current: Math.min(Math.max(1, current), weeks.length) };
}

/** Profile in, a whole year's ordered plan out. */
export function placeChild(profile: ChildProfile): ChildPlan {
  const level = placeLevel(profile);
  const drafts: Draft[] = [];
  for (const w of PLANS[level].weeks) {
    if (skipped(level, w, profile)) continue;
    drafts.push({ level, baseWeek: w.n, lit: literacyFocus(level, w) });
    if (reviewAfter(level, w, profile)) drafts.push({ level, baseWeek: w.n, lit: literacyFocus(level, w), extraReview: true });
  }
  // A child who skips a lot still gets a full year: a second pass of review weeks over the plan's later skills
  // (word families in Kindergarten, letter groups in Pre-K), each with a new theme, story and math.
  const again = PLANS[level].weeks.filter((w) => (level === 'kindergarten' ? w.kind === 'family' || w.kind === 'vowel-review' : w.kind === 'review'));
  for (let i = 0; drafts.length < PLAN_WEEKS && again.length; i++) {
    const w = again[i % again.length];
    drafts.push({ level, baseWeek: w.n, lit: literacyFocus(level, w), extraReview: true });
  }
  return finish(profile.id, level, drafts, profile, mathSteps(level, profile));
}

const toDraft = (w: ProgramWeek): Draft => ({ level: w.level, baseWeek: w.baseWeek, lit: w.focus.filter((s) => !MATH.has(s)), extraReview: w.extraReview, math: w.math });
const MATH = new Set<SkillId>(['count-10', 'count-20', 'numerals', 'compare', 'add-5', 'add-10']);

/**
 * A weekly check-in. "Still working" on any skill of that week puts a review week right after it
 * (once; never two review weeks in a row). "Got it" on everything takes out upcoming review weeks for those
 * skills (skip ahead) and moves math on when the child is ahead of it. Weeks already done never change.
 */
export function applyCheckIn(plan: ChildPlan, checkIn: CheckIn): ChildPlan {
  const at = plan.weeks.findIndex((w) => w.index === checkIn.weekIndex);
  if (at < 0) return plan;
  const done = plan.weeks.slice(0, at + 1).map(toDraft);
  let rest = plan.weeks.slice(at + 1).map(toDraft);
  const week = plan.weeks[at];
  const res = checkIn.results;
  const still = (Object.keys(res) as SkillId[]).filter((s) => res[s] === 'still-working');
  const gotIt = new Set((Object.keys(res) as SkillId[]).filter((s) => res[s] === 'got-it'));

  // Skip ahead: drop upcoming review weeks whose every literacy skill is now "got it".
  rest = rest.filter((d) => !(d.extraReview && d.lit.length && d.lit.every((s) => gotIt.has(s))));
  // A Pre-K review week right after, for letters the child has now got, is skipped too.
  if (rest[0] && rest[0].level === 'pre-k' && !rest[0].extraReview) {
    const base = PLANS['pre-k'].weeks[rest[0].baseWeek - 1];
    if (base.kind === 'review' && gotIt.has('letter-names') && gotIt.has('letter-sounds')) rest = rest.slice(1);
  }

  // Review: still working on a literacy skill of this week, and no review week already next.
  const litStill = still.filter((s) => week.focus.includes(s) && !MATH.has(s));
  if (litStill.length && !(rest[0]?.extraReview)) {
    rest.unshift({ level: week.level, baseWeek: week.baseWeek, lit: toDraft(week).lit, extraReview: true, math: week.math });
  }

  // Math: still working holds the current step one more week; got it moves past steps the child has.
  const mathStill = still.some((s) => MATH.has(s) && week.focus.includes(s));
  const cur = week.math;
  if (mathStill && cur) {
    rest = rest.map((d, i) => (i === 0 ? { ...d, math: cur } : d));
    // Shift the following steps back by one so nothing is lost.
    const steps = rest.map((d) => d.math);
    rest = rest.map((d, i) => (i === 0 ? d : { ...d, math: steps[i - 1] }));
  } else if (cur) {
    const ahead = (m?: MathStep) => !!m && ((gotIt.has('count-10') && (m.number ?? 99) <= 10 && (cur.number ?? 99) <= 10)
      || (gotIt.has('count-20') && m.number !== undefined && (cur.number ?? 0) > 10)
      || (gotIt.has('add-5') && m.addTo === 5 && cur.addTo === 5));
    const steps = rest.map((d) => d.math);
    const keep = steps.filter((m) => !ahead(m));
    if (keep.length < steps.length) {
      const last = keep[keep.length - 1] ?? steps[steps.length - 1];
      rest = rest.map((d, i) => ({ ...d, math: keep[i] ?? last }));
    }
  }

  const drafts = [...done, ...rest];
  const p = { interests: [...new Set(plan.weeks.map((w) => w.theme))] as ThemeId[] };
  // Keep each week's theme where it was; new weeks continue the rotation.
  const out = finish(plan.childId, plan.level, drafts, p, [], at + 2);
  const order = interestsOrder(plan);
  out.weeks = out.weeks.map((w, i) => (i <= at ? { ...w, theme: plan.weeks[i].theme } : { ...w, theme: order.length ? order[i % order.length] : w.theme }));
  return out;
}

/** The interest rotation a plan was built with (first appearance order). */
function interestsOrder(plan: ChildPlan): ThemeId[] {
  const out: ThemeId[] = [];
  for (const w of plan.weeks) { if (out.includes(w.theme)) break; out.push(w.theme); }
  return out;
}

// ---------- Helpers for pages and the timeline ----------

export const baseWeekOf = (w: ProgramWeek): Week => PLANS[w.level].weeks[w.baseWeek - 1];

/** "Letter S", "Review: Letters S and A", "Word family -at". */
export function weekTitle(w: ProgramWeek): string {
  const b = baseWeekOf(w);
  if (!w.extraReview) return b.title;
  if (b.kind === 'letter' || b.kind === 'review') {
    const ls = reviewLetters(w);
    return `Review: ${ls.map((l) => l.toUpperCase()).join(', ')}`;
  }
  if (b.kind === 'family') return `Review: -${b.family} words`;
  if (b.kind === 'vowel-review') return `Review: short ${b.letters[0]} words`;
  return `Review: ${b.title}`;
}

/** Letters an extra review week goes back over: this week's and the ones just before it. */
export function reviewLetters(w: ProgramWeek): string[] {
  const b = baseWeekOf(w);
  const weeks = PLANS[w.level].weeks;
  const out: string[] = [];
  for (let n = b.n; n >= 1 && out.length < (w.level === 'pre-k' ? 3 : 4); n--) {
    const x = weeks[n - 1];
    if (x.kind === 'letter' || x.kind === 'review') for (const l of x.letters) if (!out.includes(l)) out.push(l);
  }
  return out.slice(0, w.level === 'pre-k' ? 3 : 4).sort((a, b) => LETTER_ORDER.indexOf(a) - LETTER_ORDER.indexOf(b));
}

/** One line on the math for a plan week. */
export const mathTitle = (m?: MathStep) => (!m ? '' : m.addTo ? `adding within ${m.addTo}` : `the number ${m.number}`);
