// Tests for the personalized program's placement and rules engine.
// Run: npx tsx scripts/test-program-engine.mts
import assert from 'node:assert/strict';
import { placeChild, applyCheckIn, rebasePlan, weekTitle, baseWeekOf, mathTitle } from '../src/lib/program/engine';
import { templateContentFor, freeWeekContent } from '../src/lib/program/templates';
import { littleBookPlan, problemIcon } from '../src/lib/program/pages';
import { THEME_IDS, THEMES, mentionsIcon } from '../src/lib/program/themes';
import type { ChildProfile, ChildPlan } from '../src/lib/program/types';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`ok   ${name}`); } catch (e) { console.log(`FAIL ${name}`); throw e; }
}
const profile = (p: Partial<ChildProfile>): ChildProfile => ({
  id: 'c_test', ageYears: 4, skills: {}, interests: ['dinosaurs'], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16', ...p,
});
/** The plan with its current week moved to n (check-ins only count for the current week or the one before). */
const at = (plan: ChildPlan, n: number): ChildPlan => ({ ...plan, current: n });
const titles = (plan: ChildPlan) => plan.weeks.map(weekTitle);
const show = (plan: ChildPlan, n = 8) => plan.weeks.slice(0, n).map((w) => `${w.index}:${weekTitle(w)} [${w.theme}, ${mathTitle(w.math)}]`).join(' | ');

test('3-year-old beginner gets the full Pre-K plan from the name week', () => {
  const plan = placeChild(profile({ ageYears: 3, interests: ['trucks', 'bugs'] }));
  assert.equal(plan.level, 'pre-k');
  assert.equal(plan.weeks.length, 36);
  assert.equal(plan.weeks[0].baseWeek, 1);
  assert.equal(weekTitle(plan.weeks[1]), 'Letter S');
  assert.deepEqual(plan.weeks.slice(0, 4).map((w) => w.theme), ['trucks', 'bugs', 'trucks', 'bugs']);
  assert.deepEqual(plan.weeks[0].math, { number: 1 });
  assert.ok(plan.weeks.every((w, i) => w.index === i + 1));
  console.log('     ', show(plan));
});

test('a 3-year-old still learning letters gets extra review weeks', () => {
  const plan = placeChild(profile({ ageYears: 3, skills: { 'letter-names': 'learning' } }));
  const extra = plan.weeks.filter((w) => w.extraReview);
  assert.equal(extra.length, 3);
  assert.ok(plan.weeks.length >= 36 && plan.weeks.length <= 40);
  // A review week sits right after the week it repeats.
  for (const w of extra) assert.equal(plan.weeks[w.index - 2].baseWeek, w.baseWeek);
});

test('5-year-old who knows letters and counts to 10 starts Kindergarten past the letter weeks', () => {
  const plan = placeChild(profile({ ageYears: 5, interests: ['space', 'ocean', 'pets'], skills: { 'letter-names': 'got-it', 'letter-sounds': 'got-it', 'count-10': 'got-it', numerals: 'got-it', 'name-writing': 'got-it' } }));
  assert.equal(plan.level, 'kindergarten');
  assert.equal(baseWeekOf(plan.weeks[0]).kind, 'family');
  assert.equal(weekTitle(plan.weeks[0]), 'Word family -at');
  // Math skips past numbers 1 to 10.
  assert.ok((plan.weeks[0].math!.number ?? 0) >= 11, JSON.stringify(plan.weeks[0].math));
  assert.deepEqual(plan.weeks.slice(0, 3).map((w) => w.theme), ['space', 'ocean', 'pets']);
  console.log('     ', show(plan));
});

test('5-year-old who knows letters but not sounds keeps the letter weeks', () => {
  const plan = placeChild(profile({ ageYears: 5, skills: { 'letter-names': 'got-it', 'letter-sounds': 'learning' } }));
  assert.equal(plan.level, 'kindergarten');
  assert.equal(weekTitle(plan.weeks[1]), 'Letters S and A');
  assert.ok(plan.weeks.some((w) => w.extraReview));
});

