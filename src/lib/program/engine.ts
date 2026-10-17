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
const MAX_WEEKS = 44; // the server accepts up to 60

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
  // Knows the letters and their sounds already: the Pre-K track would be a year of review, so go to Kindergarten.
  if (letters === 2 && sounds === 2) return 'kindergarten';
  if (p.ageYears <= 3) return 'pre-k';
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
  // Pre-K never skips a letter week: a child who already names and sounds out the letters is placed on the
  // Kindergarten track instead (placeLevel), so no plan is made of filler review weeks.
  if (level === 'pre-k') return false;
  // Kindergarten letter weeks also teach handwriting and sight words. A 3 or 4 year old who knows the letters
  // still gets them (at that age writing them is the work); from 5 they are skipped.
  if (w.kind === 'letter') return got(p, 'letter-sounds') && got(p, 'letter-names') && p.ageYears >= 5;
  // Word family weeks are never skipped: each one brings new words and sight words, so a child who already reads
  // word families gets real reading at their level rather than a year of review weeks.
  return false;
}

/** Placement review weeks for skills that are still "learning": the base week to review and the week it follows. */
function placementReviews(level: Level, p: ChildProfile): { after: number; base: number }[] {
  if (level === 'pre-k') {
    if (!(learning(p, 'letter-names') || learning(p, 'letter-sounds'))) return [];
    // A breather every couple of months, after the letter week that follows the 2nd, 4th and 6th review weeks
    // (weeks 9, 17, 25). Never right after a review week, so two reviews never sit side by side.
    return [10, 18, 26].map((n) => ({ after: n, base: n }));
  }
  const out: { after: number; base: number }[] = [];
  if (learning(p, 'letter-sounds')) out.push(...[5, 9, 13].map((n) => ({ after: n, base: n })));
  // Word families still settling: a review of the vowel's last family, one teaching week after the vowel review.
  if (learning(p, 'word-families') || learning(p, 'blending')) out.push({ after: 20, base: 18 }, { after: 25, base: 23 });
  return out;
}

/** A review kind of week: an inserted extra review, or one of the base plan's own review weeks. */
const isReview = (d: Pick<Draft, 'level' | 'baseWeek' | 'extraReview'>) => {
  if (d.extraReview) return true;
  const k = PLANS[d.level].weeks[d.baseWeek - 1]?.kind;
  return k === 'review' || k === 'vowel-review';
};

/** Rotates the theme through the child's interests, one week each. */
export const themeFor = (interests: ThemeId[], index: number): ThemeId => {
  const list = interests.length ? interests : (['dinosaurs'] as ThemeId[]);
  return list[(index - 1) % list.length];
};

/** Keeps a plan within MAX_WEEKS by dropping the latest extra review weeks first, never a teaching week. */
function trim(drafts: Draft[], from = 0): Draft[] {
  const out = [...drafts];
  for (let i = out.length - 1; out.length > MAX_WEEKS && i >= from; i--) if (out[i].extraReview) out.splice(i, 1);
  return out.slice(0, Math.max(MAX_WEEKS, from));
}

function finish(childId: string, level: Level, drafts: Draft[], p: Pick<ChildProfile, 'interests'>, math: MathStep[], current = 1): ChildPlan {
  const weeks: ProgramWeek[] = trim(drafts).map((d, i) => {
    const base = baseWeekOf({ level: d.level, baseWeek: d.baseWeek } as ProgramWeek);
    const m: MathStep = d.math ?? math[Math.min(i, math.length - 1)] ?? (base.addTo ? { addTo: base.addTo } : { number: base.number ?? 1 });
    const focus = [...new Set([...d.lit, ...mathSkills(m)])];
    const out: ProgramWeek = { index: i + 1, level: d.level, baseWeek: d.baseWeek, theme: themeFor(p.interests, i + 1), focus, math: m };
    if (d.extraReview) out.extraReview = true;
    return out;
  });
  return { childId, level, weeks, current: Math.min(Math.max(1, current), weeks.length) };
}

