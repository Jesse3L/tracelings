import type { Page } from './sheet';
import { pagesToPdf, loadImages, imagesIn } from './render';
import { countDownload } from './gate';

/** `what`: the anonymous label for the download ping (lib/what.ts). Never put anything typed in it. */
export async function savePdf(pages: Page[], filename: string, title?: string, what?: string) {
  // Story scene pictures are fetched here so the PDF can embed them (cached after the first time).
  await loadImages(imagesIn(pages));
  const bytes = await pagesToPdf(pages, title);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  countDownload(pages.length, what);
}
