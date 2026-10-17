// QA probe: the same check-in sent twice (double click) on week 1. Run: npx tsx scripts/qa/probe-dblcheckin.mts
import { placeChild, applyCheckIn, weekTitle } from '../../src/lib/program/engine';
const p = { id: 'c_probe1', ageYears: 5, skills: { 'letter-names': 'got-it' }, interests: ['dinosaurs', 'space'], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16' } as any;
let plan = placeChild(p);
const wk = plan.weeks[0];
const ci = { childId: p.id, weekIndex: 1, results: Object.fromEntries(wk.focus.map((s) => [s, 'still-working'])), at: '' } as any;
const show = (x: typeof plan) => `current ${x.current} len ${x.weeks.length}: ${x.weeks.slice(0, 4).map((w) => weekTitle(w) + (w.extraReview ? '*' : '')).join(' | ')}`;
console.log('focus', wk.focus.join(','));
plan = applyCheckIn(plan, ci); console.log('1st', show(plan));
plan = applyCheckIn(plan, ci); console.log('2nd', show(plan));
