// Lists every template picture book story that fails the scene story validator, for every theme, level, path and
// kind of week (the test stops at the first failure; this shows them all). Also prints each story for reading.
// Run: npx tsx scripts/story-v2-lint.mts [--print]
import { SCENES } from '../src/lib/program/scenes';
import { setSceneArt, readyPaths, type SceneArtManifest } from '../src/lib/program/story';
import { sceneStoryFor, PLANS } from '../src/lib/program/templates';
import { THEME_IDS } from '../src/lib/program/themes';
import { validateStory, storyFacts, weekFacts } from '../src/lib/server/ai';
import type { ProgramWeek } from '../src/lib/program/types';

const m: SceneArtManifest = { pathsReady: {} };
for (const T of Object.values(SCENES)) { m[T.theme] = Object.fromEntries(T.scenes.map((s) => [s.id, { w: 4, h: 3 }])); m.pathsReady![T.theme] = T.paths.map((p) => p.id); }
setSceneArt(m);
const print = process.argv.includes('--print');
const weeks = { 'pre-k': [1, 2, 5, 34, 36], kindergarten: [1, 2, 14, 15, 19, 28, 35, 36] } as const;
let bad = 0, n = 0;
for (const theme of THEME_IDS) for (const level of ['pre-k', 'kindergarten'] as const) readyPaths(theme, level).forEach((path, k) => {
  for (const bw of weeks[level]) {
    const pw: ProgramWeek = { index: bw, level, baseWeek: bw, theme, focus: [] };
    const st = sceneStoryFor(theme, level, PLANS[level].weeks[bw - 1], pw, k)!;
    const facts = storyFacts(weekFacts({ id: 'c_x', ageYears: level === 'pre-k' ? 4 : 5, skills: {}, interests: [theme], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16' }, pw), { id: path.id })!;
    n++;
    try { validateStory(st, facts); } catch (e) { bad++; console.log(`${theme}/${path.id} ${level} week ${bw}: ${(e as Error).message}`); }
    if (print && bw === weeks[level][1]) console.log(`\n# ${theme}/${path.id} (${level}) ${st.title}\n${st.pages.map((p, i) => `${i + 1}. ${p}`).join('\n')}`);
  }
});
console.log(`${n - bad} of ${n} template stories pass`);
if (bad) process.exitCode = 1;
