// Regression tests from the Oct 25, 2026 site audit (no key or network needed). Run: npx tsx scripts/test-week-race.mts
//  1. Parallel week requests can't push a family past its monthly AI cap (the cap is taken before the model call).
//  2. The "made for" record of saved weeks survives a reload, so a week that moved gets new content, not stale content.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { ChildProfile } from '../src/lib/program/types';
import { setSceneArt, readyPaths } from '../src/lib/program/story';
import { placeChild } from '../src/lib/program/engine';
import { templateContentFor, sceneStoryFor, PLANS } from '../src/lib/program/templates';
import { setBackend, memoryBackend, updateFamily, loadFamily, FAMILY_MONTHLY_CAP } from '../src/lib/server/programStore';
import type { Caller } from '../src/lib/server/ai';
import { weekFor } from '../src/pages/api/program/week';

setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
setBackend(memoryBackend());
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => { try { await fn(); passed++; console.log(`ok   ${name}`); } catch (e) { console.error(`FAIL ${name}\n     ${(e as Error).message}`); process.exitCode = 1; } };

const child: ChildProfile = { id: 'c_racekid1', ageYears: 5, skills: {}, interests: ['dinosaurs'], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16T00:00:00.000Z' };
const plan = { ...placeChild(child), current: 30 };
const reply = (o: unknown) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(o) }] });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** A slow model that writes the template's own words for the week asked about. */
const goodFor = (wi: number): Caller => async (req) => {
  await sleep(40);
  if (req.mode === 'check') return reply({ pages: Array.from({ length: 10 }, (_, i) => ({ page: i + 1, matches: true, missing: '' })) });
  const id = /pathId "([a-z-]+)"/.exec(req.user)![1];
  const wk = plan.weeks[wi - 1];
  const c = templateContentFor(child, wk);
  const st = sceneStoryFor(wk.theme, wk.level, PLANS[wk.level].weeks[wk.baseWeek - 1], wk, readyPaths(wk.theme, wk.level).findIndex((p) => p.id === id))!;
  return reply({ ...c, story: { title: st.title, pathId: id, scenes: st.scenes, pages: st.pages } });
};
const key = 'fam-race';
const reset = async (generations = 0) => updateFamily(key, (d) => { d.children = [child]; d.plans = { [child.id]: plan }; d.content = {}; d.contentFor = {}; d.usage = { month: d.usage.month, generations, redos: {} }; });

await test('8 parallel weeks with 1 generation left: only 1 is made, the count stops at the cap', async () => {
  await reset(FAMILY_MONTHLY_CAP - 1);
  const weeks = [2, 3, 4, 5, 6, 7, 8, 9];
  const out = await Promise.all(weeks.map(async (wi) => (await weekFor(key, child.id, wi, false, { caller: goodFor(wi) })).json() as Promise<any>));
  const ai = out.filter((r) => r.content?.source === 'ai').length;
  const { doc } = await loadFamily(key);
  assert.equal(ai, 1, `AI weeks made: ${ai}`);
  assert.equal(doc.usage.generations, FAMILY_MONTHLY_CAP, `generations: ${doc.usage.generations}`);
  assert.deepEqual((doc.usage as any).pending ?? {}, {}, 'no child-week left marked as running');
});

await test('a failed generation gives its slot back', async () => {
  await reset(0);
  const r = await (await weekFor(key, child.id, 2, false, { caller: async () => reply('not json') })).json() as any;
  assert.equal(r.content.source, 'template');
  const { doc } = await loadFamily(key);
  assert.equal(doc.usage.generations, 0);
  assert.equal((doc.usage as any).failed.n, 1);
});

await test('the "made for" record survives a reload, and a moved week is made again', async () => {
  await reset(0);
  await weekFor(key, child.id, 2, false, { caller: goodFor(2) });
  let { doc } = await loadFamily(key);
  assert.ok(doc.contentFor?.[`${child.id}:2`], 'contentFor was saved and loaded back');
  // A check-in moves week 2 to a different base week.
  const moved = { ...plan, weeks: plan.weeks.map((w, i) => (i === 1 ? { ...w, baseWeek: w.baseWeek + 1 } : w)) };
  await updateFamily(key, (d) => { d.plans[child.id] = moved; });
  let calls = 0;
  const caller: Caller = async (q) => { calls++; return goodFor(2)(q); };
  const r = await (await weekFor(key, child.id, 2, false, { caller })).json() as any;
  assert.equal(r.cached, false, 'stale content was not served for the moved week');
  assert.ok(calls > 0);
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
