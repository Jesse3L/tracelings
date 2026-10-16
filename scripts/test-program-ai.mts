// Tests for the program AI validation and the family store rules. No API key or network needed.
// Run: npx -y tsx scripts/test-program-ai.mts
import assert from 'node:assert/strict';
import type { ChildProfile, ProgramWeek } from '../src/lib/program/types';
import { validateContent, parseResponse, generateWeekContent, weekFacts, computeAnswer, ContentInvalid, _prompts, type Caller } from '../src/lib/server/ai';
import { cleanProfile, cleanPlan, cleanCheckIn, InvalidInput, setBackend, memoryBackend, updateFamily, loadFamily, reserveGlobalAi, familyKey, GLOBAL_MONTHLY_CAP, hadUnknownKeys } from '../src/lib/server/programStore';

process.env.SESSION_SECRET ??= 'test-secret-test-secret-test-secret-123';

let passed = 0;
const test = async (name: string, fn: () => void | Promise<void>) => {
  try { await fn(); passed++; console.log(`ok   ${name}`); } catch (e) { console.error(`FAIL ${name}\n     ${(e as Error).message}`); process.exitCode = 1; }
};
const rejects = (fn: () => unknown, re: RegExp) => assert.throws(fn, (e: unknown) => e instanceof ContentInvalid && re.test((e as Error).message));

