// Free downloads: the first one needs nothing; after that we ask for an email once per device.
const COUNT_KEY = 'tl-downloads';
const OK_KEY = 'tl-email-ok';

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* storage unavailable */ }
}

export const FREE_DOWNLOADS = 1;

export function needsEmail(): boolean {
  if (read(OK_KEY)) return false;
  return Number(read(COUNT_KEY) || '0') >= FREE_DOWNLOADS;
}
/** Counts a download for the email prompt, and sends an anonymous "someone downloaded" ping.
 *  Only the page path and page count go out, never the filename or anything typed (names stay on this device). */
export function countDownload(pages?: number) {
  write(COUNT_KEY, String(Number(read(COUNT_KEY) || '0') + 1));
  try {
    const member = (window as any).__tlMember === true;
    const payload = JSON.stringify({ type: 'download', path: location.pathname, pages, member });
    if (!navigator.sendBeacon?.('/api/event/', new Blob([payload], { type: 'application/json' }))) {
      fetch('/api/event/', { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    }
    window.dispatchEvent(new Event('tl-downloaded'));
    (window as any).gtag?.('event', 'pdf_download', { tool_page: location.pathname, page_count: pages ?? 1, member });
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
    });
    if (res.status === 400) return 'invalid';
    return res.ok ? 'ok' : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
