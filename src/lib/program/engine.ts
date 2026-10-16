// TEMP stand-in for Part A's engine.ts so Part B builds on its own branch. Delete when Part A lands.
import type { ChildProfile, ChildPlan, CheckIn, ProgramWeek, SkillId } from './types';
import { PLANS } from '../homeschool';

export function placeChild(profile: ChildProfile): ChildPlan {
  const level = profile.ageYears >= 5 && profile.skills['letter-names'] === 'got-it' ? 'kindergarten' : 'pre-k';
  const focus: SkillId[] = level === 'pre-k' ? ['letter-names', 'count-10'] : ['letter-sounds', 'sight-words', 'add-5'];
  const weeks: ProgramWeek[] = PLANS[level].weeks.map((w, i) => ({
    index: i + 1, level, baseWeek: w.n, theme: profile.interests[i % profile.interests.length], focus,
  }));
  return { childId: profile.id, level, weeks, current: 1 };
}

export function applyCheckIn(plan: ChildPlan, checkIn: CheckIn): ChildPlan {
  const shaky = Object.values(checkIn.results).some((v) => v === 'still-working');
  const weeks = plan.weeks.slice();
  const at = checkIn.weekIndex;
  if (shaky && at <= weeks.length && !weeks[at]?.extraReview) {
    weeks.splice(at, 0, { ...weeks[at - 1], extraReview: true });
  }
  return { ...plan, weeks: weeks.map((w, i) => ({ ...w, index: i + 1 })), current: Math.min(weeks.length, Math.max(plan.current, at + 1)) };
}
