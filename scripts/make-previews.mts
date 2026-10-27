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
import { PLANS, buildWeekPack, preKWeekForLetter } from '../src/lib/homeschool';
import { buildMathPage } from '../src/lib/mathSheets';
import { FAMILY_INFO, buildFamilyPage } from '../src/lib/wordFamilies';
import { loadThemeIcons } from '../src/lib/program/themes';
import { buildWordProblemPage } from '../src/lib/wordProblems';
import { PRESETS, DEFAULT_SUBJECTS, buildSchedulePage, loadScheduleIcons } from '../src/lib/schedule';

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

// Homeschool weekly packs: the plan page and a hunt page, as the pack maker shows them with no name typed.
const pack = (level: 'pre-k' | 'kindergarten', n: number) => buildWeekPack({ level, week: PLANS[level].weeks[n - 1], name: '', paper: 'letter', credit: true, bubble: bubbleFont });
jobs.push(render('homeschool-prek', 'homeschool-preschool-week-2', pack('pre-k', 2)[0],
  'Homeschool preschool weekly plan page for letter S, with a Monday to Friday checklist and ideas away from the paper'));
jobs.push(render('homeschool-k', 'homeschool-kindergarten-word-family', pack('kindergarten', 15)[2],
  'Kindergarten word family worksheet: circle the -at words like cat, hat and mat'));
jobs.push(render('homeschool-faith', 'christian-homeschool-verse-page',
  buildWeekPack({ level: 'pre-k', week: PLANS['pre-k'].weeks[3], name: '', paper: 'letter', credit: true, bubble: bubbleFont, faith: true })[1],
  'Christian homeschool preschool verse page: Psalm 23:1 in a starred box with The LORD is my shepherd to trace on handwriting lines'));
// Pre-K math worksheets: the maker's default page (ten frames, 1 to 10).
jobs.push(render('prek-math', 'pre-k-math-ten-frames', buildMathPage({ kind: 'ten-frame', range: 10, number: 5, compare: 'more', name: '', paper: 'letter', credit: true, seed: 1 }),
  'Pre-K math worksheet with six ten frames: count the dots in each frame and write how many in the box'));
// Ten frame printables: the Make 10 page (the maker opens on the blank frame, which makes a poor preview).
jobs.push(render('ten-frames', 'ten-frame-worksheet-make-10', buildMathPage({ kind: 'make-ten', range: 10, number: 5, compare: 'more', name: '', paper: 'letter', credit: true, seed: 1, series: 'ten-frames' }),
  'Make 10 ten frame worksheet: six ten frames with some dots, draw the rest and write how many more make 10'));
// Kindergarten more or less: the greater than, less than page (the most searched of the four types).
jobs.push(render('more-or-less', 'kindergarten-greater-than-less-than-worksheet', buildMathPage({ kind: 'compare-symbols', range: 10, number: 5, compare: 'more', name: '', paper: 'letter', credit: true, seed: 1, series: 'more-less' }),
  'Kindergarten greater than less than worksheet: compare two numbers from 1 to 10 with dots under each, and write >, < or = in the circle'));
// Kindergarten addition: picture addition within 10 (the maker's default page).
jobs.push(render('k-addition', 'kindergarten-picture-addition-worksheet', buildMathPage({ kind: 'add-pictures', range: 10, number: 5, compare: 'more', name: '', paper: 'letter', credit: true, seed: 1, series: 'k-addition' }),
  'Kindergarten picture addition worksheet within 10: count two groups of shapes, then write how many in all'));
// Kindergarten subtraction: subtraction with pictures within 10 (the maker's default page).
jobs.push(render('k-subtraction', 'kindergarten-subtraction-worksheet-with-pictures', buildMathPage({ kind: 'subtract-pictures', range: 10, number: 5, compare: 'more', name: '', paper: 'letter', credit: true, seed: 1, series: 'k-subtraction' }),
  'Kindergarten subtraction worksheet with pictures within 10: some shapes are crossed out, count how many are left and write the number'));
// Kindergarten addition and subtraction: mixed picture problems within 10 (the maker's default page).
jobs.push(render('k-mixed', 'addition-and-subtraction-worksheet-kindergarten', buildMathPage({ kind: 'mixed-pictures', range: 10, number: 5, compare: 'more', name: '', paper: 'letter', credit: true, seed: 1, series: 'k-mixed' }),
  'Kindergarten addition and subtraction worksheet within 10: some rows add two groups of shapes, some rows have shapes crossed out to take away'));
// Kindergarten word problems: addition within 5 with farm animals (the maker's default page).
await loadThemeIcons(['farm'], (u) => readFile(path.join(ROOT, 'public', u), 'utf8'));
jobs.push(render('k-word-problems', 'kindergarten-word-problems-worksheet', buildWordProblemPage({ kind: 'wp-add', range: 5, theme: 'farm', name: '', paper: 'letter', credit: true, seed: 1 }),
  'Kindergarten word problems worksheet within 5: short farm animal stories to read aloud, with pictures to count and a number sentence to fill in'));
// Preschool schedule: the picture schedule for a homeschool morning (the maker's default page) and the weekly chart.
await loadScheduleIcons((u) => readFile(path.join(ROOT, 'public', u), 'utf8'));
jobs.push(render('preschool-schedule', 'preschool-daily-visual-schedule', buildSchedulePage({ kind: 'day', name: '', paper: 'letter', credit: true, steps: PRESETS[0].steps, subjects: DEFAULT_SUBJECTS }),
  'Printable preschool daily schedule with pictures: wake up, get dressed, breakfast, brush teeth, letters, numbers, snack, play outside, story time and lunch, each with a box to check off'));
jobs.push(render('preschool-schedule-week', 'preschool-homeschool-weekly-schedule', buildSchedulePage({ kind: 'week', name: '', paper: 'letter', credit: true, steps: PRESETS[0].steps, subjects: DEFAULT_SUBJECTS }),
  'Preschool homeschool weekly schedule chart: Monday to Friday rows for letters, numbers, read aloud, art and fine motor, outside time, and music and movement'));
// Word families: the hub shows the -at word hunt; each family page shows its word family house.
jobs.push(render('word-families', 'word-family-worksheet-at-hunt', buildFamilyPage({ family: 'at', kind: 'hunt', name: '', paper: 'letter', credit: true, seed: 1 }),
  'Word family worksheet: find and circle the -at words like cat, hat and mat among -an, -ap and -ag words'));
for (const f of FAMILY_INFO) {
  jobs.push(render(`wf-${f.slug}`, `${f.slug}-word-family-house`, buildFamilyPage({ family: f.slug, kind: 'house', name: '', paper: 'letter', credit: true, seed: 1 }),
    `-${f.slug} word family house worksheet: write a first letter, trace -${f.slug} and read words like ${f.words.slice(0, 3).join(', ')}`));
}
for (const l of 'abcdefghijklmnopqrstuvwxyz') {
  const U = l.toUpperCase();
  jobs.push(render(`lotw-${l}`, `letter-of-the-week-${l}`, pack('pre-k', preKWeekForLetter(l).n)[2],
    `Letter ${U} of the week letter hunt worksheet: find and circle every capital ${U} and lowercase ${l}`));
}

const sizes = await Promise.all(jobs);
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
await writeFile(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
const total = sizes.reduce((a, b) => a + b, 0);
console.log(`${sizes.length} previews, ${(total / 1024).toFixed(0)} KB total, largest ${(Math.max(...sizes) / 1024).toFixed(1)} KB`);
