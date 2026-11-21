// 30-day unlimited download pass ($4.99, one time, no subscription). A signed token holds the paying Square order and
// the expiry date; the buyer's browser keeps it, and the emailed link carries it to other devices. No child data.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { rs, resendConfigured } from './resend';
import { SITE } from '../../config';

export const PASS_CENTS = 499;
export const PASS_DAYS = 30;
export const PASS_LABEL = 'Tracelings 30-day unlimited downloads';

const env = (k: string): string | undefined => (import.meta.env as Record<string, string | undefined>)[k] ?? process.env[k];
const secret = () => {
  const s = env('SESSION_SECRET');
  if (!s || s.length < 32) throw new Error('SESSION_SECRET missing');
  return s;
};
const sig = (data: string) => createHmac('sha256', secret()).update('pass:' + data).digest('base64url').slice(0, 32);

/** Token body: {o: Square order id, e: expiry in epoch ms}. The browser can read `e` without the secret. */
export function signPass(orderId: string, expiresAt: number): string {
  const data = Buffer.from(JSON.stringify({ o: orderId, e: expiresAt })).toString('base64url');
  return `${data}.${sig(data)}`;
}

export function readPass(token: unknown): { orderId: string; expiresAt: number } | null {
  if (typeof token !== 'string' || token.length > 400) return null;
  const [data, s] = token.split('.');
  if (!data || !s) return null;
  const good = Buffer.from(sig(data)), given = Buffer.from(s);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  try {
    const v = JSON.parse(Buffer.from(data, 'base64url').toString());
    return typeof v?.o === 'string' && typeof v?.e === 'number' ? { orderId: v.o, expiresAt: v.e } : null;
  } catch { return null; }
}

const longDate = (ms: number) => new Date(ms).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'long', day: 'numeric', year: 'numeric' });

/** Emails the buyer a link that switches on the pass on any other phone or computer. Best effort, never throws. */
export async function emailPassLink(email: string, token: string, expiresAt: number): Promise<boolean> {
  if (!resendConfigured()) return false;
  const url = `${SITE.url}/unlock/?t=${encodeURIComponent(token)}`;
  const until = longDate(expiresAt);
  try {
    await rs('/emails', {
      timeoutMs: 4000,
      idempotencyKey: `pass-${token.slice(-24)}`,
      body: {
        from: 'Tracelings <hello@tracelings.com>', to: [email], reply_to: SITE.email,
        subject: 'Your unlimited downloads are on',
        text: `Thank you!\n\nYou have unlimited Tracelings downloads through ${until}. Print as many worksheets, tracing pages and coloring pages as you like.\n\nUsing another phone or computer? Open this link on it to switch on unlimited downloads there too:\n${url}\n\nThis was a one-time payment. Nothing renews.\n\nTracelings\n${SITE.domain}`,
        html: `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#34405a;max-width:520px"><p>Thank you!</p><p>You have <b>unlimited Tracelings downloads through ${until}</b>. Print as many worksheets, tracing pages and coloring pages as you like.</p><p>Using another phone or computer? Open this link on it to switch on unlimited downloads there too.</p><p><a href="${url}" style="display:inline-block;background:#f5c443;color:#1f2a44;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Switch on unlimited downloads</a></p><p>This was a one-time payment. Nothing renews.</p><p>Tracelings<br>${SITE.domain}</p></div>`,
      },
    });
    return true;
  } catch (e) {
    console.error('pass email failed', (e as Error).message);
    return false;
  }
}
