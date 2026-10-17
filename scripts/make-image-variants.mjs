// Smaller copies of images that pages show at a fraction of their full size.
//   public/previews/<name>.webp          -> public/previews/sm/<name>.webp (240px wide, for 90 to 120px thumbnails)
//   public/coloring/<c>/<page>.png       -> public/coloring/<c>/<page>-880.png (on-page picture, 4 grays; the full PNG stays for the PDF)
// Run after `npm run previews` or after adding coloring pages: node scripts/make-image-variants.mjs
import { readdir, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const newer = async (src, out) => {
  try { return (await stat(out)).mtimeMs >= (await stat(src)).mtimeMs; } catch { return false; }
};

let made = 0;
const prev = path.join(ROOT, 'public/previews');
await mkdir(path.join(prev, 'sm'), { recursive: true });
for (const f of await readdir(prev)) {
  if (!f.endsWith('.webp')) continue;
  const src = path.join(prev, f), out = path.join(prev, 'sm', f);
  if (await newer(src, out)) continue;
  await sharp(src).resize({ width: 240 }).webp({ quality: 78, effort: 6 }).toFile(out);
  made++;
}

const col = path.join(ROOT, 'public/coloring');
for (const c of await readdir(col)) {
  const dir = path.join(col, c);
  if (!(await stat(dir)).isDirectory()) continue;
  for (const f of await readdir(dir)) {
    if (!f.endsWith('.png') || f.endsWith('-880.png')) continue;
    const src = path.join(dir, f), out = path.join(dir, f.replace(/\.png$/, '-880.png'));
    if (await newer(src, out)) continue;
    // A few grays keep the black lines smooth when the 1-bit PNG is shrunk, and stay smaller than WebP for line art.
    await sharp(src).greyscale().resize({ width: 880 }).png({ palette: true, colors: 4, compressionLevel: 9 }).toFile(out);
    made++;
  }
}
console.log(`made ${made} image variants`);