/** Teaching weeks plus placement reviews, then spaced review weeks to fill a short plan. */
function draftsFor(profile: ChildProfile, level: Level): Draft[] {
  const drafts: Draft[] = [];
  const reviews = placementReviews(level, profile);
  for (const w of PLANS[level].weeks) {
    if (skipped(level, w, profile)) continue;
    drafts.push({ level, baseWeek: w.n, lit: literacyFocus(level, w) });
    for (const r of reviews.filter((x) => x.after === w.n)) {
      const b = PLANS[level].weeks[r.base - 1];
      if (!skipped(level, b, profile)) drafts.push({ level, baseWeek: r.base, lit: literacyFocus(level, b), extraReview: true });
    }
  }
  // A child who skips weeks gets some review weeks spread between teaching weeks (each with a new theme, story and
  // math), never two in a row, never next to one of the plan's own review weeks, and at most one for every three
  // teaching weeks. The rest of the year is simply shorter: no plan is padded with filler.
  const teaching = drafts.filter((d) => !isReview(d)).length;
  const need = Math.min(PLAN_WEEKS - drafts.length, Math.floor(teaching / 3));
  if (need > 0) {
    const slots: number[] = [];
    for (let i = 0; i < drafts.length; i++) {
      if (isReview(drafts[i]) || (drafts[i + 1] && isReview(drafts[i + 1]))) continue;
      if (PLANS[level].weeks[drafts[i].baseWeek - 1].kind === 'name') continue;
      slots.push(i);
    }
    const pick = need >= slots.length ? slots : Array.from({ length: need }, (_, k) => slots[Math.floor(((k + 0.5) * slots.length) / need)]);
    for (const i of [...new Set(pick)].sort((a, b) => b - a)) {
      const d = drafts[i];
      drafts.splice(i + 1, 0, { level, baseWeek: d.baseWeek, lit: d.lit, extraReview: true });
    }
  }
  return drafts;
}

/** Profile in, a whole year's ordered plan out. */
export function placeChild(profile: ChildProfile): ChildPlan {
  const level = placeLevel(profile);
  return finish(profile.id, level, draftsFor(profile, level), profile, mathSteps(level, profile));
}

const toDraft = (w: ProgramWeek): Draft => ({ level: w.level, baseWeek: w.baseWeek, lit: w.focus.filter((s) => !MATH.has(s)), extraReview: w.extraReview, math: w.math });
const MATH = new Set<SkillId>(['count-10', 'count-20', 'numerals', 'compare', 'add-5', 'add-10']);
const union = (a: SkillId[], b: SkillId[]) => [...new Set([...a, ...b])];

const kindOf = (d: Pick<Draft, 'level' | 'baseWeek'>) => PLANS[d.level].weeks[d.baseWeek - 1]?.kind;
const letterKind = (k?: string) => k === 'letter' || k === 'review';
const familyKind = (k?: string) => k === 'family' || k === 'vowel-review';
/** A review placed after a later teaching week reviews from that week back (Letter A after S: "Review: S, A"). */
function rebase(review: Draft, prev: Draft, still: SkillId[]): number {
  const a = kindOf(review), b = kindOf(prev);
  if (prev.level !== review.level || prev.baseWeek < review.baseWeek) return review.baseWeek;
  if ((letterKind(a) && letterKind(b)) || (familyKind(a) && familyKind(b))) return prev.baseWeek;
  // A name review that now also covers that week's letters or words becomes a review of that week.
  return a === 'name' && still.some((s) => s !== 'name-writing' && prev.lit.includes(s)) ? prev.baseWeek : review.baseWeek;
}

/**
 * Puts a review into the plan at the first slot from `from` on (slot k = between all[k-1] and all[k]) that follows
 * a teaching week. When a review is already next there (an inserted one or one of the plan's own), that review
 * takes on the skills instead, so review weeks never stack. Returns where a new week went, or -1.
 */
function placeReview(all: Draft[], from: number, review: Draft, still: SkillId[]): number {
  for (let k = Math.max(1, from); k <= all.length; k++) {
    if (isReview(all[k - 1])) continue;
    const next = all[k];
    const prev = all[k - 1];
    if (next && isReview(next)) {
      // An inserted review just before takes on the skills, and goes back over the week before it too.
      all[k] = next.extraReview ? { ...next, baseWeek: rebase(next, prev, still), lit: union(next.lit, still) } : { ...next, lit: union(next.lit, still) };
      return -1;
    }
    all.splice(k, 0, { ...review, baseWeek: rebase(review, prev, still), lit: union(review.lit, still), math: prev.math });
    return k;
  }
  return -1;
}

/** An extra review week within the next 3 weeks takes on these skills. True when one did. */
function extendSoon(all: Draft[], from: number, still: SkillId[]): boolean {
  for (let k = from; k < Math.min(all.length, from + 3); k++) {
    if (all[k].extraReview) { all[k] = { ...all[k], lit: union(all[k].lit, still) }; return true; }
  }
  return false;
}

