import { SITE } from '../config';

/** Picks the longest title variant that fits Google's ~60 character display limit. */
export function fitTitle(main: string, extras: string[] = ['(Free Printable PDF)', '(Free Printable)', 'Free']): string {
  const brand = ` | ${SITE.name}`;
  for (const e of extras) {
    const t = `${main} ${e}${brand}`;
    if (t.length <= 60) return t;
  }
  if ((main + brand).length <= 60) return main + brand;
  return main.length <= 60 ? main : main.slice(0, 57).replace(/\s+\S*$/, '') + '…';
}

/** Trims a description to 155 characters on a word boundary. */
export function fitDescription(d: string): string {
  return d.length <= 155 ? d : d.slice(0, 152).replace(/\s+\S*$/, '').replace(/[,.;:]$/, '') + '…';
}

export interface Faq { q: string; a: string; html?: string }

/** The answer exactly as the page shows it: the visible HTML with its tags removed, or the plain answer. */
export function faqText(f: Faq): string {
  if (!f.html) return f.a;
  return f.html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}
