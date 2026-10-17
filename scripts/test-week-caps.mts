// C3: failed AI attempts never use up the family's monthly count. Only a generation that passed every check and
// was saved counts (family and global); failed requests count against a small per-day cap instead, once per request
// however many tries it made. Runs POST /api/program/week's logic (weekFor) against the in-memory store and a
// scripted model. No key or network needed. Run: npx tsx scripts/test-week-caps.mts
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { ChildProfile } from '../src/lib/program/types';
import { setSceneArt, readyPaths } from '../src/lib/program/story';
import { placeChild } from '../src/lib/program/engine';
import { templateContentFor, sceneStoryFor, PLANS } from '../src/lib/program/templates';
import { setBackend, memoryBackend, updateFamily, loadFamily, globalAiCount, FAMILY_MONTHLY_CAP } from '../src/lib/server/programStore';
import type { Caller } from '../src/lib/server/ai';
import { weekFor, FAILED_PER_DAY } from '../src/pages/api/program/week';

setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
setBackend(memoryBackend());
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { try { await fn(); passed++; console.log(`ok   ${name}`); } catch (e) { console.error(`FAIL ${name}\n     ${(e as Error).message}`); process.exitCode = 1; } };

const child: ChildProfile = { id: 'c_capkid1', ageYears: 5, skills: {}, interests: ['dinosaurs'], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16T00:00:00.000Z' };
const plan = { ...placeChild(child), current: 5 };
const reply = (o: unknown) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(o) }] });
/** A model that writes the template's own words for the week asked about and the path it is given (templates pass
 *  every check). `weekIndex` is the week of the request being made. */
let weekIndex = 1;
const good: Caller = async (req) => {
  if (req.mode === 'check') return reply({ pages: Array.from({ length: 10 }, (_, i) => ({ page: i + 1, matches: true, missing: '' })) });
  const id = /pathId "([a-z-]+)"/.exec(req.user)![1];
  const wk = plan.weeks[weekIndex - 1];
  const c = templateContentFor(child, wk);
  const st = sceneStoryFor(wk.theme, wk.level, PLANS[wk.level].weeks[wk.baseWeek - 1], wk, readyPaths(wk.theme, wk.level).findIndex((p) => p.id === id))!;
  return reply({ ...c, story: { title: st.title, pathId: id, scenes: st.scenes, pages: st.pages } });
};
const garbage: Caller = async () => reply('not json');
const key = 'fam-caps';
const ask = (wi: number, caller: Caller) => { weekIndex = wi; return weekFor(key, child.id, wi, false, { caller }); };
const reset = async () => updateFamily(key, (d) => { d.children = [child]; d.plans = { [child.id]: plan }; d.content = {}; d.contentFor = {}; d.usage = { month: d.usage.month, generations: 0, redos: {} }; });
const body = async (r: Response) => (await r.json()) as any;

await test('failed attempts do not use up the monthly count (QA cap-burn case)', async () => {
  await reset();
  for (let i = 0; i < 3; i++) assert.equal((await body(await ask(2, garbage))).note, 'fallback');
  let { doc } = await loadFamily(key);
  assert.equal(doc.usage.generations, 0, 'three failed requests (two tries each) counted nothing');
  assert.equal((doc.usage as any).failed.n, 3, 'each failed request counts once against the daily failed cap');
  const r = await body(await ask(2, good));
  assert.equal(r.content.source, 'ai'); assert.equal(r.note, undefined);
  ({ doc } = await loadFamily(key));
  assert.equal(doc.usage.generations, 1, 'the success counts once');
  assert.equal(await globalAiCount(), 1, 'global guard counts the saved generation');
});
await test('a failed first try then a good retry counts once, and no failed attempt', async () => {
  await reset();
  let n = 0;
  const flaky: Caller = async (req) => (req.mode === 'book' && n++ === 0 ? reply('not json') : good(req));
  const r = await body(await ask(2, flaky));
  assert.equal(r.content.source, 'ai');
  const { doc } = await loadFamily(key);
  assert.equal(doc.usage.generations, 1); assert.equal((doc.usage as any).failed?.n ?? 0, 0);
});
await test(`after ${FAILED_PER_DAY} failed requests in a day, no more model calls (abuse cap)`, async () => {
  await reset();
  for (let i = 0; i < FAILED_PER_DAY; i++) await ask(1, garbage);
  let calls = 0;
  const r = await body(await ask(1, async (q) => { calls++; return good(q); }));
  assert.equal(r.note, 'limit'); assert.equal(calls, 0); assert.equal(r.content.source, 'template');
});
await test('the monthly cap still stops generation once reached by successes', async () => {
  await reset();
  await updateFamily(key, (d) => { d.usage.generations = FAMILY_MONTHLY_CAP; });
  let calls = 0;
  const r = await body(await ask(1, async (q) => { calls++; return good(q); }));
  assert.equal(r.note, 'limit'); assert.equal(calls, 0);
});
await test('a week avoids the story paths of the 3 weeks before it', async () => {
  await reset();
  const ids: string[] = [];
  for (const wi of [2, 3, 4, 5]) ids.push((await body(await ask(wi, good))).content.story.pathId);
  assert.equal(new Set(ids.slice(0, 3)).size, 3, ids.join(','));
  assert.ok(!ids.slice(0, 3).includes(ids[3]) || readyPaths('dinosaurs', plan.weeks[0].level).length <= 3, ids.join(','));
});
console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
