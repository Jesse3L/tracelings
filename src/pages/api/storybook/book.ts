import type { APIRoute } from 'astro';
import { json } from '../../../lib/server/session';
import { readBook } from '../../../lib/server/storybook';
import { bookById, bookBody } from '../../../lib/storybook/catalog';

export const prerender = false;

// GET /api/storybook/book/?t=<receipt token>: the full book again, for a buyer downloading it a second time.
export const GET: APIRoute = async ({ url }) => {
  const r = readBook(url.searchParams.get('t'));
  const book = r ? bookById(r.bookId) : undefined;
  if (!book) return json(404, { error: 'not_found' });
  return json(200, { book: bookBody(book), id: book.id });
};
