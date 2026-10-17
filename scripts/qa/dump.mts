import { readFile } from 'node:fs/promises';
import { THEME_IDS } from '../../src/lib/program/themes';
import { setSceneArt, readyPaths } from '../../src/lib/program/story';
import { SCENES, sceneById } from '../../src/lib/program/scenes';
import { STORY_TEXTS } from '../../src/lib/program/storyTexts';
setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
for (const t of THEME_IDS) {
  console.log(`\n######## ${t}  cast: ${SCENES[t].cast.map(c=>c.name+'('+c.kind+','+c.pronoun+')').join(', ')}`);
  for (const lv of ['pre-k','kindergarten'] as const) for (const p of readyPaths(t, lv)) {
    const tx = STORY_TEXTS[t][p.id];
    console.log(`\n== ${t}/${lv}/${p.id} "${tx?.title}" catalog=${p.scenes.length} fitted=${p.fitted.length} dropped=${p.scenes.filter(x=>!p.fitted.includes(x)).join(',')} textScenes=${tx?.pages.map(x=>x[0]).join(',')===p.fitted.join(',')?'same':'DIFF '+tx?.pages.map(x=>x[0]).join(',')}`);
    for (const id of p.fitted) { const sc = sceneById(t,id)!; const txt = tx.pages.find(x=>x[0]===id)?.[1];
      console.log(` [${sc.beat}] ${id} | cast=${sc.cast.join('+')} | ${sc.shows}\n     TEXT: ${txt}`); }
  }
  const all = new Set(Object.keys(STORY_TEXTS[t]));
  const rp = new Set([...readyPaths(t,'pre-k'),...readyPaths(t,'kindergarten')].map(p=>p.id));
  for (const k of all) if (!rp.has(k)) console.log('TEXT WITHOUT READY PATH', t, k);
  for (const p of SCENES[t].paths) if (!rp.has(p.id)) console.log('CATALOG PATH NOT READY', t, p.id);
}
