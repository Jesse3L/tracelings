// New storybooks added after launch (the Storybook Club promises new stories every month). A monthly scheduled task
// appends here: each story uses scenes that already have art in an existing theme (src/lib/program/scenes.ts and
// public/program/scenes/<theme>/) or in a seasonal set (like christmas.ts). Same rules as every book: each page's
// words are true of its picture (`shows`), the cast keeps its names, {{name}} only talks, spots, points, claps or
// cheers, Pre-K pages 1 to 2 sentences and at most 14 words, Kindergarten 1 to 3 sentences and at most 30 words,
// no em dashes. Check with: npx tsx scripts/check-storybooks.mts
import type { ThemeId } from '../program/types';

export interface ExtraStory {
  theme: ThemeId;
  id: string;                 // unique within the theme, not an existing program path id
  title: string;
  level: 'pre-k' | 'kindergarten';
  added: string;              // YYYY-MM-DD, shows a "New" badge for 45 days
  cover?: string;             // scene id; default: a whole-cast happy scene
  pages: [scene: string, text: string][];
}

export const EXTRA_STORIES: ExtraStory[] = [];
