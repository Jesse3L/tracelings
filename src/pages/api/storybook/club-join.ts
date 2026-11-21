import type { APIRoute } from 'astro';
import { payConfig, startClubInPlace, cardMessage, CLUB } from '../../../lib/server/square';
import { json, cleanEmail, setPending, sameOrigin } from '../../../lib/server/session';
import { notify, placeFrom } from '../../../lib/server/notify';
import { recordEvent } from '../../../lib/server/events';
import { addSignup } from '../../../lib/server/email';

export const prerender = false;

// POST /api/storybook/club-join/ {email, sourceId, verificationToken?}: Storybook Club sign-up ($9.99/month) from the
// in-page card form. First month charged now, Square bills monthly after. Sets the same pending cookie as a program
// sign-up, so /api/member/signin/ signs the new member straight in.
export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url)) return json(403, { error: 'bad_origin' });
  if (!(await payConfig().catch(() => null))) return json(503, { error: 'not_configured' });
  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body?.email);
  if (!email) return json(400, { error: 'invalid_email', message: 'Check the email address; it is how you sign in.' });
  const sourceId = typeof body?.sourceId === 'string' && /^[A-Za-z0-9:_\-]{8,256}$/.test(body.sourceId) ? body.sourceId : '';
  if (!sourceId) return json(400, { error: 'invalid_source', message: 'The card form expired. Re-enter the card and try again.' });
  const verificationToken = typeof body?.verificationToken === 'string' && body.verificationToken.length < 1024 ? body.verificationToken : undefined;
  try {
    const { orderId, startDate } = await startClubInPlace(email, sourceId, verificationToken);
    setPending(cookies, email, orderId);
    await Promise.all([
      addSignup(email, 'storybook-club').catch(() => null),
      recordEvent('checkouts', { plan: CLUB.label }),
      notify('New Storybook Club member', `Someone joined the Storybook Club ($${(CLUB.cents / 100).toFixed(2)}/month). Square billing starts ${startDate}.${placeFrom(request) ? `\nFrom: ${placeFrom(request)}` : ''}`, 'books', { event: 'club_joined', place: placeFrom(request) || null }),
    ]);
    console.log('club join ok', orderId);
    return json(200, { ok: true });
  } catch (e) {
    const { code, message } = cardMessage(e);
    console.error('club join failed', (e as Error).message, code);
    return json(402, { error: 'payment_failed', code, message });
  }
};
