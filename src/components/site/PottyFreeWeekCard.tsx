import { useEffect, useState } from 'preact/hooks';
import FreeWeekCard from './FreeWeekCard';
import { THEMES, coverUrl } from '../../lib/program/themes';
import { STICKER_THEMES, stickerThemeWord, type StickerTheme } from '../../lib/schedule';
import type { ThemeId } from '../../lib/program/types';

/**
 * Card under the potty chart maker: the same sticker chart, in the child's theme, as the last page of a free week of
 * Pre-K homeschool. It follows the theme picked in the maker (ScheduleMaker sends a 'tl:sticker-theme' event), and the
 * link carries only that theme (?interest=dinosaurs) so the placement check ticks it first. Never the child's name.
 * The server-rendered version is the visitor one; members get a link to their plan instead.
 */
export default function PottyFreeWeekCard() {
  const [theme, setTheme] = useState<StickerTheme>('stars');

  useEffect(() => {
    const valid = (t: unknown): t is StickerTheme => STICKER_THEMES.some((x) => x.v === t);
    try {
      const now = (window as any).__tlStickerTheme ?? new URLSearchParams(location.search).get('theme');
      if (valid(now)) setTheme(now);
    } catch { /* ignore */ }
    const on = (e: Event) => { const t = (e as CustomEvent).detail; if (valid(t)) setTheme(t); };
    window.addEventListener('tl:sticker-theme', on);
    return () => window.removeEventListener('tl:sticker-theme', on);
  }, []);

  const picked = theme !== 'stars' ? (theme as ThemeId) : null;
  const img = coverUrl(picked ?? 'dinosaurs');
  const alt = picked ? `${THEMES[picked].label} picture from the Tracelings themes` : 'A dinosaur picture from the Tracelings themes';
  const word = stickerThemeWord(theme);
  const q = new URLSearchParams({ level: 'pre-k' });
  if (picked) q.set('interest', picked);
  const href = `/program/?${q}#placement`;

  return (
    <FreeWeekCard
      img={img}
      alt={alt}
      heading={word ? `Get the ${word} potty chart inside a free week of preschool at home` : 'Get this chart in your child\'s theme, inside a free week of preschool at home'}
      body={<>Answer a few questions about your child (about 5 minutes), then print week 1 of our <span class="whitespace-nowrap">Pre-K</span> plan with their name: the letter and number of the week, a story starring them and, with one tick, this sticker chart in their {word ? `${word} ` : ''}theme as the last page. No card needed.</>}
      href={href}
      cta="Build my free week"
      dataCta="potty-free-week"
      member={{
        heading: 'Your child\'s potty chart is in their plan',
        body: <>For a child on the <span class="whitespace-nowrap">Pre-K</span> track, your plan prints this chart in one tap, with their name and the pictures from their own theme.</>,
        dataCta: 'potty-member',
      }}
    />
  );
}
