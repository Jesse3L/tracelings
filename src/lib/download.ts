import type { Page } from './sheet';
import { pagesToPdf } from './render';
import { countDownload } from './gate';

export async function savePdf(pages: Page[], filename: string, title?: string) {
  const bytes = await pagesToPdf(pages, title);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  countDownload(pages.length);
}
