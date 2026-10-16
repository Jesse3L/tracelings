// Render check for the program progress report (US Letter and A4, long name). Run: npx -y tsx scripts/render-report.mts <outDir>
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { pageToSvg } from '../src/lib/render';
import { buildProgressReport } from '../src/lib/program/report';
import type { ChildPlan, ChildProfile, CheckIn } from '../src/lib/program/types';
import { PLANS } from '../src/lib/homeschool';

const out = process.argv[2] ?? 'render-check';
await mkdir(out, { recursive: true });
const profile: ChildProfile = { id: 'c_render1', ageYears: 5, skills: { 'letter-names': 'got-it', 'letter-sounds': 'learning', 'count-10': 'got-it', 'add-5': 'not-yet', 'sight-words': 'learning' }, interests: ['dinosaurs'], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-09-01T00:00:00Z' };
const weeks = PLANS.kindergarten.weeks.map((w, i) => ({ index: i + 1, level: 'kindergarten' as const, baseWeek: w.n, theme: 'dinosaurs' as const, focus: [], ...(i === 5 ? { extraReview: true } : {}) }));
const checkIns: CheckIn[] = [
  { childId: profile.id, weekIndex: 3, results: { 'letter-sounds': 'still-working' }, at: '2026-09-20T00:00:00Z' },
  { childId: profile.id, weekIndex: 30, results: { 'letter-sounds': 'got-it', 'add-5': 'got-it' }, at: '2026-10-10T00:00:00Z' },
];
for (const current of [4, 34]) for (const paper of ['letter', 'a4'] as const) {
  const plan: ChildPlan = { childId: profile.id, level: 'kindergarten', weeks, current };
  const [page] = buildProgressReport({ name: 'Maximiliano Alexander', profile, plan, checkIns, paper, credit: true });
  for (const it of page.items) {
    if (it.kind === 'text' && (it.y > page.h - 20 || it.y < 20 || (it.align === 'left' && it.x < 20))) console.log('OUT OF BOUNDS', paper, current, it.text);
  }
  const file = path.join(out, `report-${paper}-w${current}.png`);
  await writeFile(file, await sharp(Buffer.from(pageToSvg(page))).png().toBuffer());
  console.log(file);
}
