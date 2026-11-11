import { useEffect, useState } from 'preact/hooks';
import { useMember } from '../../lib/member';
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
  const member = useMember();
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

  if (member.loaded && member.member) {
    return (
      <aside class="mt-6 flex max-w-3xl items-start gap-4 rounded-xl border border-hairline bg-white p-4 sm:items-center" aria-label="Your plan">
        <img src={img} alt="" width={72} height={72} loading="lazy" class="hidden size-14 shrink-0 min-[420px]:block sm:size-[72px]" />
        <div class="min-w-0 flex-1">
          <p class="font-bold text-ink leading-snug">Your child's potty chart is in their plan</p>
          <p class="mt-1 text-[15px] leading-snug text-muted">For a child on the <span class="whitespace-nowrap">Pre-K</span> track, your plan prints this chart in one tap, with their name and the pictures from their own theme.</p>
          <a href="/account/" class="btn-pencil mt-3 inline-block px-4 py-2.5 text-[15px]" data-cta="potty-member">Open your plan</a>
        </div>
      </aside>
    );
  }

  return (
    <aside class="mt-6 flex max-w-3xl items-start gap-4 rounded-xl border border-hairline bg-white p-4 sm:items-center sm:p-5" aria-label="Free week of preschool at home">
      <img src={img} alt={alt} width={88} height={88} loading="lazy" class="hidden size-16 shrink-0 min-[420px]:block sm:size-[88px]" />
      <div class="min-w-0 flex-1">
        <p class="font-bold text-ink leading-snug">
          {word ? `Get the ${word} potty chart inside a free week of preschool at home` : 'Get this chart in your child\'s theme, inside a free week of preschool at home'}
        </p>
        <p class="mt-1 text-[15px] leading-snug text-muted">
          Answer a few questions about your child (about 5 minutes), then print week 1 of our <span class="whitespace-nowrap">Pre-K</span> plan with their name: the letter and number of the week, a story starring them and, with one tick, this sticker chart in their {word ? `${word} ` : ''}theme as the last page. No card needed.
        </p>
        <a href={href} class="btn-pencil mt-3 inline-block px-4 py-2.5 text-[15px]" data-cta="potty-free-week">Build my free week</a>
      </div>
    </aside>
  );
}