test('a reader ready for word families skips to them and reads every family (no year of filler reviews)', () => {
  const plan = placeChild(profile({ ageYears: 6, skills: { 'name-writing': 'got-it', 'letter-names': 'got-it', 'letter-sounds': 'got-it', blending: 'got-it', 'word-families': 'got-it', 'sight-words': 'learning', 'count-20': 'got-it', numerals: 'got-it', 'count-10': 'got-it', 'add-5': 'got-it' } }));
  assert.equal(plan.level, 'kindergarten');
  const t = titles(plan);
  assert.equal(t[0], 'Word family -at');
  // Every word family week is real reading at their level; a few spaced review weeks, never most of the year.
  const families = plan.weeks.filter((w) => !w.extraReview && baseWeekOf(w).kind === 'family').length;
  assert.equal(families, 17);
  assert.ok(plan.weeks.filter((w) => w.extraReview).length <= Math.floor(plan.weeks.length / 4));
  assert.ok(plan.weeks.every((w) => w.math?.addTo === 10), 'adds within 10 all year');
  console.log('     ', t.join(', '));
});

test('a 4-year-old who already knows letters and sounds moves up to Kindergarten', () => {
  const plan = placeChild(profile({ ageYears: 4, skills: { 'letter-names': 'got-it', 'letter-sounds': 'got-it', 'count-10': 'got-it', numerals: 'got-it', blending: 'learning' } }));
  assert.equal(plan.level, 'kindergarten');
});

test('a 6-year-old with no letters yet starts in Pre-K', () => {
  assert.equal(placeChild(profile({ ageYears: 6 })).level, 'pre-k');
});

test('pace never changes the week order', () => {
  const a = placeChild(profile({ ageYears: 4, daysPerWeek: 3, minutesPerDay: 10 }));
  const b = placeChild(profile({ ageYears: 4, daysPerWeek: 5, minutesPerDay: 30 }));
  assert.deepEqual(titles(a), titles(b));
});

test('placement is deterministic', () => {
  const p = profile({ ageYears: 5, interests: ['farm', 'castles'], skills: { 'letter-names': 'learning', 'count-10': 'learning' } });
  assert.deepEqual(placeChild(p), placeChild(p));
});

test('check-in "still working" inserts one review week right after', () => {
  const plan = at(placeChild(profile({ ageYears: 4, interests: ['dinosaurs', 'unicorns'] })), 2);
  const next = applyCheckIn(plan, { childId: plan.childId, weekIndex: 2, results: { 'letter-sounds': 'still-working', 'letter-names': 'got-it' }, at: '2026-10-20' });
  assert.equal(next.weeks.length, plan.weeks.length + 1);
  assert.equal(next.weeks[2].extraReview, true);
  assert.equal(next.weeks[2].baseWeek, plan.weeks[1].baseWeek);
  assert.equal(next.current, 3);
  // Earlier weeks and their themes are unchanged; rotation continues.
  assert.deepEqual(next.weeks.slice(0, 2), plan.weeks.slice(0, 2));
  assert.deepEqual(next.weeks.slice(0, 5).map((w) => w.theme), ['dinosaurs', 'unicorns', 'dinosaurs', 'unicorns', 'dinosaurs']);
  // A second "still working" on the review week doesn't stack another one.
  const again = applyCheckIn(next, { childId: plan.childId, weekIndex: 3, results: { 'letter-sounds': 'still-working' }, at: '2026-10-27' });
  assert.equal(again.weeks.filter((w) => w.extraReview).length, 2);
  console.log('     ', show(next, 5));
});

test('check-in "got it" skips upcoming review weeks', () => {
  const plan = at(placeChild(profile({ ageYears: 3, skills: { 'letter-names': 'learning', 'letter-sounds': 'learning' } })), 4);
  const reviews = plan.weeks.filter((w) => w.extraReview).length;
  // Week 4 is Letter T; the regular review week (S, A, T) comes right after it.
  const next = applyCheckIn(plan, { childId: plan.childId, weekIndex: 4, results: { 'letter-names': 'got-it', 'letter-sounds': 'got-it' }, at: '2026-10-20' });
  assert.equal(next.weeks.filter((w) => w.extraReview).length, 0);
  assert.equal(next.weeks.length, plan.weeks.length - reviews - 1); // and the review week right after is skipped
  assert.equal(weekTitle(next.weeks[4]), 'Letter I');
  assert.equal(next.current, 5);
});

