import { readFile } from 'node:fs/promises';
import { THEME_IDS } from '../../src/lib/program/themes';
import { bigBookPlan } from '../../src/lib/program/pages';
import { setSceneArt, readyPaths } from '../../src/lib/program/story';
import { sceneStoryFor } from '../../src/lib/program/templates';
setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
for (const t of THEME_IDS) for (const lv of ['pre-k','kindergarten'] as const) readyPaths(t, lv).forEach((p, k) => {
  const st = sceneStoryFor(t, lv, null, null, k)!; const pl = bigBookPlan({ name: 'Bo', theme: t }, st);
  const dup = st.scenes!.includes(pl.cover);
  console.log(`${t}/${lv}/${p.id} cover=${pl.cover}${dup ? '  <-- SAME AS A STORY PAGE (p' + (st.scenes!.indexOf(pl.cover)+1) + ')' : ''}`);
});
