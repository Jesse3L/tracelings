// Renders storybooks to a contact sheet PNG and a PDF in /tmp/books for checking: npx tsx scripts/render-storybooks.mts christmas/star dinosaurs/lost-egg  (KID=Name to change the name)
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { pageToSvg, pagesToPdf, loadImages, imagesIn, setSvgImageHref } from '../src/lib/render';
import { BOOKS, bookBody } from '../src/lib/storybook/catalog';
import { giftBookPages } from '../src/lib/storybook/giftbook';
const ROOT = '/home/claude/tracelings/public';
const ids = process.argv.slice(2);
const dataUri = new Map<string, string>();
setSvgImageHref((s) => dataUri.get(s) ?? s);
console.log('books', BOOKS.length);
for (const id of ids) {
  const b = BOOKS.find((x) => x.id === id)!;
  const pages = giftBookPages(bookBody(b), { name: process.env.KID ?? 'Emma', from: 'Grandma' });
  for (const u of imagesIn(pages)) if (!dataUri.has(u)) dataUri.set(u, 'data:image/png;base64,' + (await readFile(ROOT + u)).toString('base64'));
  const pngs = await Promise.all(pages.map((p) => sharp(Buffer.from(pageToSvg(p)), { density: 40 }).flatten({ background: '#fff' }).png().toBuffer()));
  // contact sheet
  const W = 340, H = 440, cols = 4, rows = Math.ceil(pngs.length / cols);
  const comp = await Promise.all(pngs.map(async (b, i) => ({ input: await sharp(b).resize(W - 10, H - 10, { fit: 'contain', background: '#fff' }).extend({ top: 1, bottom: 1, left: 1, right: 1, background: '#999' }).toBuffer(), left: (i % cols) * W + 4, top: Math.floor(i / cols) * H + 4 })));
  await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: '#ddd' } }).composite(comp).png().toFile(`/tmp/books/${id.replace('/', '_')}.png`);
  await loadImages(imagesIn(pages), (u) => readFile(ROOT + u));
  await writeFile(`/tmp/books/${id.replace('/', '_')}.pdf`, await pagesToPdf(pages, b.title));
  console.log(id, pages.length);
}
