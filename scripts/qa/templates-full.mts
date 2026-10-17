// Every template week of real plans (all themes, several ages) through the full AI validator: story, word problems,
// tracing sentence and parent note. Templates are held to the same rules as AI output.
// Run: npx tsx scripts/qa/templates-full.mts   (exit code 1 on failures)
import { readFile } from 'node:fs/promises';
import type { ChildProfile, ThemeId } from '../../src/lib/program/types';
import { THEME_IDS } from '../../src/lib/program/themes';
import { setSceneArt } from '../../src/lib/program/story';
import { placeChild } from '../../src/lib/program/engine';
import { templateContentFor } from '../../src/lib/program/templates';
import { validateContent, storyFacts, weekFacts, ContentInvalid } from '../../src/lib/server/ai';

setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
let n = 0; const fails = new Map<string, string[]>();
for (const theme of THEME_IDS as ThemeId[]) for (const age of [3, 4, 5, 6] as const) for (const skills of [{}, { 'letter-names': 'got-it', 'letter-sounds': 'got-it' }] as any[]) {
  const p: ChildProfile = { id: `c_${theme}${age}`, ageYears: age, skills, interests: [theme], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '' };
  for (const wk of placeChild(p).weeks) {
    if (wk.index === 1 && wk.baseWeek === 1) continue; // hand-written free week 1
    const c = templateContentFor(p, wk);
    const f = weekFacts(p, wk);
    const sf = storyFacts(f, { id: c.story.pathId });
    n++;
    try { validateContent({ ...c, story: sf ? c.story : c.story }, f, sf); } catch (e) {
      if (!(e instanceof ContentInvalid)) throw e;
      const k = e.message.replace(/"[^"]*"/g, '"…"').replace(/^page \d+/, 'page');
      if (!fails.has(k)) fails.set(k, []);
      fails.get(k)!.push(`${theme} age ${age} week ${wk.index}: ${e.message}`);
    }
  }
}
const total = [...fails.values()].reduce((a, b) => a + b.length, 0);
console.log(`${n} template weeks, ${total} fail the AI validator`);
for (const [k, v] of fails) console.log(`  ${v.length}  ${k}\n     e.g. ${v[0]}`);
if (total) process.exitCode = 1;
