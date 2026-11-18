import type { APIRoute } from 'astro';
import { cronAuthorized } from './daily-digest';
import { runWeekly } from '../../../lib/server/weekly';
import { ResendError } from '../../../lib/server/resend';
import { isDate } from '../../../lib/server/events';

export const prerender = false;

// Sunday's weekly email to families (vercel.json: Sundays 23:00 UTC, about 5pm Central). Vercel sends
// `Authorization: Bearer $CRON_SECRET`. ?date=YYYY-MM-DD runs a given Sunday (manual re-run, same rules).
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const GET: APIRoute = async ({ request, url }) => {
  if (!cronAuthorized(request.headers.get('authorization'))) return json(401, { error: 'unauthorized' });
  const d = url.searchParams.get('date');
  try {
    const r = await runWeekly(isDate(d) ? d : undefined);
    console.log('weekly email', JSON.stringify(r));
    return json(200, r);
  } catch (e) {
    if (e instanceof ResendError) { console.error('weekly email failed', e.status, e.code); return json(502, { error: 'resend', status: e.status, code: e.code }); }
    console.error('weekly email failed', (e as Error).message);
    return json(500, { error: 'failed' });
  }
};
