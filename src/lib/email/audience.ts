// Who a sign-up is, from the only things we know: the email address, the tool slug it came from, and an optional role.
// Never anything about a child.

/** Welcome-series variant. Each has its own Resend automation (see email/setup.ts). */
export type Interest = 'letters' | 'coloring' | 'math' | 'homeschool' | 'program' | 'general';
export const INTERESTS: readonly Interest[] = ['letters', 'coloring', 'math', 'homeschool', 'program', 'general'];

export function interestFor(source: string): Interest {
  const s = (source || '').toLowerCase();
  if (/^program/.test(s)) return 'program';
  if (/^(homeschool|letter-of-the-week)/.test(s)) return 'homeschool';
  if (/coloring/.test(s)) return 'coloring';
  if (/(math|ten-frame|more-or-less|addition|subtraction|word-problem|number-tracing)/.test(s)) return 'math';
  if (/(name-tracing|letter-tracing|cursive|word-tracing|bubble-letters|alphabet|sight-word|word-famil|flash)/.test(s)) return 'letters';
  return 'general';
}

/** School-looking address: k12, .edu, Texas-style ISDs, school districts. */
export function schoolDomain(email: string): boolean {
  const d = (email.split('@')[1] ?? '').toLowerCase();
  if (!d) return false;
  return /(^|\.)k12\./.test(d) || /\.edu(\.[a-z]{2})?$/.test(d) || /\.k12\.[a-z]{2}\.us$/.test(d)
    || /(^|\.)[a-z0-9-]*isd\.(org|net|us|com|edu)$/.test(d) || /(^|\.)[a-z0-9-]*usd[0-9]*\.(org|net|us|com)$/.test(d)
    || /school|district|\.sd[0-9]+\./.test(d);
}

export function isTeacher(email: string, source: string, role?: string): boolean {
  if (role === 'classroom') return true;
  if (/^class-pack/.test(source)) return true;
  return schoolDomain(email);
}

export function isHomeschool(source: string, role?: string): boolean {
  return role === 'homeschool' || /^(homeschool|program)/.test(source);
}

/** Segment names, created by the admin `setup` action. Resend segments are plain lists, so code adds contacts. */
export const SEGMENTS = {
  everyone: 'everyone',
  homeschool: 'homeschool',
  teachers: 'teachers',
  members: 'members',
  /** Families who are not members yet: everyone minus teachers minus members. Launch emails go here. */
  prospects: 'prospects',
} as const;
export type SegmentKey = keyof typeof SEGMENTS;

export function segmentsFor(email: string, source: string, role?: string): SegmentKey[] {
  const out: SegmentKey[] = ['everyone'];
  const teacher = isTeacher(email, source, role);
  if (isHomeschool(source, role)) out.push('homeschool');
  if (teacher) out.push('teachers'); else out.push('prospects');
  return out;
}

/** Resend custom contact properties (Resend allows only string and number). */
export const PROPERTIES = [
  { key: 'source', type: 'string', fallback_value: 'unknown' },
  { key: 'signup_date', type: 'string', fallback_value: 'unknown' },
  { key: 'member', type: 'string', fallback_value: 'false' },
  { key: 'interest', type: 'string', fallback_value: 'general' },
  { key: 'audience', type: 'string', fallback_value: 'family' },
  /** Set by the welcome automation when it ends: 'done' or 'stopped-member'. */
  { key: 'welcome_status', type: 'string', fallback_value: 'none' },
] as const;

export const TOPIC_NAME = 'Tracelings emails';
export const TOPIC_DESCRIPTION = 'New printables, homeschool tips and news about Tracelings at Home.';

/** Event that starts the welcome automation for each variant (teachers have their own). */
export const welcomeEvent = (v: Interest | 'teacher') => `tracelings.welcome.${v}`;

export const today = () => new Date().toISOString().slice(0, 10);
