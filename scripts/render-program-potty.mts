// Render check for the members' potty sticker chart on /account/ (ProgramDashboard): every theme, Letter and A4, long,
// hyphenated, short and no name, plus a week 1 pack with the chart as its last page (PDF). Run: npx tsx scripts/render-program-potty.mts <outDir>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const R = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { pageToSvg, pagesToPdf } = await import(R + '/src/lib/render.ts');
const sch = await import(R + '/src/lib/schedule.ts');
const { loadThemeIcons, THEME_IDS } = await import(R + '/src/lib/program/themes.ts');
const { placeChild } = await import(R + '/src/lib/program/engine.ts');
const { buildProgramWeek } = await import(R + '/src/lib/program/pages.ts');
const { templateContentFor } = await import(R + '/src/lib/program/templates.ts');
const { setSceneArt } = await import(R + '/src/lib/program/story.ts');
const out = process.argv[2]; await mkdir(out, { recursive: true });
const rp = (u: string) => readFile(path.join(R, 'public', u), 'utf8');
await sch.loadScheduleIcons(rp); await loadThemeIcons(THEME_IDS, rp);
setSceneArt(JSON.parse(await readFile(R + '/src/lib/program/sceneArt.json', 'utf8')));
// Same call as ProgramDashboard's pottyPage.
// Pass 'credit' as the second argument for the free week's version (footer line on), as ProgramPlacement builds it.
const credit = process.argv[3] === 'credit';
const potty = (name: string, paper: any, theme: any) => sch.buildSchedulePage({ kind: 'stickers', name, paper, credit, steps: [], subjects: [], routine: 'potty', boxes: 5, reward: '', theme });
let issues = 0, n = 0;
for (const paper of ['letter', 'a4']) for (const name of ['Maximiliano Alexander Montgomery', 'Christabel-Anastasia', 'Mo', '']) for (const theme of ['stars', ...THEME_IDS]) {
  const pg = potty(name, paper, theme); n++;
  for (const it of pg.items as any[]) {
    const xs = it.kind === 'line' ? [it.x1, it.x2] : it.kind === 'text' ? [it.x] : it.kind === 'image' ? [it.x, it.x + it.w] : it.kind === 'dot' ? [it.cx] : [];
    const ys = it.kind === 'line' ? [it.y1, it.y2] : it.kind === 'text' ? [it.y] : it.kind === 'image' ? [it.y, it.y + it.h] : it.kind === 'dot' ? [it.cy] : [];
    if (xs.some((x: number) => x < 30 || x > pg.w - 30) || ys.some((y: number) => y < 30 || y > pg.h - 20)) { issues++; console.log('OUTSIDE', paper, name, theme, JSON.stringify(it).slice(0, 100)); }
    if (it.kind === 'text' && it.text?.includes('Maximiliano Alexander')) { issues++; console.log('FULL LONG NAME', theme); }
  }
  if (name.startsWith('Max') || (name === '' && theme === 'unicorns') || (name === 'Mo' && theme === 'trucks')) {
    const svg = pageToSvg(pg).replace('width="100%"', `width="${pg.w}" height="${pg.h}"`).replace(/font-family="[^"]*"/g, 'font-family="DejaVu Sans, sans-serif"');
    // inline icon hrefs not needed: icons are paths
    await sharp(Buffer.from(svg)).png().toFile(path.join(out, `${paper}-${theme}-${name ? name.slice(0, 3) : 'none'}.png`));
  }
}
// Week 1 pack with the chart as the last page, as the dashboard builds it.
const kid = { id: 'c_test0001', ageYears: 4, skills: {}, interests: ['dinosaurs', 'space'], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-11-05T00:00:00.000Z' } as any;
const plan = placeChild(kid); const wk = plan.weeks[0];
for (const paper of ['letter', 'a4']) {
  const pages = buildProgramWeek({ name: 'Maximiliano Alexander', profile: kid, week: wk, content: templateContentFor(kid, wk), paper, credit, bubble: null, planLength: plan.weeks.length });
  pages.push(potty('Maximiliano Alexander', paper, 'dinosaurs'));
  const textOnly = pages.map((p: any) => ({ ...p, items: p.items.filter((i: any) => i.kind !== 'image') }));
  const pdf = await pagesToPdf(textOnly, 'test'); await writeFile(path.join(out, `week1-${paper}.pdf`), pdf);
  console.log(paper, 'week 1 pages', pages.length, 'level', wk.level, 'pdf bytes', pdf.length);
}
console.log(n, 'renders', issues, 'issues');
