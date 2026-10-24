// Who can print which week of the 36-week homeschool plans (Pre-K, kindergarten, the faith track and the
// letter of the week packs). Decided by Jesse on Oct 24, 2026:
//  - week 1 is free for everyone (email gate as before);
//  - weeks 2 to 36 are part of the membership (Tracelings at Home, Personalized);
//  - devices that were already using the free plans keep printing every week free until the end of
//    Nov 30, 2026 (America/Chicago), with a banner.
//
// This check runs in the browser and the plan data ships in the bundle, so it is a soft lock: enough for
// honest families, not for someone reading the source. See docs/program-plan.md for the server-side path.

export const FREE_WEEKS = 1;

/** End of Nov 30, 2026 in Chicago. Daylight saving time ends Nov 1, so Chicago is UTC-6 then. */
export const GRACE_ENDS_AT = Date.parse('2026-12-01T06:00:00Z');
export const GRACE_LABEL = 'November 30';

/** Set once per device, the first time the new rules run there: 'yes' when the device had used the free plans. */
const GRACE_KEY = 'tl-hs-grace';
/** Written on every pack download from now on (first and last time). It never grants the grace period by itself,
 *  because it is written by the same build that locks the weeks: a marker present when GRACE_KEY is first decided
 *  can only come from an earlier build. */
const USED_KEY = 'tl-hs-used';
/** Only the free weekly pack maker ever wrote these two keys (the faith track and the Pre-K extra math checkboxes,
 *  added Oct 13 and Oct 17, 2026), so a device that has either one used the pack maker before the lock. */
const LEGACY_KEYS = ['tl-faith-track', 'tl-prek-extra-math'];

function get(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function set(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* storage unavailable */ }
}

/**
 * Whether this device was using the free plans before the lock. Decided the first time it is asked and then
 * remembered, so ticking the faith box after today does not grant it. Call it before the pack maker writes anything.
 */
export function graceEligible(): boolean {
  const saved = get(GRACE_KEY);
  if (saved === 'yes') return true;
  if (saved === 'no') return false;
  const used = LEGACY_KEYS.some((k) => get(k) !== null) || get(USED_KEY) !== null;
  set(GRACE_KEY, used ? 'yes' : 'no');
  return used;
}

/** The grace period is on for this device right now. */
export function graceActive(now = Date.now()): boolean {
  return now < GRACE_ENDS_AT && graceEligible();
}

/** Can this visitor print week n of a plan? */
export function canPrintWeek(n: number, member: boolean, now = Date.now()): boolean {
  return member || n <= FREE_WEEKS || graceActive(now);
}

/** Notes a weekly pack download on this device (no names, no week, just when). */
export function markPackUsed() {
  const now = new Date().toISOString();
  let first = now;
  try { first = JSON.parse(get(USED_KEY) ?? '{}').first ?? now; } catch { /* old or broken value */ }
  set(USED_KEY, JSON.stringify({ first, last: now }));
}
