// Render check for the preschool schedule maker (/preschool-schedule/): every page type and preset at US Letter and
// A4, with a long name, no name, long custom labels and long times, to PNG. Flags anything drawn off the page and
// text that runs past its margin. Also builds a real PDF of each type to be sure the text encodes.
// Run: npx -y tsx scripts/render-schedule.mts <outDir>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { pageToSvg, pagesToPdf } from '../src/lib/render';
import { textW } from '../src/lib/homeschool';
import { ACTIVITIES, PRESETS, SCHEDULE_KINDS, SUBJECTS, DEFAULT_SUBJECTS, buildSchedulePage, loadScheduleIcons, type ScheduleOptions, type Step } from '../src/lib/schedule';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? 'render-schedule';
await mkdir(out, { recursive: true });
await loadScheduleIcons((u) => readFile(path.join(ROOT, 'public', u), 'utf8'));

const longSteps: Step[] = ACTIVITIES.slice(0, 12).map((a, i) => ({ icon: a.icon, label: i % 3 === 0 ? 'Practice writing letters' : a.label, time: i % 2 ? '10:45 am' : '' }));
const allSubjects = SUBJECTS.map((s) => s.id);
const cases: { tag: string; steps: Step[]; subjects: string[] }[] = [
  ...PRESETS.map((p) => ({ tag: p.v, steps: p.steps, subjects: DEFAULT_SUBJECTS })),
  { tag: 'long', steps: longSteps, subjects: allSubjects },
  { tag: 'four', steps: PRESETS[2].steps.slice(0, 4), subjects: allSubjects.slice(0, 4) },
];
let n = 0, issues = 0;
for (const { v: kind } of SCHEDULE_KINDS) for (const c of cases) for (const paper of ['letter', 'a4'] as const) for (const name of ['Maximiliano Alexander Montgomery', 'Maya', '']) {
  if (kind === 'week' && c.tag !== 'morning' && c.tag !== 'long' && c.tag !== 'four') continue;
  const o: ScheduleOptions = { kind, name, paper, credit: true, steps: c.steps, subjects: c.subjects };
  const page = buildSchedulePage(o);
  for (const it of page.items) {
    const xs = it.kind === 'line' ? [it.x1, it.x2] : [];
    const ys = it.kind === 'line' ? [it.y1, it.y2] : it.kind === 'text' ? [it.y] : [];
    if (it.kind === 'text') {
      const wd = textW(it.text, it.size);
      const x0 = it.align === 'left' ? it.x : it.align === 'right' ? it.x - wd : it.x - wd / 2;
      xs.push(x0, x0 + wd);
    }
    if (it.kind === 'path' && !/[HVQ]/.test(it.d)) {
      const nums = (it.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
      nums.forEach((v, i) => (i % 2 === 0 ? xs : ys).push(v));
    }
    if (xs.some((x) => x < 30 || x > page.w - 30) || ys.some((y) => y < 30 || y > page.h - 20)) { issues++; console.log('OUTSIDE', kind, c.tag, paper, name, JSON.stringify(it).slice(0, 120)); }
  }
  if (name === 'Maya' && c.tag !== 'long') continue;
  const svg = pageToSvg(page)
    .replace('width="100%"', `width="${page.w}" height="${page.h}"`)
    .replace(/font-family="[^"]*"/g, 'font-family="Helvetica, Arial, Liberation Sans, DejaVu Sans, sans-serif"');
  await writeFile(path.join(out, `${kind}-${c.tag}-${paper}${name ? (name === 'Maya' ? '-maya' : '-long') : '-noname'}.png`), await sharp(Buffer.from(svg), { density: 100 }).flatten({ background: '#ffffff' }).png().toBuffer());
  n++;
}
for (const { v: kind } of SCHEDULE_KINDS) {
  const bytes = await pagesToPdf([buildSchedulePage({ kind, name: 'José Núñez', paper: 'letter', credit: true, steps: longSteps, subjects: allSubjects })], 'Schedule test');
  await writeFile(path.join(out, `${kind}.pdf`), bytes);
}
console.log(`${n} renders, ${issues} issues, PDFs built, in ${out}`);