/**
 * A weekly check-in, for the current week or (late) the one before it. Weeks already done never change.
 * - "Still working" on a literacy skill adds one review week after it. Never two review weeks in a row: when a
 *   review is already next it takes on the skill, and "still working" on a review week schedules the next review
 *   after the following teaching week instead.
 * - "Got it" takes out upcoming extra review weeks whose skills are all got (skip ahead), and moves math on.
 * - "Still working" on math holds the current math step one more week.
 * A check-in for the current week moves the plan to the next week; a late one leaves the current week where it is.
 */
export function applyCheckIn(plan: ChildPlan, checkIn: CheckIn): ChildPlan {
  const at = plan.weeks.findIndex((w) => w.index === checkIn.weekIndex);
  const curAt = Math.min(Math.max(plan.current - 1, 0), plan.weeks.length - 1);
  // Only the current week, or the one before it (a late check-in), ever adjusts the plan. Never a future week.
  if (at < 0 || at > curAt || at < curAt - 1) return plan;
  const late = at < curAt;
  const week = plan.weeks[at];
  const res = checkIn.results;
  const still = (Object.keys(res) as SkillId[]).filter((s) => res[s] === 'still-working');
  const gotIt = new Set((Object.keys(res) as SkillId[]).filter((s) => res[s] === 'got-it'));
  // Weeks before `keep` never change. A late check-in (changed answers for last week) may still take out the
  // current week when it is the extra review last week's answers added and every skill in it is now "got it".
  const cw = plan.weeks[curAt];
  const dropCurrent = late && cw.extraReview && cw.baseWeek === week.baseWeek && toDraft(cw).lit.every((s) => gotIt.has(s));
  const keep = late ? (dropCurrent ? curAt : curAt + 1) : at + 1;

  const done = plan.weeks.slice(0, keep).map(toDraft);
  let rest = plan.weeks.slice(keep).map(toDraft);
  // Skip ahead: drop upcoming extra review weeks whose every literacy skill is now "got it".
  rest = rest.filter((d) => !(d.extraReview && d.lit.length && d.lit.every((s) => gotIt.has(s))));
  // A Pre-K review week right after, for letters the child has now got, is skipped too.
  if (!late && rest[0] && rest[0].level === 'pre-k' && !rest[0].extraReview) {
    const base = PLANS['pre-k'].weeks[rest[0].baseWeek - 1];
    if (base.kind === 'review' && gotIt.has('letter-names') && gotIt.has('letter-sounds')) rest = rest.slice(1);
  }
  let all = [...done, ...rest];

  // Review: still working on a literacy skill of this week.
  const litStill = still.filter((s) => week.focus.includes(s) && !MATH.has(s));
  let inserted = -1;
  if (litStill.length && late && !dropCurrent && cw.extraReview && cw.baseWeek === week.baseWeek) {
    // Last week's check-in again (or changed): the review it added is this week, so it just takes on the skills.
    all[curAt] = { ...all[curAt], lit: union(all[curAt].lit, litStill) };
  } else if (litStill.length && week.extraReview && extendSoon(all, keep, litStill)) {
    // Still working after a review week, and another review is coming up soon: it takes on the skills.
  } else if (litStill.length) {
    const lit = union(toDraft(week).lit, litStill);
    inserted = placeReview(all, keep, { level: week.level, baseWeek: week.baseWeek, lit, extraReview: true }, litStill);
  }

  // Math: still working holds this week's step one more week (a review week right after already does that);
  // got it moves past steps the child has.
  const mathStill = still.some((s) => MATH.has(s) && week.focus.includes(s));
  const cur = week.math;
  if (mathStill && cur && inserted !== keep) {
    const steps = all.slice(keep).map((d) => d.math);
    all = all.map((d, i) => (i < keep ? d : { ...d, math: i === keep ? cur : steps[i - keep - 1] }));
  } else if (!mathStill && cur) {
    const ahead = (m?: MathStep) => !!m && ((gotIt.has('count-10') && (m.number ?? 99) <= 10 && (cur.number ?? 99) <= 10)
      || (gotIt.has('count-20') && m.number !== undefined && (cur.number ?? 0) > 10)
      || (gotIt.has('add-5') && m.addTo === 5 && cur.addTo === 5));
    const steps = all.slice(keep).map((d) => d.math);
    const kept = steps.filter((m) => !ahead(m));
    if (kept.length < steps.length) {
      const last = kept[kept.length - 1] ?? steps[steps.length - 1];
      all = all.map((d, i) => (i < keep ? d : { ...d, math: kept[i - keep] ?? last }));
    }
  }

  const p = { interests: [...new Set(plan.weeks.map((w) => w.theme))] as ThemeId[] };
  const out = finish(plan.childId, plan.level, trim(all, keep), p, [], late ? curAt + 1 : at + 2);
  // Keep each week's theme where it was; new weeks continue the rotation.
  const order = interestsOrder(plan);
  out.weeks = out.weeks.map((w, i) => (i < keep && plan.weeks[i] ? { ...w, theme: plan.weeks[i].theme } : { ...w, theme: order.length ? order[i % order.length] : w.theme }));
  return out;
}

