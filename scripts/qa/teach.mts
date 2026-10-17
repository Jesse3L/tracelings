import { readFile } from 'node:fs/promises';
import { THEME_IDS } from '../../src/lib/program/themes';
import { setSceneArt, readyPaths } from '../../src/lib/program/story';
import { sceneStoryFor } from '../../src/lib/program/templates';
import { STORY_TEXTS } from '../../src/lib/program/storyTexts';
import { PLANS } from '../../src/lib/homeschool';
setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
const lines = new Map<string, Set<string>>();
for (const theme of THEME_IDS) for (const level of ['pre-k','kindergarten'] as const) { const rp = readyPaths(theme, level);
  for (let k=0;k<rp.length;k++) for (const [wi,w] of PLANS[level].weeks.entries()) {
    const st = sceneStoryFor(theme, level, w, {index:wi+1,level,baseWeek:wi+1,theme,focus:[]}, k)!;
    const raw = STORY_TEXTS[theme][rp[k].id].pages.map(p=>p[1]);
    st.pages.forEach((p,i)=>{ if (raw[i].includes('{W}')) { const base = raw[i].replace(/\s*\{W\}/,''); const add = p.slice(base.length).trim(); const key = `${level} w${wi+1} ${w.kind} ${(w.letters||[]).join('')}${w.family??''}`; if(!lines.has(key)) lines.set(key,new Set()); lines.get(key)!.add(add||'(none)'); } });
  } }
for (const [k,v] of lines) console.log(k, '=>', [...v].join(' | '));