test('check-in on math: still working holds the number, got it skips ahead', () => {
  const plan = at(placeChild(profile({ ageYears: 4 })), 3);
  const held = applyCheckIn(plan, { childId: plan.childId, weekIndex: 3, results: { 'count-10': 'still-working' }, at: '2026-10-20' });
  assert.deepEqual(held.weeks[3].math, plan.weeks[2].math);
  assert.equal(held.weeks.length, plan.weeks.length);
  const ahead = applyCheckIn(plan, { childId: plan.childId, weekIndex: 3, results: { 'count-10': 'got-it' }, at: '2026-10-20' });
  assert.ok((ahead.weeks[3].math!.number ?? 0) >= 11, JSON.stringify(ahead.weeks[3].math));
});

test('check-in for an unknown week changes nothing', () => {
  const plan = placeChild(profile({}));
  assert.equal(applyCheckIn(plan, { childId: plan.childId, weekIndex: 99, results: {}, at: '' }), plan);
});

// ---------- QA fixes (M2, M3, M9, M10, N1) ----------
const ALL_SKILLS = ['name-writing', 'letter-names', 'letter-sounds', 'blending', 'word-families', 'sight-words', 'count-10', 'count-20', 'numerals', 'compare', 'add-5', 'add-10'] as const;
const isRev = (w: ChildPlan['weeks'][number]) => Boolean(w.extraReview) || ['review', 'vowel-review'].includes(baseWeekOf(w).kind);
/** No two review weeks side by side, no two adjacent weeks with the same title, indexes 1..n, current in range. */
function assertShape(plan: ChildPlan, where: string) {
  plan.weeks.forEach((w, i) => assert.equal(w.index, i + 1, `${where}: index`));
  assert.ok(plan.current >= 1 && plan.current <= plan.weeks.length, `${where}: current`);
  for (let i = 1; i < plan.weeks.length; i++) {
    assert.ok(!(isRev(plan.weeks[i]) && isRev(plan.weeks[i - 1])), `${where}: reviews stacked at weeks ${i} and ${i + 1}: ${show({ ...plan, weeks: plan.weeks.slice(Math.max(0, i - 3), i + 2) }, 5)}`);
    assert.notEqual(weekTitle(plan.weeks[i]), weekTitle(plan.weeks[i - 1]), `${where}: weeks ${i} and ${i + 1} share a title`);
  }
}
const checkInNow = (plan: ChildPlan, results: Record<string, 'got-it' | 'still-working'>) =>
  applyCheckIn(plan, { childId: plan.childId, weekIndex: plan.current, results, at: '2026-10-20' });

test('M9: "still working" on the same skill again and again never stacks review weeks', () => {
  let plan = placeChild(profile({ ageYears: 4 }));
  for (let i = 0; i < 6; i++) {
    const wk = plan.weeks[plan.current - 1];
    plan = checkInNow(plan, Object.fromEntries(wk.focus.map((s) => [s, 'still-working'])));
    assertShape(plan, `after ${i + 1} still-working`);
  }
  // Between any two teaching weeks there is at most one review week.
  assert.ok(plan.weeks.filter((w) => w.extraReview).length <= 6);
  console.log('     ', show(plan, 12));
});

test('M9: "still working" on a review week extends a review coming up soon instead of adding one', () => {
  let plan = at(placeChild(profile({ ageYears: 4 })), 3); // Letter A
  plan = checkInNow(plan, { 'letter-sounds': 'still-working' });
  assert.ok(plan.weeks[plan.current - 1].extraReview, 'now on the review week');
  const n = plan.weeks.length;
  plan = checkInNow(plan, { 'letter-sounds': 'still-working' }); // still working on the review week itself
  assertShape(plan, 'review then still');
  // The plan's own review (S, A, T) is two weeks on, so it takes the skill; no new week.
  assert.equal(plan.weeks.length, n);
});

