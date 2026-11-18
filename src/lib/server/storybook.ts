// Storybook receipts: a signed token naming the book and the Square order that paid for it. The buyer's browser keeps
// it (and the emailed link carries it) to download the book again. No name or child data is in it.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { rs, resendConfigured } from './resend';
import { SITE } from '../../config';

const env = (k: string): string | undefined => (import.meta.env as Record<string, string | undefined>)[k] ?? process.env[k];
const secret = () => {
  const s = env('SESSION_SECRET');
  if (!s || s.length < 32) throw new Error('SESSION_SECRET missing');
  return s;
};
const sig = (data: string) => createHmac('sha256', secret()).update('storybook:' + data).digest('base64url').slice(0, 32);

export function signBook(bookId: string, orderId: string): string {
  const data = Buffer.from(JSON.stringify({ b: bookId, o: orderId })).toString('base64url');
  return `${data}.${sig(data)}`;
}

export function readBook(token: unknown): { bookId: string; orderId: string } | null {
  if (typeof token !== 'string' || token.length > 400) return null;
  const [data, s] = token.split('.');
  if (!data || !s) return null;
  const good = Buffer.from(sig(data)), given = Buffer.from(s);
  if (good.length !== given.length || !timingSafeEqual(good, given)) return null;
  try {
    const v = JSON.parse(Buffer.from(data, 'base64url').toString());
    return typeof v?.b === 'string' && typeof v?.o === 'string' ? { bookId: v.b, orderId: v.o } : null;
  } catch { return null; }
}

/** Emails the buyer a link to download the book again. Best effort, never throws. */
export async function emailBookLink(email: string, title: string, token: string): Promise<boolean> {
  if (!resendConfigured()) return false;
  const url = `${SITE.url}/personalized-storybook/?t=${encodeURIComponent(token)}`;
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  try {
    await rs('/emails', {
      timeoutMs: 4000,
      idempotencyKey: `book-${token.slice(-24)}`,
      body: {
        from: 'Tracelings <hello@tracelings.com>', to: [email], reply_to: SITE.email,
        subject: `Your storybook: ${title}`,
        text: `Thank you for your order!\n\nYour printable storybook "${title}" is yours to print as many times as you like. If you need it again, open this link, type your child's name and download:\n${url}\n\nPrint it, color the pictures together, and read it again tomorrow.\n\nTracelings\n${SITE.domain}`,
        html: `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#34405a;max-width:520px"><p>Thank you for your order!</p><p>Your printable storybook <b>${esc(title)}</b> is yours to print as many times as you like. If you need it again, open the link below, type your child's name and download.</p><p><a href="${url}" style="display:inline-block;background:#f5c443;color:#1f2a44;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Download the storybook</a></p><p>Print it, color the pictures together, and read it again tomorrow.</p><p>Tracelings<br>${SITE.domain}</p></div>`,
      },
    });
    return true;
  } catch (e) {
    console.error('storybook email failed', (e as Error).message);
    return false;
  }
}
