// Printable progress report for one child, built in the browser (the child's name never leaves the device).
import type { CheckIn, ChildPlan, ChildProfile, SkillId } from './types';
import { PAPER, COLORS, type Item, type Page, type Paper } from '../sheet';
import { PLANS, M, para, footer, box } from '../homeschool';

export const SKILL_LABELS: Record<SkillId, string> = {
  'name-writing': 'Writes their name',
  'letter-names': 'Names letters',
  'letter-sounds': 'Knows letter sounds',
  blending: 'Blends sounds into words',
  'word-families': 'Reads word families',
  'sight-words': 'Reads sight words',
  'count-10': 'Counts to 10',
  'count-20': 'Counts to 20',
  numerals: 'Reads and writes numbers',
  compare: 'More or less',
  'add-5': 'Adds within 5',
  'add-10': 'Adds within 10',
};
const ORDER = Object.keys(SKILL_LABELS) as SkillId[];

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/** Latest status per skill: the newest check-in wins, then the placement answers. */
export function skillStatus(profile: ChildProfile, checkIns: CheckIn[]): Partial<Record<SkillId, { state: 'got-it' | 'still-working' | 'learning' | 'not-yet'; at?: string }>> {
  const out: Partial<Record<SkillId, { state: 'got-it' | 'still-working' | 'learning' | 'not-yet'; at?: string }>> = {};
  for (const [k, v] of Object.entries(profile.skills) as [SkillId, 'not-yet' | 'learning' | 'got-it'][]) out[k] = { state: v };
  const mine = checkIns.filter((c) => c.childId === profile.id).sort((a, b) => a.at.localeCompare(b.at));
  for (const c of mine) for (const [k, v] of Object.entries(c.results) as [SkillId, 'got-it' | 'still-working'][]) out[k] = { state: v, at: c.at };
  return out;
}

export function buildProgressReport(o: { name: string; profile: ChildProfile; plan: ChildPlan; checkIns: CheckIn[]; paper: Paper; credit: boolean }): Page[] {
  const { w, h } = PAPER[o.paper];
  const items: Item[] = [];
  const INK = COLORS.ink;
  const who = o.name.trim() || 'Your child';
  const level = PLANS[o.plan.level].label;
  const done = Math.max(0, o.plan.current - 1);
  const mine = o.checkIns.filter((c) => c.childId === o.profile.id);
  const reviews = o.plan.weeks.filter((wk) => wk.extraReview).length;

  items.push({ kind: 'text', x: M, y: 58, size: 11, text: `Tracelings at Home, Personalized. Printed ${fmtDate(new Date().toISOString())}`, color: COLORS.quiet, align: 'left' });
  const title = `Progress report: ${who}`;
  // Rough Helvetica width (about 0.56 em per character) so a long name shrinks instead of running off the page.
  const titleSize = Math.max(14, Math.min(26, (w - 2 * M) / (title.length * 0.56)));
  items.push({ kind: 'text', x: M, y: 92, size: titleSize, text: title, color: INK, align: 'left' });
  let y = para(items, `${level} plan, week ${o.plan.current} of ${o.plan.weeks.length}. ${done} ${done === 1 ? 'week' : 'weeks'} finished, ${mine.length} weekly ${mine.length === 1 ? 'check-in' : 'check-ins'}${reviews ? `, ${reviews} extra review ${reviews === 1 ? 'week' : 'weeks'} added` : ''}.`, M, 120, 12, w - 2 * M, COLORS.quiet) + 14;

  items.push({ kind: 'text', x: M, y, size: 15, text: 'Skills', color: INK, align: 'left' });
  y += 10;
  const status = skillStatus(o.profile, o.checkIns);
  const label: Record<string, string> = { 'got-it': 'Got it', 'still-working': 'Still working', learning: 'Learning', 'not-yet': 'Not started' };
  const rowH = 24;
  for (const s of ORDER) {
    const st = status[s];
    if (!st) continue;
    y += rowH;
    items.push({ kind: 'line', x1: M, y1: y + 7, x2: w - M, y2: y + 7, color: '#e3e8f1', width: 0.75 });
    const filled = st.state === 'got-it';
    items.push({ kind: 'path', d: box(M, y - 11, 13, 13, 3), color: INK, width: 1.1, ...(filled ? { fill: '#9fd3b8' } : {}) });
    items.push({ kind: 'text', x: M + 22, y, size: 12, text: SKILL_LABELS[s], color: INK, align: 'left' });
    items.push({ kind: 'text', x: w - M - 120, y, size: 12, text: label[st.state], color: INK, align: 'left' });
    if (st.at) items.push({ kind: 'text', x: w - M, y, size: 10, text: fmtDate(st.at), color: COLORS.quiet, align: 'right' });
  }
  y += 34;

  items.push({ kind: 'text', x: M, y, size: 15, text: 'Weeks covered', color: INK, align: 'left' });
  y += 8;
  const weeks = o.plan.weeks.slice(0, Math.max(1, o.plan.current));
  const colW = (w - 2 * M) / 2;
  const maxRows = Math.max(1, Math.floor((h - M - 40 - y) / 16));
  const shown = weeks.slice(-maxRows * 2);
  shown.forEach((wk, i) => {
    const col = i < Math.ceil(shown.length / 2) ? 0 : 1;
    const row = col === 0 ? i : i - Math.ceil(shown.length / 2);
    const base = PLANS[wk.level].weeks[wk.baseWeek - 1];
    const text = `Week ${wk.index}: ${base?.title ?? ''}${wk.extraReview ? ' (review)' : ''}${wk.index === o.plan.current ? ' (now)' : ''}`;
    items.push({ kind: 'text', x: M + col * colW, y: y + 18 + row * 16, size: 10.5, text, color: INK, align: 'left' });
  });
  if (weeks.length > shown.length) items.push({ kind: 'text', x: M, y: h - M - 12, size: 9, text: `Earlier weeks not shown: 1 to ${weeks.length - shown.length}.`, color: COLORS.quiet, align: 'left' });

  footer(items, w, h, o.credit, 'Progress report');
  return [{ w, h, items }];
}
