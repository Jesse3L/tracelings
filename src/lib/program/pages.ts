// TEMP stand-in for Part A's pages.ts so Part B builds on its own branch. Delete when Part A lands.
import type { ChildProfile, ProgramWeek, WeekContent } from './types';
import type { Page, Paper, Item } from '../sheet';
import { PAPER, COLORS } from '../sheet';
import { PLANS, buildWeekPack, para, footer, M } from '../homeschool';

export function buildProgramWeek(o: { name: string; profile: ChildProfile; week: ProgramWeek; content: WeekContent; paper: Paper; credit: boolean }): Page[] {
  const sub = (s: string) => s.replace(/\{\{name\}\}/g, o.name || 'your child');
  const base = PLANS[o.week.level].weeks[o.week.baseWeek - 1];
  const pages = buildWeekPack({ level: o.week.level, week: base, name: o.name, paper: o.paper, credit: o.credit, bubble: null, faith: o.profile.faith });
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  items.push({ kind: 'text', x: M, y: 80, size: 24, text: sub(o.content.story.title), color: COLORS.ink, align: 'left' });
  let y = 120;
  for (const p of o.content.story.pages) y = para(items, sub(p), M, y, 16, w - 2 * M) + 10;
  y += 20;
  for (const p of o.content.wordProblems) y = para(items, sub(p.text), M, y, 13, w - 2 * M) + 6;
  footer(items, w, h, o.credit, `Week ${o.week.index}`);
  return [...pages, { w, h, items }];
}
