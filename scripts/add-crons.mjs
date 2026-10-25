// After `astro build`: copy the crons from vercel.json into .vercel/output/config.json, the Build Output file
// Vercel reads for prebuilt framework output, so the daily digest schedule is always registered.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const out = '.vercel/output/config.json';
if (!existsSync(out)) { console.log('add-crons: no', out); process.exit(0); }
const crons = JSON.parse(readFileSync('vercel.json', 'utf8')).crons ?? [];
const cfg = JSON.parse(readFileSync(out, 'utf8'));
const have = cfg.crons ?? [];
for (const c of crons) if (!have.some((h) => h.path === c.path && h.schedule === c.schedule)) have.push(c);
cfg.crons = have;
writeFileSync(out, JSON.stringify(cfg, null, 2));
console.log('add-crons:', have.map((c) => `${c.path} ${c.schedule}`).join(', '));
