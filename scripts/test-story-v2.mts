// Tests for story v2: the big picture book, the scene story validator, the template stories and the stapled
// book's page order. No API key, network or real art needed: a test manifest is built in memory from scenes.ts.
// Run: npx tsx scripts/test-story-v2.mts
import assert from 'node:assert/strict';
import type { ChildProfile, ProgramWeek, ThemeId } from '../src/lib/program/types';
import { SCENES, pathsFor } from '../src/lib/program/scenes';
import { setSceneArt, readyPaths, fitPath, arcProblem, storyHasArt, BOOK_PAGES, type SceneArtManifest } from '../src/lib/program/story';
import { STORY_TEXTS } from '../src/lib/program/storyTexts';
import { templateContentFor, freeWeekContent, sceneStoryFor, PLANS } from '../src/lib/program/templates';
import { bigBookPages, bookSlot, buildProgramWeek } from '../src/lib/program/pages';
import { THEME_IDS } from '../src/lib/program/themes';
import { placeChild } from '../src/lib/program/engine';
import { validateStory, validateContent, storyFacts, weekFacts, generateWeekContent, requestBody, _prompts, ContentInvalid, BOOK_SCHEMA, CHECK_SCHEMA, PROGRAM_STORY_MODEL, PROGRAM_AI_MODEL, estimateWeekCost, type Caller, type StoryFacts } from '../src/lib/server/ai';
import { pickPath, PAGE_RULES, pageLengthProblem, pageRuleText } from '../src/lib/program/story';

let passed = 0;
const test = async (name: string, fn: () => void | Promise<void>) => {
  try { await fn(); passed++; console.log(`ok   ${name}`); } catch (e) { console.error(`FAIL ${name}\n     ${(e as Error).message}`); process.exitCode = 1; }
};
const rejects = (fn: () => unknown, re: RegExp) => assert.throws(fn, (e: unknown) => e instanceof ContentInvalid && re.test((e as Error).message), `expected ${re}`);

/** Every scene has art and every path is ready. */
const fullArt = (): SceneArtManifest => {
  const m: SceneArtManifest = { pathsReady: {} };
  for (const T of Object.values(SCENES)) {
    m[T.theme] = Object.fromEntries(T.scenes.map((s) => [s.id, { w: 1200, h: 900 }]));
    m.pathsReady![T.theme] = T.paths.map((p) => p.id);
  }
  return m;
};