const profile: ChildProfile = { id: 'c_abc123', ageYears: 5, skills: { 'letter-names': 'got-it' }, interests: ['dinosaurs', 'space'], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16T00:00:00.000Z' };
// Kindergarten week 15 is "Word family -at" in PLANS (13 letter weeks after the name week).
const famWeek: ProgramWeek = { index: 3, level: 'kindergarten', baseWeek: 15, theme: 'dinosaurs', focus: ['word-families', 'sight-words'] };
const facts = weekFacts(profile, famWeek);

const good = () => ({
  story: {
    title: '{{name}} and the Big Egg',
    pages: [
      '{{name}} sat on a mat.',
      'A dinosaur sat by the hat.',
      'The dinosaur had a big egg.',
      `${facts.sightWords[0] ?? 'the'} egg is in a nest.`.replace(/^./, (c) => c.toUpperCase()),
      `{{name}} and the dinosaur ${facts.sightWords[1] ?? 'see'} the egg.`,
      'Tap, tap, tap. A baby dinosaur! {{name}} can pat it.',
    ],
  },
  wordProblems: [
    { text: '{{name}} sees 2 dinosaurs. Then 3 more come. How many dinosaurs now?', a: 2, b: 3, op: '+', answer: 99 },
    { text: 'There are 4 eggs in a nest. 1 egg hatches. How many eggs are left?', a: 4, b: 1, op: '-', answer: 3 },
    { text: 'One dinosaur has 5 spots. One has 2 spots. Which number is more, 5 or 2?', a: 5, b: 2, op: 'compare', answer: 5 },
    { text: 'A dinosaur takes 1 step, then 4 more steps. How many steps in all?', a: 1, b: 4, op: '+', answer: 5 },
  ],
  tracingSentence: 'The dinosaur sat on a mat.',
  parentNote: {
    teaches: 'This week your child reads words in the -at family, like cat, hat and mat, and practices two sight words.',
    why: 'Word families help many kids see that changing one letter makes a new word, which builds early reading.',
    activities: ['Line up toy dinosaurs and count them together, then add one more and count again.', 'Write at on a paper and let your child add a letter in front to make cat, hat or bat.'],
  },
});

// Make the sight words land in the story for whatever the week has.
const fixture = () => {
  const g = good();
  g.story.pages[3] = `${facts.sightWords.join(' ')} egg.`.replace(/^./, (c) => c.toUpperCase());
  return g;
};

console.log(`week: ${facts.base.title}; family words ${facts.familyWords.join(',')}; sight ${facts.sightWords.join(',')}; math 0..${facts.mathMax}`);

await test('valid fixture passes and answers are recomputed', () => {
  const c = validateContent(fixture(), facts);
  assert.equal(c.source, 'ai');
  assert.equal(c.wordProblems[0].answer, 5, 'AI answer 99 must be replaced by 2+3');
  assert.equal(c.wordProblems[1].answer, 3);
  assert.equal(c.wordProblems[2].answer, 5);
  assert.ok(c.story.pages.join(' ').includes('{{name}}'));
});
await test('computeAnswer', () => { assert.equal(computeAnswer('+', 2, 3), 5); assert.equal(computeAnswer('-', 7, 2), 5); assert.equal(computeAnswer('compare', 2, 9), 9); });
await test('rejects story without {{name}}', () => { const g = fixture(); g.story.pages = g.story.pages.map((p) => p.replace(/\{\{name\}\}/g, 'the kid')); rejects(() => validateContent(g, facts), /no \{\{name\}\}/); });
await test('normalizes {{ name }} spacing', () => { const g = fixture(); g.story.pages[0] = '{{ Name }} sat on a mat.'; const c = validateContent(g, facts); assert.ok(c.story.pages[0].startsWith('{{name}}')); });
await test('rejects too few pages', () => { const g = fixture(); g.story.pages = g.story.pages.slice(0, 3); rejects(() => validateContent(g, facts), /4 to 8 pages/); });
await test('rejects too many pages', () => { const g = fixture(); g.story.pages = [...g.story.pages, ...g.story.pages]; rejects(() => validateContent(g, facts), /4 to 8 pages/); });
await test('rejects em dash', () => { const g = fixture(); g.story.pages[1] = 'A dinosaur sat — by the hat.'; rejects(() => validateContent(g, facts), /dash/); });
await test('rejects en dash', () => { const g = fixture(); g.parentNote.why = 'Ages 4–5 often like this.'; rejects(() => validateContent(g, facts), /dash/); });
await test('rejects spaced hyphen dash', () => { const g = fixture(); g.parentNote.teaches = 'Reading words - the fun way.'; rejects(() => validateContent(g, facts), /dash/); });
await test('allows -at family label', () => { const g = fixture(); g.parentNote.teaches = 'This week covers the -at family.'; validateContent(g, facts); });
await test('rejects banned word (journey)', () => { const g = fixture(); g.parentNote.why = 'It is part of the reading journey.'; rejects(() => validateContent(g, facts), /banned/); });
await test('rejects banned phrase (dive into)', () => { const g = fixture(); g.parentNote.activities[0] = 'Dive into a book of dinosaurs together.'; rejects(() => validateContent(g, facts), /banned/); });
await test("rejects banned phrase with curly apostrophe (whether you’re)", () => { const g = fixture(); g.parentNote.why = 'Whether you’re new or not, this helps.'; rejects(() => validateContent(g, facts), /banned/); });
await test('rejects scary content', () => { const g = fixture(); g.story.pages[2] = 'The dinosaur had a big sword.'; rejects(() => validateContent(g, facts), /not for kids/); });
await test('rejects faith words', () => { const g = fixture(); g.story.pages[5] = '{{name}} said a prayer for the egg.'; rejects(() => validateContent(g, facts), /faith/); });
await test('rejects an invented first name', () => { const g = fixture(); g.story.pages[1] = 'Liam sat by the hat.'; rejects(() => validateContent(g, facts), /personal name/); });
await test('rejects a capitalized mid-sentence name', () => { const g = fixture(); g.story.pages[1] = 'A dinosaur named Zorbo sat by the hat.'; rejects(() => validateContent(g, facts), /possible name/); });
await test('allows Mom and Monday mid-sentence', () => { const g = fixture(); g.parentNote.activities[1] = 'On Monday, ask Mom or Dad to hide three toy dinosaurs for a hunt.'; validateContent(g, facts); });
await test('rejects "you" in the story', () => { const g = fixture(); g.story.pages[1] = 'Can you see the hat?'; rejects(() => validateContent(g, facts), /speaks to the reader/); });
await test('rejects word problem number out of range', () => { const g = fixture(); g.wordProblems[0] = { text: '{{name}} sees 8 dinosaurs and 9 more.', a: 8, b: 9, op: '+', answer: 17 }; rejects(() => validateContent(g, facts), /out of range/); });
await test('rejects sum over the range', () => { const g = fixture(); const m = facts.mathMax; g.wordProblems[0] = { text: `${m} eggs and ${m} eggs. How many?`, a: m, b: m, op: '+', answer: 2 * m }; rejects(() => validateContent(g, facts), /answer out of range/); });
await test('rejects stray big number in text', () => { const g = fixture(); g.wordProblems[0].text = '{{name}} sees 2 dinosaurs and 3 more, out of 50 dinosaurs.'; rejects(() => validateContent(g, facts), /text out of range/); });
await test('rejects text missing a number', () => { const g = fixture(); g.wordProblems[0].text = '{{name}} sees 2 dinosaurs. More come. How many?'; rejects(() => validateContent(g, facts), /both numbers/); });
await test('rejects negative subtraction', () => { const g = fixture(); g.wordProblems[1] = { text: 'There are 1 eggs and 4 hatch.', a: 1, b: 4, op: '-', answer: 0 }; rejects(() => validateContent(g, facts), /negative/); });
await test('rejects equal compare', () => { const g = fixture(); g.wordProblems[2] = { text: 'Which is more, 3 or 3?', a: 3, b: 3, op: 'compare', answer: 3 }; rejects(() => validateContent(g, facts), /equal/); });
await test('rejects op not allowed for pre-k', () => {
  const pk = weekFacts({ ...profile, ageYears: 4 }, { index: 2, level: 'pre-k', baseWeek: 2, theme: 'space', focus: ['letter-names'] });
  assert.ok(!pk.ops.includes('-'));
  const g = fixture(); rejects(() => validateContent(g, pk), /op - not allowed|story|problem/);
});
await test('rejects too few word problems', () => { const g = fixture(); g.wordProblems = g.wordProblems.slice(0, 3); rejects(() => validateContent(g, facts), /4 to 6/); });
await test('rejects long tracing sentence', () => { const g = fixture(); g.tracingSentence = 'The big dinosaur sat on the mat with a hat and a cat.'; rejects(() => validateContent(g, facts), /tracing/); });
await test('rejects tracing sentence with digits', () => { const g = fixture(); g.tracingSentence = 'I see 3 dinosaurs.'; rejects(() => validateContent(g, facts), /tracing/); });
await test('rejects markdown', () => { const g = fixture(); g.parentNote.teaches = '**This week** covers -at words.'; rejects(() => validateContent(g, facts), /markup/); });
await test('rejects pressure words in parent note', () => { const g = fixture(); g.parentNote.why = 'By now your child should be able to read these.'; rejects(() => validateContent(g, facts), /pressure/); });
await test('rejects story missing word family words', () => { const g = fixture(); g.story.pages = g.story.pages.map((p) => p.replace(/\b(sat|mat|hat|pat|cat|bat|rat)\b/g, 'ran')); rejects(() => validateContent(g, facts), /word family/); });
await test('rejects stray braces', () => { const g = fixture(); g.story.pages[0] = '{{child}} sat on a mat. {{name}} too.'; rejects(() => validateContent(g, facts), /placeholder/); });
await test('only 2 activities kept', () => { const g = fixture(); g.parentNote.activities.push('A third idea with dinosaurs.'); assert.equal(validateContent(g, facts).parentNote.activities.length, 2); });

await test('parseResponse reads text block', () => { const v = parseResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(fixture()) }] }); validateContent(v, facts); });
await test('parseResponse rejects refusal and truncation and junk', () => {
  rejects(() => parseResponse({ stop_reason: 'refusal', content: [] }), /refusal/);
  rejects(() => parseResponse({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"story":' }] }), /truncated/);
  rejects(() => parseResponse({ content: [{ type: 'text', text: 'not json' }] }), /JSON/);
});

const reply = (obj: unknown) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj) }] });
const seq = (...rs: unknown[]): Caller & { n: number } => { const f = (async () => { const r = rs[Math.min(f.n++, rs.length - 1)]; if (r instanceof Error) throw r; return r; }) as any; f.n = 0; return f; };

