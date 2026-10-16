// TEMP stand-in for Part A's templates.ts so Part B builds on its own branch. Delete when Part A lands.
import type { ChildProfile, ProgramWeek, WeekContent } from './types';
import { THEMES } from './themes';

export function templateContentFor(profile: ChildProfile, week: ProgramWeek): WeekContent {
  const t = THEMES[week.theme];
  const w = t.words;
  return {
    source: 'template',
    story: { title: `{{name}} and the ${w[0]}`, pages: [`{{name}} sees a ${w[0]}.`, `The ${w[0]} is big.`, `{{name}} can see a ${w[1]}.`, `It is fun to play.`, `{{name}} waves. Bye!`] },
    wordProblems: [
      { text: `{{name}} has 2 ${w[0]}s. Then 1 more comes. How many now?`, a: 2, b: 1, op: '+', answer: 3 },
      { text: `There are 3 ${w[1]}s and 2 more. How many in all?`, a: 3, b: 2, op: '+', answer: 5 },
      { text: `Which is more, 4 or 2?`, a: 4, b: 2, op: 'compare', answer: 4 },
      { text: `1 ${w[0]} and 3 more. How many?`, a: 1, b: 3, op: '+', answer: 4 },
    ],
    tracingSentence: `I like ${t.label.toLowerCase()}.`,
    parentNote: {
      teaches: `This week practices the week's letters and counting, with ${t.label.toLowerCase()} as the theme.`,
      why: 'Short, playful practice with a favorite topic keeps many kids interested.',
      activities: [`Count ${w[0]}s in a picture book together.`, `Make a ${w[0]} out of play dough.`],
    },
  };
}
