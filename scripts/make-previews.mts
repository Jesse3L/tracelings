// Renders static WebP previews of the worksheets so search engines (Google Images especially) have real,
// indexable images. The on-page tools draw their previews client-side as SVG, which crawlers can't index.
//
// Uses the same page builders as the tools, so the images match what a visitor gets by default.
// Run: npm run previews   (writes public/previews/*.webp and src/data/previews.json)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { buildRangePages } from '../src/lib/rowSheet';
import { buildSheet, rowKinds, type Page, type SheetOptions } from '../src/lib/sheet';
import { pageToSvg } from '../src/lib/render';
import { buildCursiveSheet } from '../src/lib/cursive';
import { buildColoringPage } from '../src/lib/coloring';
import { loadFont } from '../src/lib/fontshape';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/previews');
const MANIFEST = path.join(ROOT, 'src/data/previews.json');
const WIDTH = 800;

const sightLevels: { slug: string; short: string; dolch: string; words: string[] }[] = JSON.parse(
  await readFile(path.join(ROOT, 'src/data/sight-words.json'), 'utf8'),
);

// Fonts are read from public/ instead of fetched over HTTP.
const fetcher = async (url: string) => {
  const buf = await readFile(path.join(ROOT, 'public', url));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
};
const cursiveFont = await loadFont('cursive', fetcher);
const bubbleFont = await loadFont('bubble', fetcher);

// The defaults every Tracer tool opens with. credit is on, as for a visitor who isn't a member.
const TRACER: Omit<SheetOptions, 'name' | 'rowTexts'> = {
  style: 'capital', size: 'large', paper: 'letter', practice: 'trace-write', startDots: true, modelRow: true, credit: true,
};

type Entry = { src: string; width: number; height: number; alt: string };
const manifest: Record<string, Entry> = {};

async function render(key: string, file: string, page: Page, alt: string) {
  // Use the PDF's own font stack name but make sure something sans-serif renders the Name/Date labels.
  const svg = pageToSvg(page)
    .replace('width="100%"', `width="${page.w}" height="${page.h}"`)
    .replace(/font-family="[^"]*"/g, 'font-family="Helvetica, Arial, Liberation Sans, DejaVu Sans, sans-serif"');
  const { data, info } = await sharp(Buffer.from(svg), { density: 200 })
    .resize({ width: WIDTH })
    .flatten({ background: '#ffffff' })
    .webp({ quality: 80, effort: 6 })
    .toBuffer({ resolveWithObject: true });
  await writeFile(path.join(OUT, `${file}.webp`), data);
  manifest[key] = { src: `/previews/${file}.webp`, width: info.width, height: info.height, alt };
  return data.length;
}

await mkdir(OUT, { recursive: true });
const jobs: Promise<number>[] = [];

// Letters a–z, as the letter page's tool shows them by default ("Both": "A a", then A rows, then a rows).
for (const l of 'abcdefghijklmnopqrstuvwxyz') {
  const U = l.toUpperCase();
  jobs.push(render(`letter-${l}`, `letter-tracing-${l}`, buildSheet({ ...TRACER, name: '', rowTexts: [`${U} ${l}`, U, l] }),
    `Letter ${U} tracing worksheet with uppercase ${U} and lowercase ${l} on dotted handwriting lines, with green starting dots`));
}

// Digits 0–9, as the number page's tool shows them.
for (const d of '0123456789') {
  jobs.push(render(`number-${d}`, `number-tracing-${d}`, buildSheet({ ...TRACER, name: '', rowTexts: [d] }),
    `Number ${d} tracing worksheet with rows of dotted ${d}s to trace on handwriting lines, with green starting dots`));
}

// Number ranges, exactly as the 1-10 and 1-20 pages' tool shows them by default (one page, medium, trace then write).
for (const [key, to, alt] of [
  ['1-10', 10, 'Number 1 to 10 tracing worksheet: each row starts with a solid number followed by dotted copies to trace, with green starting dots'],
  ['1-20', 20, 'Number 1 to 20 tracing worksheet on one page, in two columns from 1 to 10 and 11 to 20, with dotted numbers to trace and green starting dots'],
] as const) {
  const page = buildRangePages({ from: 1, to, layout: 'page', size: 'medium', paper: 'letter', practice: 'trace-write', startDots: true, credit: true })[0];
  jobs.push(render(`number-${key}`, `number-tracing-${key}`, page, alt));
}

// Bubble letters: the capital letter in big outlined bubble letters, no shapes around it.
for (const l of 'abcdefghijklmnopqrstuvwxyz') {
  const U = l.toUpperCase();
  jobs.push(render(`bubble-${l}`, `bubble-letter-${l}`, buildColoringPage(bubbleFont, { name: U, theme: 'plain', paper: 'letter', caps: true, credit: true }),
    `Bubble letter ${U} outline to color, a big printable capital ${U} coloring page`));
}

// Cursive letters: capital and lowercase pair, like the cursive alphabet tool ("Aa Bb Cc …").
for (const l of 'abcdefghijklmnopqrstuvwxyz') {
  const U = l.toUpperCase();
  jobs.push(render(`cursive-${l}`, `cursive-${l}`,
    buildCursiveSheet(cursiveFont, { text: `${U}${l}`, size: 'large', paper: 'letter', practice: 'trace-write', modelRow: true, credit: true }),
    `Cursive capital ${U} and lowercase ${l} tracing worksheet with a solid example row and gray letters to trace on handwriting lines`));
}

// Sight word levels: first page of the level's sheet, mirroring Tracer's words mode (first 8 words chosen).
const wordCase = (w: string) => (w === 'I' ? w : w.toLowerCase());
for (const lvl of sightLevels) {
  const list = lvl.words.slice(0, 8).map(wordCase);
  const perPage = Math.max(1, rowKinds(TRACER).filter((k) => k === 'trace').length);
  const chunk = list.slice(0, perPage);
  jobs.push(render(`sight-${lvl.slug}`, `sight-words-${lvl.slug}`, buildSheet({ ...TRACER, name: '', rowTexts: [chunk[0], ...chunk] }),
    `${lvl.short} sight words tracing worksheet with Dolch ${lvl.dolch.toLowerCase()} words like ${chunk.slice(0, 3).join(', ')} to trace on handwriting lines`));
}

// Name samples.
jobs.push(render('name-tracing', 'name-tracing-sample', buildSheet({ ...TRACER, name: 'Emma' }),
  'Name tracing worksheet for the name Emma, with a solid example row, dotted rows to trace and blank lines to write'));
jobs.push(render('cursive-name', 'cursive-name-sample',
  buildCursiveSheet(cursiveFont, { text: 'Emma', size: 'large', paper: 'letter', practice: 'trace-write', modelRow: true, credit: true }),
  'Cursive name tracing worksheet for the name Emma, with joined cursive letters to trace on handwriting lines'));
jobs.push(render('name-coloring', 'name-coloring-sample', buildColoringPage(bubbleFont, { name: 'Emma', theme: 'stars', paper: 'letter', caps: true, credit: true }),
  'Name coloring page with EMMA in big bubble letters surrounded by stars to color'));

const sizes = await Promise.all(jobs);
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
await writeFile(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
const total = sizes.reduce((a, b) => a + b, 0);
console.log(`${sizes.length} previews, ${(total / 1024).toFixed(0)} KB total, largest ${(Math.max(...sizes) / 1024).toFixed(1)} KB`);
