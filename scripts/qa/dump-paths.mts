// Prints every ready story path as it prints (trimmed to the book), with each page's picture and template words.
// Run: npx tsx scripts/qa/dump-paths.mts [theme]
import { readFile } from 'node:fs/promises';
import { SCENES, sceneById } from '../../src/lib/program/scenes';
import { setSceneArt, readyPaths } from '../../src/lib/program/story';
import { STORY_TEXTS } from '../../src/lib/program/storyTexts';
import type { ThemeId } from '../../src/lib/program/types';

setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
const only = process.argv[2];
for (const T of Object.values(SCENES)) {
  if (only && T.theme !== only) continue;
  for (const level of ['pre-k', 'kindergarten'] as const) for (const p of readyPaths(T.theme as ThemeId, level)) {
    const text = new Map(STORY_TEXTS[T.theme][p.id]?.pages ?? []);
    console.log(`\n== ${T.theme}/${level}/${p.id} "${p.title}" dropped: ${p.scenes.filter((s) => !p.fitted.includes(s)).join(', ') || '-'}`);
    for (const id of p.fitted) {
      const sc = sceneById(T.theme as ThemeId, id)!;
      console.log(`  [${sc.beat}] ${id} (${sc.cast.join('+') || 'no cast'}): ${sc.shows}\n      ${text.get(id)}`);
    }
  }
}
