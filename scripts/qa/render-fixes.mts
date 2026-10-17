// Renders the printables touched by the QA fixes straight from the page builders (no browser), as PDFs plus the
// plan text, so they can be rasterized and looked at.
// Run: npx tsx scripts/qa/render-fixes.mts <out dir>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pagesToPdf } from '../../src/lib/render';
import { loadFont } from '../../src/lib/fontshape';
import { PLANS, buildWeekPack, preKWeekForLetter } from '../../src/lib/homeschool';
import { buildMathPage } from '../../src/lib/mathSheets';
import { buildWordPages } from '../../src/lib/rowSheet';
import { buildColoringPage } from '../../src/lib/coloring';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.argv[2] ?? path.join(ROOT, 'scripts/qa/out/fixes');
await mkdir(OUT, { recursive: true });
const fetcher = async (url: string) => { const b = await readFile(path.join(ROOT, 'public', url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
const bubble = await loadFont('bubble', fetcher);
const save = async (name: string, pages: Parameters<typeof pagesToPdf>[0]) => { await writeFile(path.join(OUT, `${name}.pdf`), await pagesToPdf(pages)); console.log('wrote', name, pages.length); };
const texts = (pages: ReturnType<typeof buildWeekPack>) => pages[0].items.filter((i) => i.kind === 'text').map((i) => (i as { text: string }).text).join('\n');

// Letter weeks for x and q (pre-K), and the kindergarten weeks that include x and q.
for (const l of ['x', 'q', 'u']) {
  const pages = buildWeekPack({ level: 'pre-k', week: preKWeekForLetter(l), name: 'José', paper: 'letter', credit: true, bubble });
  await save(`week-prek-${l}`, pages);
  await writeFile(path.join(OUT, `week-prek-${l}.txt`), texts(pages));
}
for (const w of PLANS.kindergarten.weeks.filter((w) => w.kind === 'letter' && w.letters.some((l) => 'xq'.includes(l)))) {
  const pages = buildWeekPack({ level: 'kindergarten', week: w, name: 'Mary-Kate', paper: 'letter', credit: true, bubble });
  await save(`week-k-${w.n}`, pages);
  await writeFile(path.join(OUT, `week-k-${w.n}.txt`), texts(pages));
}
// Review week that includes x.
const rev = PLANS['pre-k'].weeks.find((w) => w.kind === 'review' && w.letters.includes('x'));
if (rev) { const p = buildWeekPack({ level: 'pre-k', week: rev, name: '', paper: 'letter', credit: true, bubble }); await save(`week-prek-review-x`, p); await writeFile(path.join(OUT, 'week-prek-review-x.txt'), texts(p)); }

// Blank ten frame mats.
for (const blank of ['one', 'double', 'six'] as const) {
  await save(`tenframe-blank-${blank}`, [buildMathPage({ kind: 'blank-frame', range: 10, number: 1, compare: 'more', name: 'McKenzie', paper: 'letter', credit: true, seed: 1, blank, series: 'ten-frames' })]);
}

// Word tracing: long words that fit only once, with and without the solid example.
const lines = ['Maximiliana Christabel', 'supercalifragilistic', 'José', 'hippopotamus', 'Wednesday'];
for (const size of ['large', 'medium'] as const) {
  await save(`words-${size}-model`, buildWordPages({ lines, size, paper: 'letter', practice: 'trace-write', startDots: true, model: true, credit: true }));
  await save(`words-${size}-nomodel`, buildWordPages({ lines, size, paper: 'letter', practice: 'trace', startDots: true, model: false, credit: true }));
}

// Coloring pages: long names, one long word, three words, A4.
for (const [i, name] of ['Maximiliana Christabel', 'Wolfeschlegelsteinhausen', 'Anna Maria Lucia Rose', 'Bo', 'Happy Birthday Grandma'].entries()) {
  await save(`coloring-${i}`, [buildColoringPage(bubble, { name, theme: 'stars', paper: i === 2 ? 'a4' : 'letter', credit: true, caps: i !== 4 })]);
}
