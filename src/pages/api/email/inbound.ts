import type { APIRoute } from 'astro';
import { verifyWebhook, forwardReceived } from '../../../lib/server/inbound';

export const prerender = false;

// Resend webhook for `email.received`. Signature checked with RESEND_WEBHOOK_SECRET; anything else gets 401.
export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text().catch(() => '');
  if (raw.length > 256 * 1024 || !verifyWebhook(raw, request.headers)) return new Response('unauthorized', { status: 401 });
  let evt: any;
  try { evt = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }
  if (evt?.type !== 'email.received' || typeof evt?.data?.email_id !== 'string') return new Response('ignored', { status: 200 });
  try {
    const r = await forwardReceived(evt.data.email_id);
    console.log('inbound', r);
    return new Response(r, { status: 200 });
  } catch (e) {
    console.error('inbound forward failed', (e as Error).message?.slice(0, 120));
    return new Response('retry', { status: 500 });
  }
};
