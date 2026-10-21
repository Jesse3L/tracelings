// Render check: draws math worksheet types to PNG (US Letter and A4, with a long name) so they can be looked at before merging.
// Run: npx -y tsx scripts/render-check.mts <outDir> [kind ...]
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { pageToSvg } from '../src/lib/render';
import { buildMathPage, type MathKind, type MathOptions, type MathRange, type MathSeries } from '../src/lib/mathSheets';

const out = process.argv[2] ?? 'render-check';
const only = process.argv.slice(3);
await mkdir(out, { recursive: true });

const cases: [MathSeries, MathKind, MathRange[], ('more' | 'fewer')[]][] = [
  ['more-less', 'more-less', [5, 10, 20], ['more', 'fewer']],
  ['more-less', 'compare-numbers', [5, 10, 20], ['more', 'fewer']],
  ['more-less', 'compare-symbols', [5, 10, 20], ['more']],
  ['more-less', 'one-more-less', [5, 10, 20], ['more']],
  ['k-addition', 'add-pictures', [5, 10, 20], ['more']],
  ['k-addition', 'add-number-line', [5, 10, 20], ['more']],
  ['k-addition', 'add-facts', [5, 10, 20], ['more']],
  ['k-addition', 'subtract-pictures', [5, 10, 20], ['more']],
  ['k-subtraction', 'subtract-pictures', [5, 10, 20], ['more']],
  ['k-subtraction', 'subtract-cross', [5, 10, 20], ['more']],
  ['k-subtraction', 'subtract-number-line', [5, 10, 20], ['more']],
  ['k-subtraction', 'subtract-facts', [5, 10, 20], ['more']],
  ['k-mixed', 'mixed-pictures', [5, 10, 20], ['more']],
  ['k-mixed', 'mixed-number-line', [5, 10, 20], ['more']],
  ['k-mixed', 'mixed-facts', [5, 10, 20], ['more']],
  ['k-mixed', 'plus-minus', [5, 10, 20], ['more']],
];

let n = 0;
for (const [series, kind, ranges, compares] of cases) {
  if (only.length && !only.includes(kind)) continue;
  for (const range of ranges) for (const compare of compares) for (const paper of ['letter', 'a4'] as const) for (const seed of [1, 2]) {
    const o: MathOptions = { kind, range, number: 5, compare, name: 'Maximiliano Alexander', paper, credit: true, seed, series };
    const page = buildMathPage(o);
    // Anything drawn outside the page is a bug.
    for (const it of page.items) {
      const xs = it.kind === 'line' ? [it.x1, it.x2] : it.kind === 'dot' ? [it.cx] : it.kind === 'text' ? [it.x] : [];
      const ys = it.kind === 'line' ? [it.y1, it.y2] : it.kind === 'dot' ? [it.cy] : it.kind === 'text' ? [it.y] : [];
      if (xs.some((x) => x < 20 || x > page.w - 20) || ys.some((y) => y < 20 || y > page.h - 18)) console.log('OUTSIDE', kind, range, paper, seed, JSON.stringify(it).slice(0, 120));
    }
    if (seed === 2 && !(range === 10 && paper === 'letter')) continue; // keep the image count manageable
    const svg = pageToSvg(page)
      .replace('width="100%"', `width="${page.w}" height="${page.h}"`)
      .replace(/font-family="[^"]*"/g, 'font-family="Helvetica, Arial, Liberation Sans, DejaVu Sans, sans-serif"');
    const file = path.join(out, `${series}-${kind}-${range}-${compare}-${paper}-s${seed}.png`);
    await writeFile(file, await sharp(Buffer.from(svg), { density: 110 }).flatten({ background: '#ffffff' }).png().toBuffer());
    n++;
  }
}
console.log(`${n} renders in ${out}`);