test('M9: resubmitting the same check-in does not add another review', () => {
  const plan = at(placeChild(profile({ ageYears: 4 })), 3);
  const once = checkInNow(plan, { 'letter-sounds': 'still-working' });
  // The parent changes or resends last week's check-in (a late check-in for the week before the current one).
  const twice = applyCheckIn(once, { childId: plan.childId, weekIndex: 3, results: { 'letter-sounds': 'still-working' }, at: '2026-10-21' });
  assert.equal(twice.weeks.length, once.weeks.length);
  assert.equal(twice.current, once.current);
  // Changing it to "got it" takes out the review it added.
  const fixed = applyCheckIn(once, { childId: plan.childId, weekIndex: 3, results: { 'letter-sounds': 'got-it', 'letter-names': 'got-it' }, at: '2026-10-21' });
  assert.equal(fixed.weeks.filter((w) => w.extraReview).length, 0);
  assertShape(fixed, 'changed to got it');
});

test('M3: a check-in for a future week changes nothing; last week is allowed', () => {
  const plan = placeChild(profile({ ageYears: 5 }));
  assert.equal(applyCheckIn(plan, { childId: plan.childId, weekIndex: 30, results: { 'letter-names': 'still-working' }, at: '' }), plan);
  assert.equal(applyCheckIn(plan, { childId: plan.childId, weekIndex: 2, results: { 'letter-names': 'still-working' }, at: '' }), plan);
  const later = at(plan, 6);
  assert.equal(applyCheckIn(later, { childId: plan.childId, weekIndex: 3, results: { 'letter-names': 'still-working' }, at: '' }), later, 'two weeks back is too late');
  const late = applyCheckIn(later, { childId: plan.childId, weekIndex: 5, results: { 'letter-sounds': 'still-working' }, at: '' });
  assert.equal(late.current, 6, 'a late check-in leaves the current week where it is');
  assert.deepEqual(late.weeks.slice(0, 6), later.weeks.slice(0, 6), 'weeks done and the current week stay');
  assertShape(late, 'late check-in');
});

test('M10: a 3 or 4 year old marked "got it" on everything gets real content, not filler reviews', () => {
  for (const age of [3, 4] as const) {
    const plan = placeChild(profile({ ageYears: age, skills: Object.fromEntries(ALL_SKILLS.map((s) => [s, 'got-it'])) }));
    assert.equal(plan.level, 'kindergarten', `age ${age}`);
    const extra = plan.weeks.filter((w) => w.extraReview).length;
    assert.ok(extra <= 3, `age ${age}: ${extra} extra review weeks`);
    assert.ok(plan.weeks.filter((w) => !isRev(w)).length >= 28, `age ${age}: teaching weeks`);
    assertShape(plan, `age ${age} got it`);
  }
  // A Pre-K child who knows letters and sounds is on the Kindergarten track too.
  assert.equal(placeChild(profile({ ageYears: 3, skills: { 'letter-names': 'got-it', 'letter-sounds': 'got-it' } })).level, 'kindergarten');
});

test('N1 and no stacking: every placement, and random check-ins on it, keep the plan well shaped', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const states = ['not-yet', 'learning', 'got-it'] as const;
  let n = 0;
  for (let k = 0; k < 120; k++) {
    const p = profile({ ageYears: (3 + (k % 5)) as ChildProfile['ageYears'], interests: ['dinosaurs', 'space'], skills: Object.fromEntries(ALL_SKILLS.map((s) => [s, states[Math.floor(rnd() * 3)]])) });
    let plan = placeChild(p);
    assertShape(plan, `placement ${k}`);
    assert.ok(plan.weeks.filter((w) => w.extraReview).length <= Math.ceil(plan.weeks.length / 4), `placement ${k}: too many reviews`);
    for (let c = 0; c < 20 && plan.current < plan.weeks.length; c++) {
      const wk = plan.weeks[plan.current - 1];
      const late = rnd() < 0.15 && plan.current > 1;
      const results = Object.fromEntries(wk.focus.filter(() => rnd() < 0.7).map((s) => [s, rnd() < 0.5 ? 'still-working' : 'got-it'])) as Record<string, 'got-it' | 'still-working'>;
      if (!Object.keys(results).length) continue;
      plan = applyCheckIn(plan, { childId: p.id, weekIndex: late ? plan.current - 1 : plan.current, results, at: '' });
      assertShape(plan, `placement ${k}, check-in ${c}`);
      n++;
    }
  }
  console.log(`      ${n} check-ins checked`);
});

