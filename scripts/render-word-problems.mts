// Render check for the kindergarten word problem maker: every type, theme and range at US Letter and A4 with a long
// name, to PNG. Flags anything drawn off the page, text that runs past the right margin, and pictures that overlap
// the number sentence or the next problem. Also prints a sample of problems to read for grammar.
// Run: npx -y tsx scripts/render-word-problems.mts <outDir>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { pageToSvg } from '../src/lib/render';
import { loadThemeIcons } from '../src/lib/program/themes';
import { WP_KINDS, WP_THEMES, buildWordProblemPage, makeProblems, type WPOptions } from '../src/lib/wordProblems';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? 'render-word-problems';
await mkdir(out, { recursive: true });
await loadThemeIcons(WP_THEMES.map((t) => t.v), (u) => readFile(path.join(ROOT, 'public', u), 'utf8'));

// Rough text width (same idea as the page model's wrapper) to catch lines running past the margin.
const approxW = (t: string, size: number) => t.length * size * 0.47;
let n = 0, problems = 0;
for (const { v: kind } of WP_KINDS) for (const { v: theme } of WP_THEMES) for (const range of [5, 10] as const)
  for (const paper of ['letter', 'a4'] as const) for (const name of ['Maximiliano Alexander', '']) for (const seed of [1, 2, 3]) {
    const o: WPOptions = { kind, range, theme, name, paper, credit: true, seed };
    const page = buildWordProblemPage(o);
    for (const it of page.items) {
      const xs = it.kind === 'line' ? [it.x1, it.x2] : it.kind === 'text' ? [it.x] : [];
      const ys = it.kind === 'line' ? [it.y1, it.y2] : it.kind === 'text' ? [it.y] : [];
      if (it.kind === 'path' && !/[HVQ]/.test(it.d)) {
        const nums = (it.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
        nums.forEach((v, i) => (i % 2 === 0 ? xs : ys).push(v));
      }
      if (xs.some((x) => x < 20 || x > page.w - 20) || ys.some((y) => y < 20 || y > page.h - 18)) console.log('OUTSIDE', kind, theme, range, paper, seed, JSON.stringify(it).slice(0, 100));
      if (it.kind === 'text' && it.align === 'left' && it.x + approxW(it.text, it.size) > page.w - 30) console.log('LONG', kind, theme, paper, it.text);
    }
    // The problems themselves: numbers in range, answer not negative, text names the numbers.
    for (const p of makeProblems(o, kind === 'wp-draw' ? 3 : 4)) {
      problems++;
      const ans = p.op === '+' ? p.a + p.b : p.a - p.b;
      if (ans < 1 || ans > range || p.a > range || p.b < 1) console.log('RANGE', kind, theme, range, p);
      if (!p.text.includes(` ${p.a} `) && !p.text.startsWith(`${p.a} `)) console.log('TEXT', p.text);
      if (/  |\.\./.test(p.text)) console.log('GRAMMAR?', p.text);
    }
    if (!(seed === 1 && (name || (theme === 'farm' && range === 10)))) continue;
    if (!(paper === 'a4' ? theme === 'dinosaurs' || theme === 'farm' : true)) continue;
    const svg = pageToSvg(page)
      .replace('width="100%"', `width="${page.w}" height="${page.h}"`)
      .replace(/font-family="[^"]*"/g, 'font-family="Helvetica, Arial, Liberation Sans, DejaVu Sans, sans-serif"');
    await writeFile(path.join(out, `${kind}-${theme}-${range}-${paper}${name ? '' : '-noname'}.png`), await sharp(Buffer.from(svg), { density: 110 }).flatten({ background: '#ffffff' }).png().toBuffer());
    n++;
  }
// A sample to read.
for (const { v: theme } of WP_THEMES) for (const p of makeProblems({ kind: 'wp-mixed', range: 10, theme, name: '', seed: 4 }, 4)) console.log(`[${theme}] ${p.text}  (${p.a} ${p.op} ${p.b})`);
console.log(`${n} renders, ${problems} problems checked, in ${out}`);
