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
export function countDownload() {
  write(COUNT_KEY, String(Number(read(COUNT_KEY) || '0') + 1));
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
