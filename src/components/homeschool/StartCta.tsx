import { useMember } from '../../lib/member';
import type { Level } from '../../lib/homeschool';

/**
 * The main call to action on the homeschool guide pages. Visitors start with a free week: the placement check on
 * /program/, prefilled for the page's level (and the faith track on the Christian page). Members open their plan.
 * The server-rendered version is the visitor one, so search engines and no-JS visitors see the free week offer.
 */
export default function StartCta(props: { level?: Level; faith?: boolean; note?: string; id?: string }) {
  const member = useMember();
  const q = new URLSearchParams();
  if (props.level) q.set('level', props.level);
  if (props.faith) q.set('faith', '1');
  const href = `/program/${q.toString() ? `?${q}` : ''}#placement`;
  if (member.loaded && member.member) {
    return (
      <div class="flex flex-wrap items-center gap-3" id={props.id}>
        <a href="/account/" class="btn-pencil px-6 py-3.5 text-lg" data-cta="member">Open your plan</a>
        <span class="text-[15px] text-muted">Every week is ready for you, plus your child's personalized plan.</span>
      </div>
    );
  }
  return (
    <div id={props.id}>
      <div class="flex flex-wrap items-center gap-3">
        <a href={href} class="btn-pencil px-6 py-3.5 text-lg" data-cta="start">Start with a free week</a>
        <a href="/membership/" class="text-[15px] font-bold text-[#2f5fc4] underline underline-offset-2">See membership</a>
      </div>
      <p class="mt-3 text-[14px] text-muted">{props.note ?? 'A 5-minute placement check, then week 1 to print with your child\'s name. No card needed.'}</p>
    </div>
  );
}