test('M2: editing interests keeps the position, done weeks and check-in reviews', () => {
  const before = profile({ ageYears: 5, interests: ['dinosaurs'] });
  let plan = at(placeChild(before), 5);
  plan = checkInNow(plan, { 'letter-sounds': 'still-working' });
  const after = { ...before, interests: ['dinosaurs', 'ocean'] as ChildProfile['interests'] };
  const { plan: next, restarted } = rebasePlan(plan, before, after);
  assert.equal(restarted, false);
  assert.equal(next.current, plan.current);
  assert.equal(next.weeks.length, plan.weeks.length);
  assert.deepEqual(next.weeks.slice(0, plan.current - 1), plan.weeks.slice(0, plan.current - 1));
  assert.ok(plan.weeks.some((w) => w.extraReview), 'the check-in added a review');
  assert.deepEqual(next.weeks.map((w) => [w.baseWeek, Boolean(w.extraReview)]), plan.weeks.map((w) => [w.baseWeek, Boolean(w.extraReview)]), 'same weeks, check-in review kept');
  assert.ok(next.weeks.slice(plan.current).some((w) => w.theme === 'ocean'), 'new interest from the next week on');
  assertShape(next, 'edit interests');
});

test('M2: editing skills on the same track rebuilds the weeks ahead from where the child is', () => {
  const before = profile({ ageYears: 5, skills: { 'letter-names': 'learning' } });
  const plan = at(placeChild(before), 8);
  const after = { ...before, skills: { 'letter-names': 'got-it', 'letter-sounds': 'learning' } } as ChildProfile;
  const { plan: next, restarted } = rebasePlan(plan, before, after);
  assert.equal(restarted, false);
  assert.equal(next.level, plan.level);
  assert.equal(next.current, 8);
  assert.deepEqual(next.weeks.slice(0, 8).map(weekTitle), plan.weeks.slice(0, 8).map(weekTitle));
  // Nothing already done comes back, and the next week is a later teaching week (or a review of one).
  const curBase = plan.weeks[7].baseWeek;
  assert.ok(next.weeks.slice(8).every((w) => w.baseWeek >= curBase - 1), show({ ...next, weeks: next.weeks.slice(8) }, 4));
  assertShape(next, 'edit skills');
});

test('M2: a change that moves the child to the other track starts over and says so', () => {
  const before = profile({ ageYears: 4 });
  const plan = at(placeChild(before), 6);
  assert.equal(plan.level, 'pre-k');
  const after = { ...before, skills: { 'letter-names': 'got-it', 'letter-sounds': 'got-it' } } as ChildProfile;
  const { plan: next, restarted } = rebasePlan(plan, before, after);
  assert.equal(restarted, true);
  assert.equal(next.level, 'kindergarten');
  assert.equal(next.current, 1);
});

test('template content exists for every theme, level and week, with the week words', () => {
  for (const theme of THEME_IDS) for (const age of [3, 5] as const) {
    const plan = placeChild(profile({ ageYears: age, interests: [theme], skills: age === 5 ? { 'letter-names': 'got-it' } : {} }));
    for (const w of plan.weeks) {
      const c = templateContentFor(profile({ ageYears: age, interests: [theme] }), w);
      assert.equal(c.source, 'template');
      assert.ok(c.story.pages.length >= 4 && c.story.pages.length <= 8, `${theme} ${w.index} pages`);
      assert.ok(c.wordProblems.length >= 4 && c.wordProblems.length <= 6, `${theme} ${w.index} problems`);
      for (const q of c.wordProblems) {
        const ans = q.op === '+' ? q.a + q.b : q.op === '-' ? q.a - q.b : Math.max(q.a, q.b);
        assert.equal(q.answer, ans, `${theme} ${w.index} ${q.text}`);
        assert.ok(q.answer >= 0 && q.answer <= 20);
      }
      assert.ok(c.story.pages.join(' ').includes('{{name}}'));
      const all = JSON.stringify(c);
      assert.ok(!/[—–]/.test(all), 'no em or en dashes');
      assert.ok(!/\b(unlock|seamless|elevate|dive in|journey)\b/i.test(all), 'banned words');
    }
    const free = freeWeekContent(theme, age === 3 ? 'pre-k' : 'kindergarten');
    assert.ok(free.story.pages.length >= 4);
  }
});

