import type { APIRoute } from 'astro';
import { squareConfigured, activeMembership } from '../../../lib/server/square';
import { json, readSession } from '../../../lib/server/session';
import { bookById, bookBody } from '../../../lib/storybook/catalog';

export const prerender = false;

// GET /api/storybook/club-book/?id=<book id>: any storybook, free for signed-in Storybook Club members and
// Tracelings at Home program members.
export const GET: APIRoute = async ({ url, cookies }) => {
  const book = bookById(url.searchParams.get('id') ?? '');
  if (!book) return json(404, { error: 'not_found' });
  const s = readSession(cookies);
  if (!s || !squareConfigured()) return json(401, { error: 'signed_out' });
  try {
    const ok = (await activeMembership(s.cids, 'club')) ?? (await activeMembership(s.cids));
    if (!ok) return json(403, { error: 'not_member' });
    return json(200, { book: bookBody(book) });
  } catch (e) {
    console.error('club-book failed', (e as Error).message);
    return json(502, { error: 'lookup_failed' });
  }
};
