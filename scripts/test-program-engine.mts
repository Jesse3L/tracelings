// Tests for the personalized program's placement and rules engine.
// Run: npx tsx scripts/test-program-engine.mts
import assert from 'node:assert/strict';
import { placeChild, applyCheckIn, weekTitle, baseWeekOf, mathTitle } from '../src/lib/program/engine';
import { templateContentFor, freeWeekContent } from '../src/lib/program/templates';
import { THEME_IDS } from '../src/lib/program/themes';
import type { ChildProfile, ChildPlan } from '../src/lib/program/types';

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`ok   ${name}`); } catch (e) { console.log(`FAIL ${name}`); throw e; }
}
const profile = (p: Partial<ChildProfile>): ChildProfile => ({
  id: 'c_test', ageYears: 4, skills: {}, interests: ['dinosaurs'], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16', ...p,
});
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

test('a reader ready for word families skips to them and keeps one family per vowel', () => {
  const plan = placeChild(profile({ ageYears: 6, skills: { 'name-writing': 'got-it', 'letter-names': 'got-it', 'letter-sounds': 'got-it', blending: 'got-it', 'word-families': 'got-it', 'sight-words': 'learning', 'count-20': 'got-it', numerals: 'got-it', 'count-10': 'got-it', 'add-5': 'got-it' } }));
  assert.equal(plan.level, 'kindergarten');
  const t = titles(plan);
  assert.equal(t[0], 'Word family -at');
  // First pass: one family per vowel plus the vowel reviews, then a second pass of review weeks fills the year.
  const first = t.slice(0, 10);
  assert.deepEqual(first, ['Word family -at', 'Short a review', 'Word family -ig', 'Short i review', 'Word family -op', 'Short o review', 'Word family -ug', 'Short u review', 'Word family -en', 'Short e review']);
  assert.equal(plan.weeks.length, 36);
  assert.ok(plan.weeks.slice(10).every((w) => w.extraReview));
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
  const plan = placeChild(profile({ ageYears: 4, interests: ['dinosaurs', 'unicorns'] }));
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
  const plan = placeChild(profile({ ageYears: 3, skills: { 'letter-names': 'learning', 'letter-sounds': 'learning' } }));
  const reviews = plan.weeks.filter((w) => w.extraReview).length;
  // Week 4 is Letter T; the regular review week (S, A, T) comes right after it.
  const next = applyCheckIn(plan, { childId: plan.childId, weekIndex: 4, results: { 'letter-names': 'got-it', 'letter-sounds': 'got-it' }, at: '2026-10-20' });
  assert.equal(next.weeks.filter((w) => w.extraReview).length, 0);
  assert.equal(next.weeks.length, plan.weeks.length - reviews - 1); // and the review week right after is skipped
  assert.equal(weekTitle(next.weeks[4]), 'Letter I');
  assert.equal(next.current, 5);
});

test('check-in on math: still working holds the number, got it skips ahead', () => {
  const plan = placeChild(profile({ ageYears: 4 }));
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

console.log(`\n${passed} tests passed`);