await test('generate: good first try', async () => { const c = seq(reply(fixture())); const r = await generateWeekContent(profile, famWeek, { caller: c }); assert.equal(r.content.source, 'ai'); assert.equal(r.calls, 1); });
await test('generate: bad then good retries once', async () => { const c = seq(reply('oops'), reply(fixture())); const r = await generateWeekContent(profile, famWeek, { caller: c }); assert.equal(r.content.source, 'ai'); assert.equal(r.calls, 2); });
await test('generate: bad twice falls back to template', async () => { const g = fixture(); g.story.pages[0] = 'Liam sat.'; const c = seq(reply(g), reply(g), reply(fixture())); const r = await generateWeekContent(profile, famWeek, { caller: c }); assert.equal(r.content.source, 'template'); assert.equal(r.reason, 'invalid'); assert.equal(c.n, 2); });
await test('generate: network error falls back, no retry', async () => { const c = seq(new Error('boom')); const r = await generateWeekContent(profile, famWeek, { caller: c }); assert.equal(r.content.source, 'template'); assert.equal(r.reason, 'call-failed'); });
await test('generate: timeout falls back', async () => {
  const slow: Caller = ({ signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(Object.assign(new Error('t'), { name: 'TimeoutError' }))));
  const r = await generateWeekContent(profile, famWeek, { caller: slow, timeoutMs: 50 }); assert.equal(r.reason, 'call-failed');
});
await test('generate: no key gives template with no calls', async () => { delete process.env.ANTHROPIC_API_KEY; const r = await generateWeekContent(profile, famWeek); assert.equal(r.content.source, 'template'); assert.equal(r.reason, 'no-key'); });
await test('generate: cap stops before calling', async () => { const c = seq(reply(fixture())); const r = await generateWeekContent(profile, famWeek, { caller: c, reserve: async () => false }); assert.equal(r.reason, 'capped'); assert.equal(c.n, 0); });
await test('generate: each call is reserved (retry reserves again)', async () => { let n = 0; const c = seq(reply('x'), reply(fixture())); await generateWeekContent(profile, famWeek, { caller: c, reserve: async () => { n++; return true; } }); assert.equal(n, 2); });
await test('prompts contain the placeholder and no name field', () => {
  const p = _prompts(profile, famWeek);
  assert.ok(p.system.includes('{{name}}'));
  assert.ok(!/—|–/.test(p.system + p.user), 'prompt itself must not contain dashes');
  assert.ok(p.user.includes('-at'));
});

