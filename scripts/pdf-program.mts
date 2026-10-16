// Builds one personalized week as a real PDF (same code path as the download button) so the PDF output can be checked.
// Run: npx tsx scripts/pdf-program.mts <out.pdf> [theme] [age]
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pagesToPdf } from '../src/lib/render';
import { loadFont } from '../src/lib/fontshape';
import { loadThemeIcons } from '../src/lib/program/themes';
import { placeChild } from '../src/lib/program/engine';
import { buildProgramWeek } from '../src/lib/program/pages';
import { templateContentFor } from '../src/lib/program/templates';
import type { ChildProfile, ThemeId } from '../src/lib/program/types';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [out = 'program-week.pdf', theme = 'sports', age = '5'] = process.argv.slice(2);
await loadThemeIcons([theme as ThemeId], (u) => readFile(path.join(ROOT, 'public', u), 'utf8'));
const bubble = await loadFont('bubble', async (u) => { const b = await readFile(path.join(ROOT, 'public', u)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; });
const profile: ChildProfile = { id: 'c_pdfcheck', ageYears: Number(age) as ChildProfile['ageYears'], skills: {}, interests: [theme as ThemeId], daysPerWeek: 5, minutesPerDay: 20, faith: true, createdAt: '2026-10-16' };
const plan = placeChild(profile);
const pages = buildProgramWeek({ name: 'Maximiliana Christabel', profile, week: plan.weeks[0], content: templateContentFor(profile, plan.weeks[0]), paper: 'letter', credit: true, bubble, planLength: plan.weeks.length });
await writeFile(out, await pagesToPdf(pages, 'Program check'));
console.log(`${pages.length} pages -> ${out}`);
