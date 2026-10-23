// Forwards mail sent to any @tracelings.com address (hello@ and replies to our emails) to the owner's inbox.
// Resend receives the mail (receiving enabled on the domain), calls our webhook with `email.received`, and we fetch
// the message and send it on. The forward comes from hello@tracelings.com with Reply-To set to the original sender,
// so replying in the owner's inbox answers the parent directly. Nothing about the message is logged.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { rs } from './resend';

const env = (k: string): string | undefined => ((import.meta as any).env as Record<string, string | undefined> | undefined)?.[k] ?? process.env[k];
const FORWARD_FROM = 'Tracelings inbox <hello@tracelings.com>';
const MAX_ATTACH_BYTES = 15 * 1024 * 1024;

/** Svix-style signature check used by Resend webhooks. Returns false on any problem. */
export function verifyWebhook(raw: string, headers: Headers, now = Date.now()): boolean {
  const secret = env('RESEND_WEBHOOK_SECRET');
  const id = headers.get('svix-id');
  const ts = headers.get('svix-timestamp');
  const sigs = headers.get('svix-signature');
  if (!secret || !id || !ts || !sigs) return false;
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > 5 * 60) return false;
  let key: Buffer;
  try { key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64'); } catch { return false; }
  const expected = createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest();
  for (const part of sigs.split(' ')) {
    const [v, sig] = part.split(',');
    if (v !== 'v1' || !sig) continue;
    let got: Buffer;
    try { got = Buffer.from(sig, 'base64'); } catch { continue; }
    if (got.length === expected.length && timingSafeEqual(got, expected)) return true;
  }
  return false;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** "Jane Doe <jane@x.com>" or "jane@x.com" -> "jane@x.com" */
const addressOf = (s: string) => (s.match(/<([^>]+)>/)?.[1] ?? s).trim();

export async function forwardReceived(emailId: string): Promise<'forwarded' | 'skipped'> {
  const owner = env('OWNER_EMAIL');
  if (!owner) return 'skipped';
  const e = await rs<any>(`/emails/receiving/${encodeURIComponent(emailId)}`);
  const sender = typeof e.from === 'string' ? e.from : '';
  // Never forward our own mail back to us (loops), or mail that failed both SPF and DKIM.
  if (/@tracelings\.com>?$/i.test(addressOf(sender))) return 'skipped';
  const auth = e.authentication;
  if (auth && auth.spf === 'fail' && auth.dkim === 'fail') return 'skipped';

  let attachments: { filename: string; content: string; content_type?: string }[] = [];
  try {
    const list = await rs<any>(`/emails/receiving/${encodeURIComponent(emailId)}/attachments`);
    let total = 0;
    for (const a of list?.data ?? []) {
      if (!a?.download_url || total + (a.size ?? 0) > MAX_ATTACH_BYTES) continue;
      const res = await fetch(a.download_url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      total += buf.length;
      attachments.push({ filename: String(a.filename ?? 'attachment'), content: buf.toString('base64'), ...(a.content_type ? { content_type: a.content_type } : {}) });
    }
  } catch { attachments = []; }

  const to = Array.isArray(e.to) ? e.to.join(', ') : '';
  const banner = `<div style="font:13px/1.5 system-ui,sans-serif;color:#555;border-bottom:1px solid #ddd;padding:8px 0 10px;margin-bottom:12px">Forwarded from <b>${esc(to || 'hello@tracelings.com')}</b>. From: ${esc(sender)}. Hit reply to answer them directly.</div>`;
  const textBanner = `Forwarded from ${to || 'hello@tracelings.com'}. From: ${sender}. Hit reply to answer them directly.\n\n`;
  await rs('/emails', {
    body: {
      from: FORWARD_FROM,
      to: [owner],
      reply_to: sender ? [addressOf(sender)] : undefined,
      subject: `Fwd: ${String(e.subject ?? '(no subject)').slice(0, 200)}`,
      html: banner + (typeof e.html === 'string' && e.html ? e.html : `<pre style="white-space:pre-wrap">${esc(String(e.text ?? ''))}</pre>`),
      text: textBanner + String(e.text ?? ''),
      ...(attachments.length ? { attachments } : {}),
    },
    idempotencyKey: `fwd-${emailId}`,
    timeoutMs: 15000,
  });
  return 'forwarded';
}

/** Creates the `email.received` webhook (idempotent by endpoint). Returns the signing secret only when newly created. */
export async function ensureInboundWebhook(endpoint: string): Promise<{ id: string; status: 'exists' | 'created'; signing_secret?: string }> {
  const list = await rs<any>('/webhooks');
  const hit = (list?.data ?? []).find((w: any) => w.endpoint === endpoint);
  if (hit) return { id: hit.id, status: 'exists' };
  const r = await rs<any>('/webhooks', { body: { endpoint, events: ['email.received'] } });
  return { id: r.id, status: 'created', signing_secret: r.signing_secret };
}
