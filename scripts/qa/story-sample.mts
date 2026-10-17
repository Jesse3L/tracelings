// Prints template picture book stories for a few weeks: npx tsx scripts/qa/story-sample.mts theme level week [path#] ...
// Each argument group is theme,level,week[,pathIndex]; with no arguments a small mixed sample prints.
import { readFile } from 'node:fs/promises';
import type { ThemeId } from '../../src/lib/program/types';
import { setSceneArt } from '../../src/lib/program/story';
import { sceneStoryFor, PLANS } from '../../src/lib/program/templates';

setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
const args = process.argv.slice(2);
const picks = args.length ? args.map((a) => a.split(',')) : [['dinosaurs', 'kindergarten', '15', '0'], ['dinosaurs', 'pre-k', '34', '0'], ['ocean', 'kindergarten', '2', '0'], ['trucks', 'pre-k', '5', '1'], ['castles', 'kindergarten', '11', '1'], ['sports', 'pre-k', '22', '0']];
for (const [theme, level, wk, k] of picks) {
  const lv = level as 'pre-k' | 'kindergarten';
  const w = Number(wk);
  const st = sceneStoryFor(theme as ThemeId, lv, PLANS[lv].weeks[w - 1], { index: w, level: lv, baseWeek: w, theme: theme as ThemeId, focus: [], ...(process.env.REVIEW ? { extraReview: true } : {}) }, Number(k ?? 0));
  console.log(`\n${theme} ${lv} week ${w} (${PLANS[lv].weeks[w - 1].title}) path ${st?.pathId}:`);
  st?.pages.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
}
