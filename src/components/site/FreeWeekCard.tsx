import type { ComponentChildren } from 'preact';
import { useMember } from '../../lib/member';

export type FreeWeekCardProps = {
  /** Theme picture beside the text (hidden on the narrowest phones). */
  img: string;
  alt: string;
  heading: string;
  body: ComponentChildren;
  href: string;
  cta: string;
  dataCta: string;
  label?: string;
  /** What a signed-in member sees instead: a link to their plan. */
  member: { heading: string; body: ComponentChildren; href?: string; cta?: string; dataCta: string };
};

/**
 * Shared "free week" card that sits under a free tool (the potty chart maker, the theme coloring pages) and points
 * visitors at week 1 of the personalized program. Links carry a theme at most (?interest=dinosaurs), never a name.
 * The server-rendered version is the visitor one; members get a link to their plan instead.
 */
export default function FreeWeekCard(p: FreeWeekCardProps) {
  const member = useMember();

  if (member.loaded && member.member) {
    return (
      <aside class="mt-6 flex max-w-3xl items-start gap-4 rounded-xl border border-hairline bg-white p-4 sm:items-center" aria-label="Your plan">
        <img src={p.img} alt="" width={72} height={72} loading="lazy" class="hidden size-14 shrink-0 min-[420px]:block sm:size-[72px]" />
        <div class="min-w-0 flex-1">
          <p class="font-bold text-ink leading-snug">{p.member.heading}</p>
          <p class="mt-1 text-[15px] leading-snug text-muted">{p.member.body}</p>
          <a href={p.member.href ?? '/account/'} class="btn-pencil mt-3 inline-block px-4 py-2.5 text-[15px]" data-cta={p.member.dataCta}>{p.member.cta ?? 'Open your plan'}</a>
        </div>
      </aside>
    );
  }

  return (
    <aside class="mt-6 flex max-w-3xl items-start gap-4 rounded-xl border border-hairline bg-white p-4 sm:items-center sm:p-5" aria-label={p.label ?? 'Free week of preschool at home'}>
      <img src={p.img} alt={p.alt} width={88} height={88} loading="lazy" class="hidden size-16 shrink-0 min-[420px]:block sm:size-[88px]" />
      <div class="min-w-0 flex-1">
        <p class="font-bold text-ink leading-snug">{p.heading}</p>
        <p class="mt-1 text-[15px] leading-snug text-muted">{p.body}</p>
        <a href={p.href} class="btn-pencil mt-3 inline-block px-4 py-2.5 text-[15px]" data-cta={p.dataCta}>{p.cta}</a>
      </div>
    </aside>
  );
}
