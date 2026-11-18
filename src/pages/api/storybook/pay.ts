import type { APIRoute } from 'astro';
import { payConfig, payItemInPlace, cardMessage } from '../../../lib/server/square';
import { json, cleanEmail, sameOrigin } from '../../../lib/server/session';
import { notify, placeFrom } from '../../../lib/server/notify';
import { recordEvent } from '../../../lib/server/events';
import { addSignup } from '../../../lib/server/email';
import { signBook, emailBookLink } from '../../../lib/server/storybook';
import { bookById, bookBody, BOOK_CENTS } from '../../../lib/storybook/catalog';

export const prerender = false;

// POST /api/storybook/pay/ {bookId, email, sourceId, verificationToken?}: buys one personalized storybook ($5) with the
// in-page Square card form. The child's name never comes here: the browser fills it into the book it gets back.
export const POST: APIRoute = async ({ request, url }) => {
  if (!sameOrigin(request, url)) return json(403, { error: 'bad_origin' });
  if (!(await payConfig().catch(() => null))) return json(503, { error: 'not_configured' });
  const body = await request.json().catch(() => ({}));
  const book = typeof body?.bookId === 'string' ? bookById(body.bookId) : undefined;
  if (!book) return json(400, { error: 'invalid_book' });
  const email = cleanEmail(body?.email);
  if (!email) return json(400, { error: 'invalid_email', message: 'Check the email address; your download link goes there.' });
  const sourceId = typeof body?.sourceId === 'string' && /^[A-Za-z0-9:_\-]{8,256}$/.test(body.sourceId) ? body.sourceId : '';
  if (!sourceId) return json(400, { error: 'invalid_source', message: 'The card form expired. Re-enter the card and try again.' });
  const verificationToken = typeof body?.verificationToken === 'string' && body.verificationToken.length < 1024 ? body.verificationToken : undefined;
  try {
    const orderId = await payItemInPlace({ name: `Tracelings storybook: ${book.title}`, cents: BOOK_CENTS, note: `Tracelings personalized storybook: ${book.title} (${book.group})` }, sourceId, email, verificationToken);
    const token = signBook(book.id, orderId);
    console.log('storybook pay ok', book.id, orderId);
    await Promise.all([
      emailBookLink(email, book.title, token),
      addSignup(email, 'storybook').catch(() => null),
      recordEvent('checkouts', { plan: `Storybook: ${book.title}` }),
      notify('Storybook sold', `$${(BOOK_CENTS / 100).toFixed(2)} storybook: ${book.title} (${book.group}).${placeFrom(request) ? `\nFrom: ${placeFrom(request)}` : ''}`, 'books', { event: 'storybook_paid', book: book.id, place: placeFrom(request) || null }),
    ]);
    return json(200, { ok: true, token, book: bookBody(book) });
  } catch (e) {
    const { code, message } = cardMessage(e);
    console.error('storybook pay failed', (e as Error).message, code);
    return json(402, { error: 'payment_failed', code, message });
  }
};