const profile = (p: Partial<ChildProfile> = {}): ChildProfile => ({ id: 'c_story1', ageYears: 5, skills: {}, interests: ['dinosaurs'], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16T00:00:00.000Z', ...p });
// Kindergarten base week 15 is "Word family -at" (sight words am, are).
const kWeek: ProgramWeek = { index: 3, level: 'kindergarten', baseWeek: 15, theme: 'dinosaurs', focus: ['word-families'] };
const pkWeek: ProgramWeek = { index: 2, level: 'pre-k', baseWeek: 2, theme: 'dinosaurs', focus: ['letter-names'] };

setSceneArt(fullArt());
const kFacts = storyFacts(weekFacts(profile(), kWeek), { id: 'lost-egg' })!;
const pkFacts = storyFacts(weekFacts(profile({ ageYears: 4 }), pkWeek), { id: 'egg-short' })!;

// A good Kindergarten story on the dinosaur lost-egg path, with the -at words and sight words "am" and "are".
const goodK = () => ({
  title: '{{name}} and the Lost Egg',
  pathId: 'lost-egg',
  scenes: ['open-friends', 'exp-walk', 'find-egg', 'prob-egg-rolls', 'try-tracks', 'help-dot-egg', 'solve-egg-home', 'cel-hatch', 'cel-baby-hi', 'end-wave'],
  pages: [
    'Stomp, Dot and Tops sat on the hill in the sun. "We are friends," said Stomp to {{name}}.',
    'Stomp and Tops walk on the path. Step, step, step!',
    'Stomp finds a nest. In it is one big egg with spots.',
    'Oh no! The egg rolls down the hill. Roll, roll, roll!',
    'Stomp and Tops follow the track in the sand.',
    '"Look by the rocks!" said {{name}}. Dot gets the egg with her long nose.',
    '"I am so glad," said Stomp. He sets the egg back in the nest.',
    'Tap, tap, tap! The egg cracks. A baby peeks out.',
    'The baby sat in the shell. Stomp and Dot say hi.',
    'Stomp, Dot and Tops wave bye. A cat, a hat and a mat! What fun, {{name}}!',
  ],
});

// ---------- Validator ----------
await test('validator: a good K story passes', () => { const s = validateStory(goodK(), kFacts); assert.equal(s.scenes?.length, 10); assert.equal(s.pathId, 'lost-egg'); });
await test('validator: picture and text mismatch (page names a cast member who is not drawn)', () => {
  const g = goodK(); g.pages[2] = 'Dot finds a nest. In it is one big egg with spots.'; // find-egg shows only Stomp
  rejects(() => validateStory(g, kFacts), /names Dot, who is not in the picture/);
});
await test('validator: picture and text mismatch (page names nothing in its picture)', () => {
  const g = goodK(); g.pages[7] = 'The sky is blue. Fun, fun, fun!';
  rejects(() => validateStory(g, kFacts), /does not name anything in its picture/);
});
await test('validator: the T-rex egg page from the printed week now needs the egg picture', () => {
  // The old problem: "The T-rex has a big egg in its nest" on a T-rex-only picture. On the egg scene it is true.
  const g = goodK(); g.pages[2] = 'Stomp the T-rex has a big egg in his nest.'; validateStory(g, kFacts);
  const h = goodK(); h.scenes[2] = 'open-morning'; rejects(() => validateStory(h, kFacts), /arc|does not name/);
});
await test('validator: broken arc (solve before the problem)', () => {
  const g = goodK(); [g.scenes[3], g.scenes[6]] = [g.scenes[6], g.scenes[3]]; [g.pages[3], g.pages[6]] = [g.pages[6], g.pages[3]];
  rejects(() => validateStory(g, kFacts), /story arc/);
});
await test('validator: broken arc (two problems)', () => {
  const g = goodK(); g.scenes[4] = 'prob-stuck'; g.pages[4] = 'Tops is stuck in the mud.';
  rejects(() => validateStory(g, kFacts), /exactly one problem/);
});
await test('validator: broken arc (no help before the solve)', () => {
  const g = goodK(); g.scenes[5] = 'exp-lake'; g.pages[5] = 'Dot drinks from the lake, and {{name}} sees her.';
  rejects(() => validateStory(g, kFacts), /story arc/);
});
await test('validator: wrong page count for the level', () => {
  const g = goodK(); g.scenes.splice(8, 1); g.pages.splice(8, 1);
  rejects(() => validateStory(g, kFacts), /needs 10 pages/);
  rejects(() => validateStory(goodK(), pkFacts), /needs 6 pages/);
});
await test('validator: unknown scene', () => { const g = goodK(); g.scenes[1] = 'exp-volcano'; rejects(() => validateStory(g, kFacts), /unknown scene/); });
await test('validator: scene with no reviewed art is unknown', () => {
  const m = fullArt(); delete (m.dinosaurs as Record<string, unknown>)['exp-walk']; setSceneArt(m);
  try { rejects(() => validateStory(goodK(), kFacts), /unknown scene/); } finally { setSceneArt(fullArt()); }
});
await test('validator: invented name', () => { const g = goodK(); g.pages[1] = 'Stomp and Tops walk with Zorbo on the path.'; rejects(() => validateStory(g, kFacts), /possible name/); });
await test('validator: invented common first name', () => { const g = goodK(); g.pages[1] = 'Liam, Stomp and Tops walk on the path.'; rejects(() => validateStory(g, kFacts), /personal name/); });
await test('validator: cast name changed', () => { const g = goodK(); g.pages[2] = 'Stompy finds a nest. In it is one big egg with spots.'; rejects(() => validateStory(g, kFacts), /possible name|cast name/); });
await test('validator: missing {{name}}', () => { const g = goodK(); g.pages = g.pages.map((p) => p.replace(/\{\{name\}\}/g, 'the kid')); rejects(() => validateStory(g, kFacts), /no \{\{name\}\}/); });
await test('validator: {{name}} must help between the problem and the solve', () => {
  const g = goodK(); g.pages[5] = '"Look by the rocks!" said Dot. She gets the egg with her long nose.';
  g.pages[1] = 'Stomp and Tops walk on the path with {{name}}.';
  rejects(() => validateStory(g, kFacts), /does not help/);
});
await test('validator: dashes, banned words, scary words', () => {
  const a = goodK(); a.pages[1] = 'Stomp and Tops walk on the path — step, step!'; rejects(() => validateStory(a, kFacts), /dash/);
  const b = goodK(); b.pages[1] = 'Stomp and Tops start a journey on the path.'; rejects(() => validateStory(b, kFacts), /banned/);
  const c = goodK(); c.pages[3] = 'Oh no! The egg rolls down the hill. It is scary!'; rejects(() => validateStory(c, kFacts), /not for kids/);
});
await test('validator: page too long for the level', () => {
  const g = goodK(); g.pages[1] = 'Stomp and Tops walk on the path. They step and step. They hop and hop. They go and go and go.';
  rejects(() => validateStory(g, kFacts), /too long|too many sentences/);
});
await test('validator: teaching words are checked (word family)', () => {
  const g = goodK(); g.pages[9] = 'Stomp, Dot and Tops wave bye. What fun, {{name}}!'; g.pages[0] = g.pages[0].replace('sat', 'stood'); g.pages[8] = g.pages[8].replace('sat', 'is');
  rejects(() => validateStory(g, kFacts), /word family/);
});
await test('validator: a Pre-K story of 6 pages passes, with short pages', () => {
  const t = sceneStoryFor('dinosaurs', 'pre-k', PLANS['pre-k'].weeks[1], pkWeek, 0)!;
  validateStory(t, pkFacts, { teaching: false });
  const long = { ...t, pages: t.pages.map((p, i) => (i === 1 ? `${p} The egg rolls and rolls and rolls down the big hill.` : p)) };
  rejects(() => validateStory(long, pkFacts, { teaching: false }), /too long|too many sentences/);
});

// ---------- Full content, the call and the fallback ----------
const rest = () => ({
  wordProblems: [
    { text: '{{name}} sees 2 eggs. Then 3 more eggs. How many eggs now?', a: 2, b: 3, op: '+', answer: 5, icon: 'egg' },
    { text: 'There are 4 bones. 1 bone rolls away. How many bones are left?', a: 4, b: 1, op: '-', answer: 3, icon: 'bone' },
    { text: 'Stomp has 5 footprints. Tops has 2 footprints. Which number is more, 5 or 2?', a: 5, b: 2, op: 'compare', answer: 5, icon: 'footprint' },
    { text: 'Dot sees 1 egg and 4 more eggs. How many eggs in all?', a: 1, b: 4, op: '+', answer: 5, icon: 'egg' },
  ],
  tracingSentence: 'A cat sat on a mat.',
  parentNote: { teaches: 'This week covers -at words like cat, hat and mat.', why: 'Word families help many kids see that one new sound makes a new word.', activities: ['Hide 5 toy dinosaurs and count them as they are found.', 'Write at on a card and add letters to make cat, hat and mat.'] },
});
const reply = (o: unknown) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(o) }] });
/** The picture check's answer: every page matches, except the listed ones. */
const checkOk = (pages = 10, no: number[] = []) => reply({ pages: Array.from({ length: pages }, (_, i) => ({ page: i + 1, matches: !no.includes(i + 1), missing: no.includes(i + 1) ? 'a thing' : '' })) });
/** A scripted model: book calls take the next story reply, check calls the next check reply (all match by default). */
const seq = (...rs: unknown[]): Caller & { n: number; modes: string[]; users: string[] } => {
  let b = 0, c = 0;
  const books = rs.filter((r: any) => !(r && r.__check)), checks = rs.filter((r: any) => r && r.__check).map((r: any) => r.v);
  const f = (async (req: any) => {
    f.modes.push(req.mode); f.users.push(req.user); f.n++;
    if (req.mode === 'check') return checks.length ? checks[Math.min(c++, checks.length - 1)] : checkOk();
    return books[Math.min(b++, books.length - 1)];
  }) as any;
  f.n = 0; f.modes = []; f.users = []; return f;
};
const check = (v: unknown) => ({ __check: true, v });

