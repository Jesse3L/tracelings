// Email list section of the daily digest, with no network: a tiny Resend mock and an in-memory store.
//   npx tsx scripts/test-email-health.mts
import { createServer } from 'node:http';

let pass = 0, fail = 0;
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };

const contacts = [
  { id: 'c1', email: 'a@example.com', unsubscribed: false, created_at: '2026-11-09T15:00:00Z', properties: { member: { value: 'true', type: 'string' } } },
  { id: 'c2', email: 'b@example.com', unsubscribed: true, created_at: '2026-11-01T15:00:00Z' },
  { id: 'c3', email: 'c@example.com', unsubscribed: false, created_at: '2026-11-01T15:00:00Z' },
];
const sent: any[] = [];
const srv = createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    const u = new URL(req.url!, 'http://x');
    const page = (data: unknown[]) => res.end(JSON.stringify({ data, has_more: false }));
    if (u.pathname === '/emails' && req.method === 'POST') { sent.push(JSON.parse(b)); return res.end('{"id":"em1"}'); }
    if (u.pathname === '/contacts') return page(contacts);
    if (u.pathname === '/domains') return page([{ id: 'd1', name: 'tracelings.com' }]);
    if (u.pathname === '/domains/d1') return res.end(JSON.stringify({ id: 'd1', open_tracking: false, click_tracking: true }));
    if (u.pathname === '/broadcasts') return page([{ id: 'b1', name: 'launch-a', status: 'sent', sent_at: new Date(Date.now() - 86_400_000).toISOString() }, { id: 'b0', name: 'old', status: 'sent', sent_at: '2026-01-01T00:00:00Z' }]);
    if (u.pathname === '/broadcasts/b1/recipients') return page(u.searchParams.get('type') === 'delivered' ? [1, 2, 3].map((i) => ({ id: `r${i}` })) : u.searchParams.get('type') === 'clicked' ? [{ id: 'r1' }] : []);
    if (u.pathname === '/automations') return page([{ name: 'Tracelings welcome: letters', status: 'enabled' }]);
    res.statusCode = 404; res.end('{"name":"not_found"}');
  });
}).listen(4199);
process.env.RESEND_API_KEY = 're_test';
process.env.RESEND_BASE_URL = 'http://127.0.0.1:4199';
process.env.OWNER_EMAIL = 'owner@example.com';
delete process.env.BLOB_READ_WRITE_TOKEN;

const ev = await import('../src/lib/server/events.ts');
const dg = await import('../src/lib/server/digest.ts');
const { emailHealth } = await import('../src/lib/server/emailHealth.ts');
ev.setEventStore(ev.memoryStore());

const h1: any = await emailHealth('2026-11-09');
ok(h1.contacts === 3 && h1.subscribed === 2 && h1.unsubscribed === 1, 'counts');
ok(h1.members === 1, 'member property read from { value }');
ok(h1.newContacts === 1, 'new contact on the day (Chicago)');
ok(h1.newUnsubscribes === null, 'no earlier snapshot: unknown');
ok(h1.openTracking === false && h1.clickTracking === true, 'tracking flags');
ok(h1.broadcasts.length === 1 && h1.broadcasts[0].delivered === 3 && h1.broadcasts[0].clicked === 1 && h1.broadcasts[0].opened === null, 'only recent broadcast, opens skipped when off');
ok(h1.welcome.find((w: any) => w.variant === 'letters')?.status === 'enabled' && h1.welcome.some((w: any) => w.status === 'missing'), 'welcome statuses');

contacts[2].unsubscribed = true;
const h2: any = await emailHealth('2026-11-10');
ok(JSON.stringify(h2.newUnsubscribes) === '["c@example.com"]', `new unsubscribe found: ${JSON.stringify(h2.newUnsubscribes)}`);
const again: any = await emailHealth('2026-11-10');
ok(JSON.stringify(again.newUnsubscribes) === '["c@example.com"]', 'second run same day compares with the day before');

// Rendered into the digest, and an otherwise empty day with a new unsubscribe still sends.
const r = await dg.runDigest({ date: '2026-11-10', send: true });
ok(r.sent, 'digest sent on a day whose only news is an unsubscribe');
const html: string = sent.at(-1)?.html ?? '', text: string = sent.at(-1)?.text ?? '';
ok(html.includes('Email list') && html.includes('c@example.com'), 'html has the section and the unsubscribe');
ok(html.includes('Opens aren') && text.includes('opens off'), 'open tracking note');
ok(text.includes('Welcome emails: off for'), 'welcome off list');
const preview = await dg.runDigest({ date: '2026-11-10', send: false });
ok(!preview.summary.email, 'preview does not touch email numbers');

// Resend down: the digest still sends with a short note.
process.env.RESEND_BASE_URL = 'http://127.0.0.1:1';
const down: any = await emailHealth('2026-11-11', 5000);
ok(typeof down.error === 'string', 'error instead of throwing');

srv.close();
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
