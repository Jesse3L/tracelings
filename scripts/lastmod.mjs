// Sitemap lastmod from git: each URL gets the date of the last commit that touched its page file or a data file
// that page imports from src/data/. Pages we can't date reliably get no lastmod (better than a fake one).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

function gitDates(root) {
  const dates = new Map();
  try {
    const run = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    const out = run(['log', '--format=@%cI %H', '--name-only', '--no-renames', '--', 'src']);
    // In a shallow clone the oldest commit we can see claims every file it contains, so its dates mean nothing.
    const shallow = run(['rev-parse', '--is-shallow-repository']).trim() === 'true';
    const boundary = shallow ? new Set(run(['rev-parse', '--shallow']).split('\n').filter(Boolean).map((l) => l.trim())) : new Set();
    let date = null, skip = false;
    for (const line of out.split('\n')) {
      if (line.startsWith('@')) { const [d, h] = line.slice(1).split(' '); date = d; skip = boundary.has(h); continue; }
      if (!line || skip || !date) continue;
      if (!dates.has(line)) dates.set(line, date); // log is newest first
    }
  } catch { /* no git (or not a repo): no dates */ }
  return dates;
}

/** The page source file for a URL path such as /letter-tracing/a/ (handles [param] routes). */
function pageFile(pagesDir, urlPath) {
  const segs = urlPath.split('/').filter(Boolean);
  const walk = (dir, i) => {
    if (i === segs.length) {
      for (const f of ['index.astro', 'index.md']) if (existsSync(path.join(dir, f))) return path.join(dir, f);
      return null;
    }
    const entries = readdirSync(dir);
    const seg = segs[i];
    // An exact match first, then a [param] match.
    if (i === segs.length - 1) for (const e of entries) if (e === `${seg}.astro`) return path.join(dir, e);
    if (entries.includes(seg) && statSync(path.join(dir, seg)).isDirectory()) { const r = walk(path.join(dir, seg), i + 1); if (r) return r; }
    for (const e of entries) {
      if (!/^\[.+\]$/.test(e) || !statSync(path.join(dir, e)).isDirectory()) continue;
      const r = walk(path.join(dir, e), i + 1); if (r) return r;
    }
    if (i === segs.length - 1) for (const e of entries) if (/^\[.+\]\.astro$/.test(e)) return path.join(dir, e);
    return null;
  };
  return walk(pagesDir, 0);
}

export function makeLastmod(root) {
  const dates = gitDates(root);
  const pagesDir = path.join(root, 'src/pages');
  const rel = (f) => path.relative(root, f).split(path.sep).join('/');
  return (urlPath) => {
    const file = pageFile(pagesDir, urlPath);
    if (!file) return undefined;
    // The page file, plus every JSON file in src/data it reads, directly or through a module in src/lib.
    const files = [rel(file)];
    const seen = new Set([file]);
    const scan = (f) => {
      for (const m of readFileSync(f, 'utf8').matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
        let dep = path.resolve(path.dirname(f), m[1]);
        if (!path.extname(dep) && existsSync(dep + '.ts')) dep += '.ts';
        if (seen.has(dep) || !existsSync(dep)) continue;
        seen.add(dep);
        const r = rel(dep);
        if (r.startsWith('src/data/') && r.endsWith('.json')) files.push(r);
        else if (r.startsWith('src/lib/') && r.endsWith('.ts')) scan(dep);
      }
    };
    scan(file);
    const known = files.map((f) => dates.get(f)).filter(Boolean).sort();
    // Every source file must be dated, or the newest change could be one we can't see.
    return known.length === files.length ? new Date(known.at(-1)).toISOString() : undefined;
  };
}