/** The interest rotation a plan was built with (first appearance order). */
function interestsOrder(plan: ChildPlan): ThemeId[] {
  const out: ThemeId[] = [];
  for (const w of plan.weeks) { if (out.includes(w.theme)) break; out.push(w.theme); }
  return out;
}

const mathRank = (m?: MathStep) => (!m ? 0 : m.addTo ? 100 + m.addTo : m.number ?? 0);

/**
 * A profile was edited. The weeks already done and the current week stay. When the new answers keep the same
 * track, the weeks after the current one are rebuilt from the new answers, going on from where the child is (and
 * keeping review weeks a check-in added, for skills that still aren't "got it"). When they move the child to the
 * other track, the plan starts over (restarted: true); the placement check warns before saving that.
 */
export function rebasePlan(plan: ChildPlan, before: ChildProfile | undefined, profile: ChildProfile): { plan: ChildPlan; restarted: boolean } {
  const level = placeLevel(profile);
  if (level !== plan.level || !plan.weeks.length) return { plan: placeChild(profile), restarted: level !== plan.level };
  const curAt = Math.min(Math.max(plan.current - 1, 0), plan.weeks.length - 1);
  const keep = plan.weeks.slice(0, curAt + 1);
  const sameSkills = before && before.ageYears === profile.ageYears && JSON.stringify(before.skills) === JSON.stringify(profile.skills);
  let rest: Draft[];
  if (sameSkills) {
    // Only interests, pace or faith changed: the same weeks, with the new themes from the next week on.
    rest = plan.weeks.slice(curAt + 1).map(toDraft);
  } else {
    const curBase = Math.max(...keep.filter((w) => !w.extraReview).map((w) => w.baseWeek), keep[curAt].baseWeek);
    const fresh = draftsFor(profile, level);
    const j = fresh.findIndex((d) => !d.extraReview && d.baseWeek > curBase);
    rest = j < 0 ? plan.weeks.slice(curAt + 1).map(toDraft) : fresh.slice(j);
    if (rest[0] && isReview(rest[0]) && isReview(toDraft(keep[curAt]))) rest = rest.slice(1);
    // Math goes on from the current week's step.
    const cur = keep[curAt].math;
    const steps = mathSteps(level, profile).filter((m) => mathRank(m) > mathRank(cur));
    const last = steps[steps.length - 1] ?? cur;
    rest = rest.map((d, i) => ({ ...d, math: steps[i] ?? last }));
    // Review weeks a check-in added, for skills the new answers don't mark "got it", stay after their week.
    for (const old of plan.weeks.slice(curAt + 1)) {
      if (!old.extraReview) continue;
      const lit = toDraft(old).lit.filter((s) => !got(profile, s));
      if (!lit.length) continue;
      const k = rest.findIndex((d) => !d.extraReview && d.baseWeek === old.baseWeek);
      if (k >= 0 && !(rest[k + 1] && isReview(rest[k + 1]))) rest.splice(k + 1, 0, { level, baseWeek: old.baseWeek, lit, extraReview: true, math: rest[k].math });
    }
  }
  const all = trim([...keep.map(toDraft), ...rest], curAt + 1);
  const out = finish(plan.childId, level, all, profile, [], curAt + 1);
  out.weeks = out.weeks.map((w, i) => {
    if (i < curAt) return { ...w, theme: plan.weeks[i].theme };
    if (i === curAt && profile.interests.includes(plan.weeks[i].theme)) return { ...w, theme: plan.weeks[i].theme };
    return { ...w, theme: themeFor(profile.interests, i + 1) };
  });
  return { plan: out, restarted: false };
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
