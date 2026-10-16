// Shared contract for the personalized program (see docs/program-plan.md).
// Part A (content + plan engine) and Part B (accounts, storage, AI) both build against these types.
// Nothing in here may ever hold a child's name: names stay in the browser.

import type { Level } from '../homeschool';

export type ThemeId =
  | 'dinosaurs' | 'trucks' | 'unicorns' | 'ocean' | 'space' | 'farm'
  | 'bugs' | 'castles' | 'trains' | 'sports' | 'pets' | 'jungle';

/** Skills the placement check and weekly check-ins track. */
export type SkillId =
  | 'name-writing'      // writes own name
  | 'letter-names'      // names most capital and lowercase letters
  | 'letter-sounds'     // knows most letter sounds
  | 'blending'          // blends sounds into short words (c-a-t)
  | 'word-families'     // reads short-vowel word families
  | 'sight-words'       // reads early Dolch words
  | 'count-10'          // counts objects to 10
  | 'count-20'          // counts objects to 20
  | 'numerals'          // recognizes and writes numerals
  | 'compare'           // more or less
  | 'add-5'             // adds within 5
  | 'add-10';           // adds within 10

export type SkillState = 'not-yet' | 'learning' | 'got-it';

/** Stored on the server for paying members, and in localStorage for everyone. No name, no birthday. */
export interface ChildProfile {
  id: string;                 // random id made in the browser, e.g. "c_8f2k1x"
  ageYears: 3 | 4 | 5 | 6 | 7;
  skills: Partial<Record<SkillId, SkillState>>;
  interests: ThemeId[];       // 1 to 3
  daysPerWeek: 3 | 4 | 5;
  minutesPerDay: 10 | 15 | 20 | 30;
  faith: boolean;
  createdAt: string;          // ISO date
}

/** One week of a child's personalized plan. Built by the rules engine from the existing PLANS weeks. */
export interface ProgramWeek {
  index: number;              // 1-based position in this child's plan
  level: Level;
  baseWeek: number;           // the week number in PLANS[level] it is built from
  theme: ThemeId;             // which interest this week leans on (rotates through interests)
  focus: SkillId[];           // skills taught or reviewed this week
  extraReview?: boolean;      // inserted because a check-in said "still working"
  /** Added in Part A: the week's math step. Math runs on its own track, so a child who already counts to 20
   *  works on bigger numbers even during an early letter week. Missing means "use the base week's math". */
  math?: { number?: number; addTo?: 5 | 10 };
}

export interface ChildPlan {
  childId: string;
  level: Level;
  weeks: ProgramWeek[];       // typically 36
  current: number;            // index of the current week
}

export interface CheckIn {
  childId: string;
  weekIndex: number;
  results: Partial<Record<SkillId, 'got-it' | 'still-working'>>;
  at: string;                 // ISO date
}

/** AI (paid) or template (free week 1) content for one child-week. Uses the literal placeholder {{name}} for the child's name. */
export interface WeekContent {
  source: 'ai' | 'template';
  story: { title: string; pages: string[] };          // 4 to 8 short pages for a little book
  /** op '+': answer = a + b. op '-': answer = a - b. op 'compare': "which is more?", answer = the larger of a and b.
   *  icon (added in Part A, optional): a theme icon id from themes.ts to picture the problem; matched from the text when missing. */
  wordProblems: { text: string; a: number; b: number; op: '+' | '-' | 'compare'; answer: number; icon?: string }[];
  tracingSentence: string;
  parentNote: { teaches: string; why: string; activities: string[] };
}