await test('content: full book-mode output validates, cast names allowed in word problems', () => {
  const c = validateContent({ story: goodK(), ...rest() }, weekFacts(profile(), kWeek), kFacts);
  assert.equal(c.story.scenes?.length, 10);
  assert.equal(c.wordProblems.length, 4);
});
await test('generate: picture book mode uses the story model, one call when valid', async () => {
  const c = seq(reply({ story: goodK(), ...rest() }));
  const r = await generateWeekContent(profile(), kWeek, { caller: c, path: { id: 'lost-egg' } });
  assert.equal(r.content.source, 'ai'); assert.equal(r.calls, 2); assert.deepEqual(c.modes, ['book', 'check']); assert.equal(r.failed, 0);
  assert.ok(storyHasArt('dinosaurs', r.content.story));
});
await test('generate: a mismatched picture retries once (told the rule), then falls back to the template book', async () => {
  const bad = goodK(); bad.pages[2] = 'Dot finds a nest with one big egg.';
  const c = seq(reply({ story: bad, ...rest() }), reply({ story: bad, ...rest() }));
  const r = await generateWeekContent(profile(), kWeek, { caller: c, path: { id: 'lost-egg' } });
  assert.equal(r.content.source, 'template'); assert.equal(r.reason, 'invalid'); assert.equal(c.n, 2); assert.equal(r.failed, 2);
  assert.ok(c.users[1].includes('not in the picture') && !c.users[1].includes('Dot finds'), 'retry names the rule, not the text');
  assert.ok(storyHasArt('dinosaurs', r.content.story), 'template fallback is a picture book too');
});
await test('generate: caps and reserve are unchanged (one reserve per call)', async () => {
  let n = 0; const c = seq(reply('x'), reply({ story: goodK(), ...rest() }));
  const r = await generateWeekContent(profile(), kWeek, { caller: c, reserve: async () => { n++; return true; }, path: { id: 'lost-egg' } });
  // Bad JSON (1 call), then a good story (1) and its picture check (1): each call checks the caps first.
  assert.equal(n, 3); assert.equal(r.calls, 3); assert.equal(r.failed, 1); assert.equal(r.content.source, 'ai');
  const capped = await generateWeekContent(profile(), kWeek, { caller: seq(), reserve: async () => false });
  assert.equal(capped.reason, 'capped'); assert.equal(capped.calls, 0);
});
await test('picture check: a "no" on any page fails the story, retries once, then the template', async () => {
  const c = seq(reply({ story: goodK(), ...rest() }), check(checkOk(10, [3])), check(checkOk(10, [7])));
  const r = await generateWeekContent(profile(), kWeek, { caller: c, path: { id: 'lost-egg' } });
  assert.equal(r.content.source, 'template'); assert.equal(r.reason, 'invalid'); assert.deepEqual(c.modes, ['book', 'check', 'book', 'check']);
  assert.ok(c.users[2].includes('the words say something the picture does not show'), 'retry names the failed rule');
  const ok = seq(reply({ story: goodK(), ...rest() }), check(checkOk(10, [3])), check(checkOk(10)));
  const r2 = await generateWeekContent(profile(), kWeek, { caller: ok, path: { id: 'lost-egg' } });
  assert.equal(r2.content.source, 'ai'); assert.equal(r2.failed, 1);
  const body = requestBody({ system: 's', user: 'u', mode: 'check' }) as any;
  assert.equal(body.model, PROGRAM_AI_MODEL); assert.equal(body.output_config.format.schema, CHECK_SCHEMA); assert.equal(body.thinking.type, 'disabled');
});
await test('paths: the server picks the path; the AI must use it as given', () => {
  const g = goodK(); rejects(() => validateStory(g, storyFacts(weekFacts(profile(), kWeek), { id: 'mud' })!), /not the given story path/);
  const a = pickPath('dinosaurs', 'kindergarten', 1)!.id, b = pickPath('dinosaurs', 'kindergarten', 2)!.id;
  assert.notEqual(a, b, 'rotates by week');
  assert.notEqual(pickPath('dinosaurs', 'kindergarten', 1, [a])!.id, a, 'skips recent paths');
  assert.notEqual(pickPath('dinosaurs', 'kindergarten', 1, [], 1)!.id, a, 'a redo moves on');
  const p = _prompts(profile(), kWeek, { id: 'lost-egg' });
  assert.ok(p.user.includes('pathId "lost-egg"') && !p.user.includes('Ready story paths') && !p.user.includes('prob-stuck'), 'only the picked path is in the prompt');
});
await test('page rule: one rule for the prompt, the checker and the templates', () => {
  assert.deepEqual(PAGE_RULES['pre-k'], { sentences: 2, words: 14, sentenceWords: 12 });
  assert.ok(pageRuleText('pre-k').includes('at most 14 words'));
  assert.ok(_prompts(profile({ ageYears: 4 }), pkWeek).user.includes(pageRuleText('pre-k')));
  assert.equal(pageLengthProblem('pre-k', 'Oh no! The egg rolls down, down, down the hill.'), null);
  assert.ok(pageLengthProblem('pre-k', 'Snip finds a big shell in the sand by the sea, and it is so very pretty.'));
});
await test('cost: the estimate counts the picture check', () => {
  const k = estimateWeekCost('kindergarten');
  assert.equal(k.parts.length, 2); assert.ok(k.parts[1].call.includes('picture'));
  assert.ok(k.usd > 0.03 && k.usd < 0.1, String(k.usd));
});
await test('request: book mode is the story model with adaptive thinking and no sampling params; classic unchanged', () => {
  const b = requestBody({ system: 's', user: 'u', mode: 'book' }) as any;
  assert.equal(b.model, PROGRAM_STORY_MODEL); assert.equal(PROGRAM_STORY_MODEL, process.env.PROGRAM_STORY_MODEL || 'claude-sonnet-5-5');
  assert.equal(b.thinking.type, 'adaptive'); assert.ok(!('temperature' in b) && !('top_p' in b) && !('top_k' in b));
  assert.equal(b.output_config.format.schema, BOOK_SCHEMA);
  const c = requestBody({ system: 's', user: 'u', mode: 'classic' }) as any;
  assert.equal(c.thinking.type, 'disabled'); assert.ok(c.model.includes('haiku') || process.env.PROGRAM_AI_MODEL);
});
await test('prompt: names never sent, scenes and cast listed, no dashes', () => {
  const p = _prompts(profile(), kWeek, { id: 'lost-egg' });
  assert.equal(p.mode, 'book');
  assert.ok(p.system.includes('{{name}}') && p.user.includes('Stomp') && p.user.includes('lost-egg') && p.user.includes('prob-egg-rolls'));
  assert.ok(p.user.includes('-at') && p.user.includes('am, are'));
  assert.ok(!/—|–/.test(p.system + p.user));
});
await test('no art: no picture book, old little book prompt and story', async () => {
  setSceneArt({});
  try {
    assert.equal(storyFacts(weekFacts(profile(), kWeek)), null);
    assert.equal(_prompts(profile(), kWeek).mode, 'classic');
    const t = templateContentFor(profile(), kWeek);
    assert.ok(!t.story.scenes && t.story.icons?.length, 'template is the old icon story');
    const pages = buildProgramWeek({ name: 'Ana', profile: profile(), week: kWeek, content: t, paper: 'letter', credit: false });
    assert.ok(!pages.some((p) => p.items.some((i) => i.kind === 'image')), 'no images without art');
    // A cached AI picture book printed after its art was pulled falls back to the little book too.
    setSceneArt(fullArt());
    const cached = { ...t, story: goodK() };
    setSceneArt({});
    const again = buildProgramWeek({ name: 'Ana', profile: profile(), week: kWeek, content: cached, paper: 'letter', credit: false });
    assert.ok(!again.some((p) => p.items.some((i) => i.kind === 'image')));
  } finally { setSceneArt(fullArt()); }
});
await test('partial art: only themes with a fully drawn ready path get the book', () => {
  const m: SceneArtManifest = { pathsReady: { trucks: ['ball'] }, trucks: Object.fromEntries(SCENES.trucks.scenes.map((s) => [s.id, { w: 4, h: 3 }])) };
  setSceneArt(m);
  try {
    assert.equal(readyPaths('trucks', 'pre-k').length, 1);
    assert.equal(readyPaths('trucks', 'kindergarten').length, 0);
    assert.equal(readyPaths('dinosaurs', 'pre-k').length, 0);
    assert.ok(freeWeekContent('trucks', 'pre-k').story.scenes);
    assert.ok(!freeWeekContent('trucks', 'kindergarten').story.scenes);
    // A path listed as ready but missing one scene's art is not ready.
    delete (m.trucks as Record<string, unknown>)['solve-ball']; setSceneArt(m);
    assert.equal(readyPaths('trucks', 'pre-k').length, 0);
  } finally { setSceneArt(fullArt()); }
});

