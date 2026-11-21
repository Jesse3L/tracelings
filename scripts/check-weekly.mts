// Checks a weekly email content file: npx tsx scripts/check-weekly.mts src/data/weekly/2026-11-29.json
// Runs weeklyProblems(), checks every linked path is a built page (run npm run build first) and the picture exists,
// and writes a preview to /tmp/weekly-<date>.html. Exit 1 on any problem.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { weeklyEmail, weeklyProblems } from '../src/lib/email/templates';
const file = process.argv[2];
const c = JSON.parse(readFileSync(file, 'utf8'));
const bad = weeklyProblems(c);
if (!file.endsWith(`${c.date}.json`)) bad.push('file name must be the date');
const page = (p: string) => existsSync(`dist/client${p.endsWith('/') ? p : p + '/'}index.html`) || existsSync(`.vercel/output/static${p.endsWith('/') ? p : p + '/'}index.html`);
for (const f of c.free ?? []) if (!page(f.path)) bad.push(`not a built page: ${f.path}`);
const links = [...JSON.stringify(c).matchAll(/\]\((\/[^)]*)\)/g)].map((m) => m[1]);
for (const l of links) if (!page(l)) bad.push(`not a built page: ${l}`);
if (c.picture && !existsSync('public' + c.picture.src)) bad.push(`missing picture ${c.picture.src}`);
if (!bad.length) writeFileSync(`/tmp/weekly-${c.date}.html`, weeklyEmail(c).html);
console.log(bad.length ? bad.map((b) => ' - ' + b).join('\n') : `ok, preview at /tmp/weekly-${c.date}.html`);
process.exit(bad.length ? 1 : 0);
