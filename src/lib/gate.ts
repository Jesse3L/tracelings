import { track } from '@vercel/analytics';
import { cleanWhat } from './what';

// Free downloads need an email once per device, before the first download. Members never see the prompt.
const COUNT_KEY = 'tl-downloads';
const OK_KEY = 'tl-email-ok';
const VID_KEY = 'tl-vid';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* storage unavailable */ }
}

export const FREE_DOWNLOADS = 0;

// Bot filter for download alerts: a real person taps, clicks or types before downloading.
// Scripted clicks don't produce trusted input events, so pings without one are marked as non-human.
let humanAt = 0;
const loadedAt = typeof performance !== 'undefined' ? performance.now() : 0;
if (typeof window !== 'undefined') {
  const mark = (e: Event) => { if (e.isTrusted) humanAt = Date.now(); };
  for (const t of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(t, mark, { capture: true, passive: true });
}

export function needsEmail(): boolean {
  if (read(OK_KEY)) return false;
  return Number(read(COUNT_KEY) || '0') >= FREE_DOWNLOADS;
}
/** A random code for this device (16 base32 characters), made once, so the owner's daily digest can group one
 *  visitor's downloads. It is not linked to an email address or anything typed. '' when storage is unavailable. */
export function deviceId(): string {
  const have = read(VID_KEY);
  if (have && /^[a-z2-7]{16}$/.test(have)) return have;
  try {
    const abc = 'abcdefghijklmnopqrstuvwxyz234567';
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const id = Array.from(bytes, (b) => abc[b & 31]).join('');
    write(VID_KEY, id);
    return read(VID_KEY) === id ? id : '';
  } catch { return ''; }
}

/** Counts a download for the email prompt, and sends an anonymous "someone downloaded" ping.
 *  Only the page path, page count, a short label of the options picked (`what`, built from our own menus, see
 *  lib/what.ts) and the random device code go out. Never the filename or anything typed (names stay on this device). */
export function countDownload(pages?: number, what?: string) {
  write(COUNT_KEY, String(Number(read(COUNT_KEY) || '0') + 1));
  try {
    const member = (window as any).__tlMember === true;
    const human = humanAt > 0 && !(navigator as any).webdriver;
    const secs = Math.round((performance.now() - loadedAt) / 1000);
    const label = cleanWhat(what) ?? undefined;
    const vid = deviceId() || undefined;
    const payload = JSON.stringify({ type: 'download', path: location.pathname, pages, member, human, secs, what: label, vid });
    if (!navigator.sendBeacon?.('/api/event/', new Blob([payload], { type: 'application/json' }))) {
      fetch('/api/event/', { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    }
    window.dispatchEvent(new Event('tl-downloaded'));
    (window as any).gtag?.('event', 'pdf_download', { tool_page: location.pathname, page_count: pages ?? 1, member });
    // Vercel Web Analytics custom event (recorded on paid Vercel plans; ignored on Hobby).
    track('pdf_download', { page: location.pathname, pages: pages ?? 1, member });
  } catch { /* never block a download */ }
}
export function markEmailOk() {
  write(OK_KEY, '1');
}

export type SubscribeResult = 'ok' | 'invalid' | 'unavailable';

/** Sends only the email address and where it came from. Never the child's name. */
export async function subscribe(email: string, source: string, role?: string): Promise<SubscribeResult> {
  const clean = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) return 'invalid';
  try {
    const res = await fetch('/api/subscribe/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: clean, source, role }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 400) return 'invalid';
    return res.ok ? 'ok' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
