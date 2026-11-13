import FreeWeekCard from './FreeWeekCard';
import { THEMES, coverUrl } from '../../lib/program/themes';
import type { ThemeId } from '../../lib/program/types';

/** The coloring collections that match one of the program's 12 interest themes. */
export const COLORING_THEMES: Record<string, { theme: ThemeId; word: string; things: string }> = {
  'dinosaur-coloring-pages': { theme: 'dinosaurs', word: 'dinosaur', things: 'dinosaurs' },
  'unicorn-coloring-pages': { theme: 'unicorns', word: 'unicorn', things: 'unicorns' },
  'car-and-truck-coloring-pages': { theme: 'trucks', word: 'truck', things: 'trucks and cars' },
};

/**
 * Card under the coloring pages that match a program theme: a free week of homeschool themed on the same thing.
 * The link carries only the theme (?interest=dinosaurs), so the placement check ticks it first. No level is set:
 * coloring families range from preschool to kindergarten, and the placement check asks the age.
 * The coloring pages themselves stay exactly as free as they are.
 */
export default function ThemeFreeWeekCard({ collection }: { collection: string }) {
  const t = COLORING_THEMES[collection];
  if (!t) return null;
  const href = `/program/?${new URLSearchParams({ interest: t.theme })}#placement`;
  return (
    <FreeWeekCard
      img={coverUrl(t.theme)}
      alt={`${THEMES[t.theme].label} picture from the Tracelings themes`}
      label="Free week of homeschool"
      heading={`Get a free week of homeschool themed on ${t.things}`}
      body={<>Answer a few questions about your child (about 5 minutes), then print week 1 of our <span class="whitespace-nowrap">Pre-K</span> or kindergarten plan with their name: the letter of the week, counting and ten frame pages drawn with {t.things}, and a story starring your child. No card needed.</>}
      href={href}
      cta={`Build my free ${t.word} week`}
      dataCta={`coloring-free-week-${t.theme}`}
      member={{
        heading: `Make ${t.things} one of your child's themes`,
        body: <>Members can add {t.things} to a child's interests on the plan page (Edit answers or interests). Up to 3 themes take turns, week by week.</>,
        dataCta: `coloring-member-${t.theme}`,
      }}
    />
  );
}