// ---------- Store rules ----------
await test('profile: strips unknown keys, keeps known', () => {
  const raw = { ...profile, favoriteColor: 'blue', extra: { a: 1 } };
  assert.ok(hadUnknownKeys(raw));
  const c = cleanProfile(raw);
  assert.deepEqual(Object.keys(c).sort(), ['ageYears', 'createdAt', 'daysPerWeek', 'faith', 'id', 'interests', 'minutesPerDay', 'skills']);
});
await test('profile: refuses any name field', () => {
  for (const k of ['name', 'childName', 'first_name', 'nickname', 'Name']) assert.throws(() => cleanProfile({ ...profile, [k]: 'Ava' }), (e: unknown) => e instanceof InvalidInput && e.code === 'name_not_allowed');
});
await test('profile: bad values refused', () => {
  const bad = [{ ageYears: 9 }, { interests: [] }, { interests: ['dinosaurs', 'a', 'b'] }, { interests: ['robots'] }, { skills: { flying: 'got-it' } }, { skills: { 'count-10': 'yes' } }, { id: 'Ava' }, { daysPerWeek: 7 }, { faith: 'no' }, { createdAt: 'yesterday' }];
  for (const b of bad) assert.throws(() => cleanProfile({ ...profile, ...b }), InvalidInput, JSON.stringify(b));
});
await test('plan: validates base weeks and indexes', () => {
  const plan = { childId: profile.id, level: 'kindergarten', current: 1, weeks: [famWeek].map((w) => ({ ...w, index: 1 })) };
  cleanPlan(plan, profile);
  assert.throws(() => cleanPlan({ ...plan, weeks: [{ ...plan.weeks[0], baseWeek: 99 }] }, profile), InvalidInput);
  assert.throws(() => cleanPlan({ ...plan, childId: 'c_other1' }, profile), InvalidInput);
  assert.throws(() => cleanPlan({ ...plan, current: 5 }, profile), InvalidInput);
});
await test('check-in: rejects unknown skills and values', () => {
  const plan = cleanPlan({ childId: profile.id, level: 'kindergarten', current: 1, weeks: [{ ...famWeek, index: 1 }] }, profile);
  cleanCheckIn({ childId: profile.id, weekIndex: 1, results: { 'word-families': 'got-it' } }, plan);
  assert.throws(() => cleanCheckIn({ childId: profile.id, weekIndex: 1, results: { reading: 'got-it' } }, plan), InvalidInput);
  assert.throws(() => cleanCheckIn({ childId: profile.id, weekIndex: 2, results: { 'word-families': 'got-it' } }, plan), InvalidInput);
});
await test('family key hides the email', () => { const k = familyKey('Parent@Example.com'); assert.equal(k, familyKey('parent@example.com')); assert.match(k, /^[a-f0-9]{64}$/); });
await test('store: update + load round trip, concurrent updates both land', async () => {
  setBackend(memoryBackend());
  const key = familyKey('a@b.co');
  await Promise.all([1, 2, 3].map((n) => updateFamily(key, async (d) => { await new Promise((r) => setTimeout(r, n)); d.usage.generations += 1; })));
  const { doc } = await loadFamily(key);
  assert.equal(doc.usage.generations, 3);
});
await test('store: global guard stops at the cap', async () => {
  setBackend(memoryBackend());
  let ok = 0;
  for (let i = 0; i < GLOBAL_MONTHLY_CAP + 5 && i < 4000; i++) if (await reserveGlobalAi()) ok++;
  assert.equal(ok, GLOBAL_MONTHLY_CAP);
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