test('every template story page has a picture of a thing that page names (every theme, level and week)', () => {
  const check = (theme: (typeof THEME_IDS)[number], story: { pages: string[]; icons?: (string | null)[] }, where: string) => {
    assert.ok(Array.isArray(story.icons) && story.icons.length === story.pages.length, `${where}: icons parallel to pages`);
    story.pages.forEach((p, i) => {
      const id = story.icons![i];
      assert.ok(id, `${where} page ${i + 1} has no picture: "${p}"`);
      assert.ok(THEMES[theme].icons.some((x) => x.id === id), `${where} page ${i + 1}: ${id} is not a ${theme} picture`);
      assert.ok(mentionsIcon(theme, p, id!), `${where} page ${i + 1}: [${id}] not named in "${p}"`);
    });
  };
  let n = 0;
  const starts: Partial<ChildProfile>[] = [{ ageYears: 3 }, { ageYears: 3, skills: { 'letter-names': 'learning' } }, { ageYears: 5 }, { ageYears: 5, skills: { 'letter-names': 'got-it' } },
    { ageYears: 6, skills: { 'letter-names': 'got-it', 'letter-sounds': 'got-it', blending: 'got-it', 'word-families': 'got-it', 'count-20': 'got-it', 'count-10': 'got-it', numerals: 'got-it', 'add-5': 'got-it' } }];
  for (const theme of THEME_IDS) {
    for (const level of ['pre-k', 'kindergarten'] as const) { check(theme, freeWeekContent(theme, level).story, `${theme} free ${level}`); n++; }
    for (const s of starts) {
      const p = profile({ ...s, interests: [theme] });
      for (const w of placeChild(p).weeks) { check(theme, templateContentFor(p, w).story, `${theme} ${w.level} week ${w.index} (base ${w.baseWeek})`); n++; }
    }
  }
  console.log(`      ${n} template stories checked`);
});

test('little book pictures: reuse, aliases, buddy, "Draw it!" and the story\'s own icons', () => {
  const plan = (pages: string[], icons?: (string | null)[]) => littleBookPlan({ name: 'Rex', theme: 'dinosaurs' }, { title: 'T', pages, icons }).pics.slice(0, pages.length);
  // Two pages about the T-rex both show it; plurals and spellings match; the first thing named wins.
  assert.deepEqual(plan(['A T-rex sat.', 'The T rex ate.', 'Two big eggs and a bone.', 'The long neck dinosaur ate leaves.']), ['t-rex', 't-rex', 'egg', 'long-neck']);
  // Nothing pictured on the page: no picture (a "Draw it!" box), never the next unused icon. A child called Rex is not a T-rex.
  assert.deepEqual(plan(['{{name}} ate green leaves.', 'It was fun.', 'The dino ran.']), [null, null, 't-rex']);
  // The story's own pick is used when the page names it, and ignored when it doesn't.
  assert.deepEqual(plan(['A T-rex by a volcano.', 'An egg.'], ['volcano', 'bone']), ['volcano', 'egg']);
  // The buddy's picture only when the page names the buddy.
  assert.deepEqual(littleBookPlan({ name: '', theme: 'sports' }, { title: 'T', pages: ['Go, team!', 'A swim race.'] }).pics.slice(0, 2), ['soccer-ball', null]);
});
test('word problem pictures count what the numbers count', () => {
  assert.equal(problemIcon('dinosaurs', '2 T-rexes and 3 more T-rexes.', 'egg', [2, 3])?.id, 't-rex');
  assert.equal(problemIcon('dinosaurs', 'A dinosaur takes 4 steps, then 1 more.', 't-rex', [4, 1]), null);
  assert.equal(problemIcon('dinosaurs', 'There are 3 big dinosaur eggs and 1 more.', undefined, [3, 1])?.id, 'egg');
  assert.equal(problemIcon('trains', 'A train has 4 train cars and 2 more.', undefined, [4, 2])?.id, 'passenger-car');
  assert.equal(problemIcon('farm', 'Which is more, 3 or 5? Count the cows.', 'cow', [3, 5])?.id, 'cow');
});

console.log(`\n${passed} tests passed`);