// ---------- Templates: every theme x level x ready path ----------
await test('every path trims to the book size with a clean arc', () => {
  for (const T of Object.values(SCENES)) for (const p of T.paths) {
    const f = fitPath(T.theme, p.scenes, BOOK_PAGES[p.level]);
    assert.equal(f.length, BOOK_PAGES[p.level], `${T.theme}/${p.id}`);
    assert.equal(arcProblem(T.theme, f), null, `${T.theme}/${p.id}: ${arcProblem(T.theme, f)}`);
  }
});
await test('every path has a hand-written text for every scene in the trimmed book', () => {
  for (const T of Object.values(SCENES)) for (const p of T.paths) {
    const t = STORY_TEXTS[T.theme]?.[p.id];
    assert.ok(t, `${T.theme}/${p.id} has no text`);
    const have = new Set(t.pages.map(([id]) => id));
    for (const id of fitPath(T.theme, p.scenes, BOOK_PAGES[p.level])) assert.ok(have.has(id), `${T.theme}/${p.id} missing ${id}`);
    for (const [id, text] of t.pages) assert.ok(text.includes('{W}') || true, id);
    assert.equal(t.pages.filter(([, x]) => x.includes('{W}')).length, 1, `${T.theme}/${p.id} needs exactly one {W}`);
  }
});
await test('template coverage: every theme x level x ready path x kind of week gives a valid story', () => {
  let n = 0;
  const kinds: Record<'pre-k' | 'kindergarten', number[]> = { 'pre-k': [1, 2, 5, 34, 36], kindergarten: [1, 2, 14, 15, 19, 28, 35, 36] };
  for (const theme of THEME_IDS) for (const level of ['pre-k', 'kindergarten'] as const) {
    const paths = readyPaths(theme, level);
    assert.ok(paths.length >= 1, `${theme} ${level}`);
    paths.forEach((path, k) => {
      for (const bw of kinds[level]) {
        const w = PLANS[level].weeks[bw - 1];
        const pw: ProgramWeek = { index: bw, level, baseWeek: bw, theme, focus: [] };
        const st = sceneStoryFor(theme, level, w, pw, k)!;
        assert.equal(st.pathId, path.id);
        const facts = storyFacts(weekFacts(profile({ ageYears: level === 'pre-k' ? 4 : 5, interests: [theme] }), pw), { id: path.id })!;
        // The templates pass the same checks as the AI, the week's words included.
        try { validateStory(st, facts); } catch (e) { throw new Error(`${theme}/${path.id} week ${bw}: ${(e as Error).message}`); }
        assert.ok(!st.pages.some((p) => p.includes('{W}')));
        n++;
      }
    });
  }
  console.log(`      ${n} template stories checked`);
});
await test('template coverage: real plans, every week prints the picture book', () => {
  for (const theme of THEME_IDS) for (const age of [3, 5] as const) {
    const p = profile({ ageYears: age, interests: [theme] });
    for (const wk of placeChild(p).weeks) {
      const c = templateContentFor(p, wk);
      assert.ok(storyHasArt(theme, c.story), `${theme} age ${age} week ${wk.index}`);
      assert.equal(c.story.pages.length, BOOK_PAGES[wk.level]);
    }
  }
});
await test('templates: weeks rotate through the paths', () => {
  const p = profile({ ageYears: 5 });
  const ids = placeChild(p).weeks.slice(0, 4).map((w) => templateContentFor(p, w).story.pathId);
  assert.ok(new Set(ids).size >= 2, ids.join(','));
});
await test('templates: week teaching line lands ({W})', () => {
  const at = sceneStoryFor('dinosaurs', 'kindergarten', PLANS.kindergarten.weeks[14], { index: 15, level: 'kindergarten', baseWeek: 15, theme: 'dinosaurs', focus: [] }, 0)!;
  assert.ok(at.pages.join(' ').includes('sings, "Cat, bat, hat!'), at.pages.join(' | '));
  const s = sceneStoryFor('trucks', 'pre-k', PLANS['pre-k'].weeks[1], { index: 2, level: 'pre-k', baseWeek: 2, theme: 'trucks', focus: [] }, 0)!;
  assert.match(s.pages.join(' '), /says, "S is for [a-z]+!/);
  // X is an ending sound; C uses a hard c; U has a word; review weeks name every letter; the child isn't named twice.
  const x = sceneStoryFor('trucks', 'pre-k', PLANS['pre-k'].weeks[33], { index: 34, level: 'pre-k', baseWeek: 34, theme: 'trucks', focus: [] }, 0)!;
  assert.match(x.pages.join(' '), /ends with x!/);
  for (const theme of THEME_IDS) {
    const c = sceneStoryFor(theme, 'pre-k', PLANS['pre-k'].weeks[9], { index: 10, level: 'pre-k', baseWeek: 10, theme, focus: [] }, 0)!;
    const m = c.pages.join(' ').match(/C is for ([a-z]+)/); assert.ok(m && !/^c[hei]/.test(m[1]), `${theme}: ${m?.[0]}`);
    const u = sceneStoryFor(theme, 'pre-k', PLANS['pre-k'].weeks[21], { index: 22, level: 'pre-k', baseWeek: 22, theme, focus: [] }, 0)!;
    assert.match(u.pages.join(' '), /U is for [a-z]+/, theme);
    const k9 = sceneStoryFor(theme, 'kindergarten', PLANS.kindergarten.weeks[8], { index: 9, level: 'kindergarten', baseWeek: 9, theme, focus: [] }, 0)!;
    assert.ok(/O is for/.test(k9.pages.join(' ')) && /U is for/.test(k9.pages.join(' ')), `${theme} K week 9: ${k9.pages.join(' ')}`);
    const r = sceneStoryFor(theme, 'pre-k', PLANS['pre-k'].weeks[4], { index: 5, level: 'pre-k', baseWeek: 5, theme, focus: [] }, 0)!;
    assert.match(r.pages.join(' '), /S, A, T!/, theme);
    for (const pg of [...c.pages, ...u.pages, ...k9.pages, ...r.pages]) assert.ok((pg.match(/\{\{name\}\}/g) ?? []).length <= 1, `name twice: ${pg}`);
  }
  const nm = freeWeekContent('farm', 'pre-k').story;
  assert.ok(nm.pages.join(' ').includes('Hip, hip, hooray for {{name}}!'));
});

// ---------- The stapled book: page order ----------
await test('page order: cut, fold each strip (pictures out), stack, staple', () => {
  for (const level of ['pre-k', 'kindergarten'] as const) {
    const total = BOOK_PAGES[level] + 2;
    const sheets = Math.ceil(total / 4);
    assert.equal(sheets, level === 'pre-k' ? 2 : 3);
    // Simulate: each sheet is cut into a top and bottom strip; each strip folds so its right half is the front and
    // its left half the back. Stacking strips sheet by sheet, top strip first, reads front, back, front, back...
    const grid = new Map<string, number>();
    for (let p = 0; p < total; p++) {
      const s = bookSlot(p);
      const key = `${s.sheet}/${s.strip}/${s.face}`;
      assert.ok(!grid.has(key), `two pages in ${key}`);
      grid.set(key, p);
    }
    assert.equal(grid.size, sheets * 4, 'every half page is used');
    const reading: number[] = [];
    for (let sh = 0; sh < sheets; sh++) for (const strip of [0, 1]) for (const face of ['front', 'back']) reading.push(grid.get(`${sh}/${strip}/${face}`)!);
    assert.deepEqual(reading, Array.from({ length: total }, (_, i) => i), `${level} reads in order`);
  }
  assert.deepEqual(bookSlot(0), { sheet: 0, strip: 0, face: 'front' });
  assert.deepEqual(bookSlot(7), { sheet: 1, strip: 1, face: 'back' });
});
await test('page order: drawn pages land in their slots with the right numbers', () => {
  for (const level of ['pre-k', 'kindergarten'] as const) for (const paper of ['letter', 'a4'] as const) {
    const st = freeWeekContent('ocean', level).story;
    const pages = bigBookPages({ name: 'Maximiliana Christabel', theme: 'ocean', paper, credit: true, label: 'Week 1', seed: 'x' }, level, st);
    assert.equal(pages.length, level === 'pre-k' ? 2 : 3);
    for (let p = 1; p <= st.pages.length; p++) {
      const s = bookSlot(p);
      const pg = pages[s.sheet];
      const num = pg.items.find((i) => i.kind === 'text' && i.text === String(p) && i.size === 9);
      assert.ok(num && num.kind === 'text', `${level} ${paper} page ${p} number`);
      const inX = s.face === 'front' ? num.x > pg.w / 2 : num.x < pg.w / 2;
      const inY = s.strip === 0 ? num.y < pg.h / 2 : num.y > pg.h / 2;
      assert.ok(inX && inY, `${level} ${paper} page ${p} is in its slot`);
      const img = pg.items.filter((i) => i.kind === 'image');
      assert.ok(img.length >= 3, 'pictures on every sheet');
    }
    // Nothing runs off the page or over the cut line.
    for (const pg of pages) for (const it of pg.items) if (it.kind === 'text') assert.ok(it.x > 4 && it.x < pg.w - 4 && it.y > 4 && it.y < pg.h - 1, `text inside page: ${it.text}`);
    for (const pg of pages) for (const it of pg.items) if (it.kind === 'image') assert.ok(Math.floor(it.y / (pg.h / 2)) === Math.floor((it.y + it.h - 0.01) / (pg.h / 2)), 'image stays in its half');
  }
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
