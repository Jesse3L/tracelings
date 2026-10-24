// Daily download digest checks, with no network: the `what` label rules (nothing typed gets through), grouping by
// device code, Chicago date boundaries, the email, the cron's auth, and the routes that save records.
// Uses an in-memory event store and a tiny local Resend mock.
//   npx tsx scripts/test-digest.mts                 (DIGEST_SAMPLE=<file.html> also writes a sample email)
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

let pass = 0, fail = 0;
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const eq = (a: unknown, b: unknown, m: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

// ---------- Resend mock ----------
const sent: any[] = [];
const keys: (string | undefined)[] = [];
const srv = createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/emails' && req.method === 'POST') { sent.push(JSON.parse(b)); keys.push(req.headers['idempotency-key'] as string | undefined); return res.end(JSON.stringify({ id: `em${sent.length}` })); }
    res.statusCode = 404; res.end('{"name":"not_found"}');
  });
}).listen(4198);
process.env.RESEND_API_KEY = 're_test';
process.env.RESEND_BASE_URL = 'http://127.0.0.1:4198';
process.env.OWNER_EMAIL = 'owner@example.com';
process.env.CRON_SECRET = 'cron-secret-for-tests-0123456789';
process.env.EMAIL_ADMIN_TOKEN = 'admin-token-for-tests-0123456789';
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.NOTIFY_WEBHOOK_URL;

const what = await import('../src/lib/what.ts');
const { cleanWhat, tracerWhat, coloringWhat, weekPackWhat, fontToolWhat, wordTracingWhat, whatLabel } = what;
const { cleanWhatStrict } = await import('../src/lib/server/whatVocab.ts');
const ev = await import('../src/lib/server/events.ts');
const dg = await import('../src/lib/server/digest.ts');
const store = ev.memoryStore();
ev.setEventStore(store);

// ---------- what: shape ----------
ok(cleanWhat('Letter tracing: A, capitals and lowercase, medium lines'), 'letter label ok');
ok(cleanWhat('Coloring: cute turkey'), 'coloring label ok');
for (const bad of ['Emma', 'emma tracing', "Emma's worksheet", 'My daughter Emma loves dinosaurs', '', '   ', 'Name tracing: <script>', 'Name tracing: Zoë', 'Name tracing: 🦖', 'Name tracing: a@b.com', 'Name tracing: x"y',
  `Name tracing: ${'a'.repeat(120)}`, 'Unknown tool: A', 'name tracing: A']) ok(cleanWhat(bad) === null, `shape rejects ${JSON.stringify(bad).slice(0, 50)}`);
ok(cleanWhat(42) === null && cleanWhat(null) === null && cleanWhat({}) === null, 'non-strings rejected');
ok(whatLabel('Coloring', 'Zoë’s <b>page</b>') === 'Coloring: Zos bpage/b' && cleanWhat(whatLabel('Coloring', 'Zoë’s <b>page</b>')), 'whatLabel strips characters the server would refuse');
ok(whatLabel('Name tracing', 'x'.repeat(200)).length <= 120, 'whatLabel caps length');

// ---------- what: vocabulary (typed words never pass) ----------
for (const bad of ['Name tracing: Emma', 'Name tracing: Emma, large lines', 'Word tracing: friend because where', 'Cursive: Mateo Garcia', 'Coloring: Olivia', 'Word tracing: Grandma loves Liam'])
  ok(cleanWhatStrict(bad) === null, `vocabulary rejects ${bad}`);

// ---------- what: every builder, every option, passes the server check and holds nothing typed ----------
const TYPED = ['Emma', 'Liam', 'Grandma', 'Zebulon', 'secret'];
const labels: string[] = [];
for (const mode of ['name', 'letter', 'number', 'words'] as const)
  for (const style of ['capital', 'caps', 'lower'] as const)
    for (const letterCase of ['both', 'upper', 'lower'] as const)
      for (const size of ['large', 'medium', 'small'])
        for (const practice of ['trace', 'trace-write'])
          labels.push(tracerWhat({ mode, value: mode === 'number' ? '7' : 'q', style, letterCase, size, practice, list: mode === 'name' ? 3 : 0, group: 'first-grade', chosen: 8, total: 41 }));
eq(tracerWhat({ mode: 'letter', value: 'a', style: 'capital', letterCase: 'both', size: 'medium' }), 'Letter tracing: A, capitals and lowercase, medium lines', 'letter label');
eq(tracerWhat({ mode: 'name', value: 'Emma', style: 'capital', letterCase: 'both', size: 'large' }), 'Name tracing: first letter capital, large lines', 'name label leaves the name out');
const { PLANS } = await import('../src/lib/homeschool.ts');
for (const level of ['pre-k', 'kindergarten'] as const) for (const w of PLANS[level].weeks) {
  labels.push(weekPackWhat({ level, week: w.n, title: w.title, faith: true, math: true }));
  labels.push(weekPackWhat({ level, week: w.n, toWeek: w.n + 3, list: 4 }));
  labels.push(whatLabel('Personalized plan', `${PLANS[level].label} week ${w.n}`, w.title, 'new story'));
}
eq(weekPackWhat({ level: 'pre-k', week: 1 }), 'Pre-K plan: week 1', 'week 1 label');
const plan = JSON.parse(fs.readFileSync(new URL('../src/data/coloring-plan.json', import.meta.url), 'utf8'));
for (const c of plan.collections) for (const p of c.pages) labels.push(coloringWhat(p.title));
eq(coloringWhat('Cute Turkey Coloring Page'), 'Coloring: cute turkey', 'coloring label');
const { KINDS_FOR, BLANK_LAYOUTS } = await import('../src/lib/mathSheets.ts');
const PREFIX: Record<string, any> = { 'pre-k': 'Pre-K math', 'ten-frames': 'Ten frames', 'more-less': 'More or less', 'k-addition': 'Kindergarten math', 'k-subtraction': 'Kindergarten math', 'k-mixed': 'Kindergarten math' };
for (const [series, list] of Object.entries(KINDS_FOR)) for (const k of list) labels.push(whatLabel(PREFIX[series], k.label.toLowerCase(), 'within 10', 'set of 5', 'class list of 3'));
for (const b of BLANK_LAYOUTS) labels.push(whatLabel('Ten frames', 'blank ten frames', b.label.toLowerCase()));
const { WP_KINDS, WP_THEMES } = await import('../src/lib/wordProblems.ts');
for (const k of WP_KINDS) for (const t of WP_THEMES) labels.push(whatLabel('Kindergarten word problems', k.label.toLowerCase(), `${t.label.toLowerCase()} theme`, 'within 10'));
const { FAMILY_KINDS, FAMILY_SLUGS } = await import('../src/lib/wordFamilies.ts');
for (const f of FAMILY_SLUGS) for (const k of FAMILY_KINDS) labels.push(whatLabel('Word families', `-${f}`, k.label.toLowerCase()));
const { THEMES } = await import('../src/lib/program/themes.ts');
for (const t of Object.values(THEMES)) labels.push(whatLabel('Personalized plan', 'free week 1', `${t.label.toLowerCase()} theme`));
const sight = JSON.parse(fs.readFileSync(new URL('../src/data/sight-words.json', import.meta.url), 'utf8'));
for (const l of sight) { labels.push(whatLabel('Sight word flash cards', l.short, 'all 40 words')); labels.push(tracerWhat({ mode: 'words', value: 'a', style: 'lower', letterCase: 'lower', size: 'large', group: l.slug, chosen: 3, total: 40 })); }
for (const kind of ['cursive', 'coloring'] as const) for (const theme of ['stars', 'hearts', 'flowers', 'bubbles', 'plain']) for (const text of ['Emma', 'Emma Rose Liam', ''])
  labels.push(fontToolWhat({ kind, text, size: 'large', theme, caps: true }));
eq(fontToolWhat({ kind: 'cursive', text: 'Emma Rose', size: 'large', theme: 'stars', caps: true }), 'Cursive: custom text, 2 words, large lines', 'cursive typed text: only its length');
eq(fontToolWhat({ kind: 'coloring', text: 'Emma', size: 'large', theme: 'hearts', caps: false }), 'Name coloring: hearts theme, lowercase', 'name coloring leaves the name out');
const EX = [{ label: 'Spelling list', text: 'friend\nbecause' }, { label: 'A sentence', text: 'The little red hen found a seed.' }, { label: 'Days of the week', text: 'Monday' }];
eq(wordTracingWhat({ text: 'Emma\nGrandma loves Liam\nsecret', lines: 3, examples: EX, size: 'medium' }), 'Word tracing: custom words, 3 lines, medium lines', 'word tracing custom text');
eq(wordTracingWhat({ text: 'friend\nbecause', lines: 2, examples: EX, size: 'small' }), 'Word tracing: example (Spelling list), small lines', 'word tracing example');
for (const e of EX) labels.push(wordTracingWhat({ text: e.text, lines: 1, examples: EX, size: 'large' }));
labels.push(wordTracingWhat({ text: 'x', lines: 9, examples: EX, size: 'large' }), wordTracingWhat({ text: 'p', lines: 1, examples: EX, preset: 'p', size: 'large' }));
for (const l of ['A to G', 'H to N', 'O to U', 'V to Z', 'A to Z']) labels.push(whatLabel('Cursive alphabet', l, 'large lines'));
labels.push(whatLabel('Alphabet chart', 'capitals', 'start dots'), whatLabel('Cursive alphabet chart', 'capitals and lowercase'), whatLabel('Number tracing', '1 to 20', 'rows, small lines'),
  whatLabel('Number tracing', '1 to 10', 'one page'), whatLabel('Alphabet tracing', 'A to Z', 'lowercase', 'large lines'), whatLabel('Kindergarten math sampler', '8 pages'),
  whatLabel('Personalized plan', 'progress report'), whatLabel('Personalized plan', 'placement check'), whatLabel('Class pack', 'tracing + cursive + coloring', 'class list of 6'),
  whatLabel('Personalized plan', 'Pre-K week 4', 'Review: S, A, T', 'ready-made story'), whatLabel('Personalized plan', 'Kindergarten week 9', 'Review: -at words'), whatLabel('Personalized plan', 'Kindergarten week 9', 'Review: short a words'));
let bad = 0;
for (const l of labels) {
  if (cleanWhatStrict(l) !== l) { bad++; if (bad < 8) console.log('  label refused by server:', l); }
  for (const t of TYPED) if (l.toLowerCase().includes(t.toLowerCase())) { bad++; console.log('  typed text in label:', l); }
}
ok(bad === 0, `${labels.length} builder labels all pass the server check with nothing typed (${bad} bad)`);

// ---------- Chicago dates ----------
eq(ev.chicagoDate(Date.parse('2026-10-24T04:59:59Z')), '2026-10-23', 'CDT: 11:59pm is still the 23rd');
eq(ev.chicagoDate(Date.parse('2026-10-24T05:00:00Z')), '2026-10-24', 'CDT: midnight is the 24th');
eq(ev.chicagoDate(Date.parse('2026-01-15T05:59:59Z')), '2026-01-14', 'CST: 11:59pm is still the 14th');
eq(ev.chicagoDate(Date.parse('2026-01-15T06:00:00Z')), '2026-01-15', 'CST: midnight is the 15th');
eq(ev.chicagoDate(Date.parse('2026-11-01T05:30:00Z')), '2026-11-01', 'DST end day: 12:30am CDT');
eq(ev.chicagoDate(Date.parse('2026-11-02T05:30:00Z')), '2026-11-01', 'day after DST end: 11:30pm CST is still Nov 1');
eq(ev.chicagoYesterday(Date.parse('2026-10-24T12:05:00Z')), '2026-10-23', 'cron at 12:05 UTC reports yesterday');
eq(ev.chicagoYesterday(Date.parse('2026-03-01T12:05:00Z')), '2026-02-28', 'yesterday across a month end');
eq(ev.chicagoYesterday(Date.parse('2026-01-01T03:00:00Z')), '2025-12-30', 'late evening UTC new year is still Dec 31 in Chicago, so yesterday is Dec 30');
eq(ev.addDays('2026-10-24', -35), '2026-09-19', 'addDays');
ok(ev.isDate('2026-10-23') && !ev.isDate('2026-1-2') && !ev.isDate('x') && !ev.isDate(5), 'isDate');

// ---------- recordEvent ----------
ok(await ev.recordEvent('events', { path: '/a/', what: null, pages: 1, member: false, vid: null, place: null }), 'record saved');
const saved = [...store.data.keys()].filter((k) => k.startsWith('events/'));
ok(saved.length === 1 && saved[0].startsWith(`events/${ev.chicagoDate()}/`) && /\/\d{13}-[0-9a-f]{8}\.json$/.test(saved[0]), `record path ${saved[0]}`);
store.data.clear();
ev.setEventStore({ ...ev.memoryStore(), put: () => new Promise(() => {}) });
let t0 = Date.now();
ok((await ev.recordEvent('events', { path: '/a/', what: null, pages: 1, member: false, vid: null, place: null }, 200)) === false && Date.now() - t0 < 600, 'a hung write gives up after the timeout');
ev.setEventStore({ ...ev.memoryStore(), put: async () => { throw new Error('boom'); } });
ok((await ev.recordEvent('signups', { email: 'a@b.co', source: 'x' })) === false, 'a failed write resolves false');
ev.setEventStore(store);

// ---------- grouping ----------
const E = (at: string, vid: string | null, path: string, w: string | null, extra: Partial<any> = {}) => ({ at, vid, path, what: w, pages: 1, member: false, place: 'Austin, Texas, US', ...extra });
const day: any = {
  date: '2026-10-23',
  events: [
    E('2026-10-23T15:00:00.000Z', 'bbbbbbbbbbbbbbbb', '/coloring-pages/thanksgiving/cute-turkey/', 'Coloring: cute turkey', { place: 'Lubbock, Texas, US' }),
    E('2026-10-23T14:00:00.000Z', 'aaaaaaaaaaaaaaaa', '/letter-tracing/a/', 'Letter tracing: A, capitals and lowercase, medium lines'),
    E('2026-10-23T16:00:00.000Z', 'aaaaaaaaaaaaaaaa', '/name-tracing/', 'Name tracing: first letter capital, large lines', { pages: 2, place: null }),
    E('2026-10-23T17:00:00.000Z', null, '/name-tracing/', null, { place: null }),
    E('2026-10-23T18:00:00.000Z', 'aaaaaaaaaaaaaaaa', '/homeschool/preschool/', 'Pre-K plan: week 1 (Letter S)', { pages: 7, member: true }),
    E('2026-10-23T19:00:00.000Z', null, '/letter-tracing/a/', 'Letter tracing: A, capitals, large lines', { place: 'Clovis, New Mexico, US' }),
  ],
  signups: [{ at: '2026-10-23T14:30:00.000Z', email: 'parent@example.com', source: 'letter-tracing' }],
  checkouts: [{ at: '2026-10-23T18:30:00.000Z', plan: 'Personalized, yearly' }],
};
const vs = dg.groupVisitors(day.events);
eq(vs.length, 4, 'four visitors (one device code with 3, one with 1, two without a code)');
eq(vs[0].downloads.map((d) => d.path), ['/letter-tracing/a/', '/name-tracing/', '/homeschool/preschool/'], 'visitor 1 in time order');
eq(vs.map((v) => v.n), [1, 2, 3, 4], 'numbered by first download');
ok(vs[0].member && !vs[1].member, 'member marked when any download was a member');
eq(vs[0].place, 'Austin, Texas, US', 'latest known place');
eq(vs[1].place, 'Lubbock, Texas, US', 'visitor 2 place');
ok(vs[2].place === null && vs[3].place === 'Clovis, New Mexico, US', 'no-code downloads are separate visitors');

const sum = dg.summarize(day);
eq(sum.totals, { downloads: 6, visitors: 4, memberDownloads: 1, freeDownloads: 5, signups: 1, checkouts: 1 }, 'totals');
eq(sum.pages.slice(0, 2), [{ path: '/letter-tracing/a/', count: 2 }, { path: '/name-tracing/', count: 2 }], 'top pages sorted by count then path');

// ---------- rendering ----------
const r = dg.renderDigest(sum, '2026-10-23');
eq(r.subject, 'Tracelings yesterday: 6 downloads, 1 new email, 1 checkout', 'subject');
eq(dg.digestSubject({ ...sum, date: '2026-10-20' }, '2026-10-23'), 'Tracelings on Oct 20: 6 downloads, 1 new email, 1 checkout', 'subject for another day');
ok(r.text.includes('Visitor 1 (Austin, Texas, US), member, 3 downloads: Letter tracing: A, capitals and lowercase, medium lines (1 page) on /letter-tracing/a/; Name tracing: first letter capital, large lines (2 pages) on /name-tracing/; Pre-K plan: week 1 (Letter S) (7 pages) on /homeschool/preschool/'), 'visitor line in text');
ok(r.text.includes('Visitor 3, 1 download: A PDF (1 page) on /name-tracing/'), 'download without a label');
ok(r.html.includes('href="https://tracelings.com/letter-tracing/a/"'), 'page links');
ok(r.html.includes('parent@example.com') && r.html.includes('from letter-tracing'), 'sign-ups listed');
ok(r.html.includes('Personalized, yearly'), 'checkouts listed');
ok(r.html.includes('>member<'), 'member badge');
ok(r.html.includes('Friday, October 23, 2026'), 'long date');
ok(r.html.includes('name="viewport"') && r.html.includes('max-width:600px'), 'mobile friendly');
const evil = dg.renderDigest(dg.summarize({ date: '2026-10-23', events: [E('2026-10-23T14:00:00.000Z', null, '/a/', null, { place: '<img src=x onerror=alert(1)>' })], signups: [{ at: '2026-10-23T14:00:00.000Z', email: '"><b>x@y.co', source: 'x' }], checkouts: [] }), '2026-10-23');
ok(!evil.html.includes('<img src=x') && !evil.html.includes('"><b>'), 'html escaped');
const many: any = { date: '2026-10-23', events: Array.from({ length: 55 }, (_, i) => E(`2026-10-23T14:${String(i).padStart(2, '0')}:00.000Z`, `${'c'.repeat(14)}${String.fromCharCode(97 + Math.floor(i / 26))}${String.fromCharCode(97 + (i % 26))}`, '/a/', null)), signups: [], checkouts: [] };
const ms = dg.summarize(many);
ok(ms.visitors.length === 50 && ms.moreVisitors === 5 && ms.totals.visitors === 55, 'capped at 50 visitors');
ok(dg.renderDigest(ms, '2026-10-23').text.includes('And 5 more visitors.'), 'and N more');
const empty = dg.renderDigest(dg.summarize({ date: '2026-10-23', events: [], signups: [], checkouts: [] }), '2026-10-23');
eq(empty.subject, 'Tracelings yesterday: 0 downloads, 0 new emails, 0 checkouts', 'empty subject');
if (process.env.DIGEST_SAMPLE) {
  fs.mkdirSync(path.dirname(process.env.DIGEST_SAMPLE), { recursive: true });
  fs.writeFileSync(process.env.DIGEST_SAMPLE, r.html);
  fs.writeFileSync(process.env.DIGEST_SAMPLE.replace(/\.html$/, '.txt'), `Subject: ${r.subject}\n\n${r.text}`);
  console.log('sample written to', process.env.DIGEST_SAMPLE);
}

// ---------- cron route ----------
const { GET } = await import('../src/pages/api/cron/daily-digest.ts');
const cron = (auth?: string, q = '') => GET({ request: new Request(`https://tracelings.com/api/cron/daily-digest/${q}`, { headers: auth ? { authorization: auth } : {} }), url: new URL(`https://tracelings.com/api/cron/daily-digest/${q}`) } as any) as Promise<Response>;
eq((await cron()).status, 401, 'cron: no auth is 401');
eq((await cron('Bearer wrong')).status, 401, 'cron: wrong secret is 401');
eq((await cron(process.env.CRON_SECRET)).status, 401, 'cron: secret without Bearer is 401');
const secret = process.env.CRON_SECRET; delete process.env.CRON_SECRET;
eq((await cron(`Bearer ${secret}`)).status, 401, 'cron: 401 when CRON_SECRET is not set');
eq((await cron('Bearer ')).status, 401, 'cron: empty bearer with no secret is 401');
process.env.CRON_SECRET = secret;

// yesterday is empty: no email
store.data.clear();
let res = await cron(`Bearer ${secret}`);
let body: any = await res.json();
ok(res.status === 200 && body.sent === false && body.skipped === 'empty' && sent.length === 0, `cron: empty day sends nothing (${JSON.stringify(body)})`);
res = await cron(`Bearer ${secret}`, '?force=1');
body = await res.json();
ok(res.status === 200 && body.sent === true && sent.length === 1, 'cron: ?force=1 sends on an empty day');
// put records into yesterday's folder and an old one
const y = ev.chicagoYesterday();
const old = ev.addDays(ev.chicagoDate(), -40);
for (const e of day.events) store.data.set(`events/${y}/${Date.parse(e.at)}-${Math.random().toString(16).slice(2, 10)}.json`, JSON.stringify(e));
store.data.set(`signups/${y}/1-a.json`, JSON.stringify(day.signups[0]));
store.data.set(`checkouts/${y}/1-a.json`, JSON.stringify(day.checkouts[0]));
store.data.set(`events/${old}/1-old.json`, JSON.stringify(day.events[0]));
store.data.set(`signups/${old}/1-old.json`, JSON.stringify(day.signups[0]));
store.data.set(`events/${ev.addDays(ev.chicagoDate(), -30)}/1-keep.json`, JSON.stringify(day.events[0]));
res = await cron(`Bearer ${secret}`);
body = await res.json();
ok(res.status === 200 && body.sent === true && sent.length === 2, `cron: sends yesterday (${JSON.stringify(body)})`);
const mail = sent[1];
eq(mail.from, 'Tracelings reports <hello@tracelings.com>', 'from');
eq(mail.to, ['owner@example.com'], 'to owner');
eq(mail.subject, 'Tracelings yesterday: 6 downloads, 1 new email, 1 checkout', 'sent subject');
ok(typeof mail.html === 'string' && typeof mail.text === 'string', 'html and text');
eq(keys[1], `digest-${y}`, 'idempotency key per day');
ok(!JSON.stringify(body).includes('parent@example.com'), 'cron response holds no addresses');
eq(body.pruned, 2, 'pruned records older than 35 days');
ok(![...store.data.keys()].some((k) => k.includes(old)) && [...store.data.keys()].some((k) => k.includes('1-keep')), 'old gone, recent kept');

// ---------- admin action ----------
const admin = await import('../src/pages/api/admin/email.ts');
const call = (b: unknown) => admin.POST({ request: new Request('https://tracelings.com/api/admin/email/', { method: 'POST', headers: { authorization: `Bearer ${process.env.EMAIL_ADMIN_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify(b) }) } as any) as Promise<Response>;
const before = sent.length;
res = await call({ action: 'digest', date: y });
body = await res.json();
ok(res.status === 200 && body.sent === false && body.summary.totals.downloads === 6 && sent.length === before, 'admin digest: summary, no email');
res = await call({ action: 'digest', date: y, send: true });
body = await res.json();
ok(res.status === 200 && body.sent === true && sent.length === before + 1, 'admin digest: send: true emails the owner');
eq((await call({ action: 'digest', date: '10/23/2026' })).status, 400, 'admin digest: bad date');

// ---------- routes that save records ----------
store.data.clear();
const { POST: event } = await import('../src/pages/api/event.ts');
const ping = (b: any, ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', ip = '10.0.0.1') => event({ request: new Request('https://tracelings.com/api/event/', { method: 'POST', body: JSON.stringify(b), headers: { 'user-agent': ua, origin: 'https://tracelings.com', 'x-forwarded-for': ip, 'x-vercel-ip-city': 'Austin', 'x-vercel-ip-country-region': 'Texas', 'x-vercel-ip-country': 'US' } }), clientAddress: ip } as any) as Promise<Response>;
const base = { type: 'download', path: '/name-tracing/', pages: 1, member: false, human: true, secs: 9, vid: 'abcdefghijklmnop' };
eq((await ping({ ...base, what: 'Name tracing: first letter capital, large lines' })).status, 204, 'ping accepted');
await ping({ ...base, what: 'Name tracing: Emma' });
await ping({ ...base, what: 'Emma', vid: 'NOT-A-CODE' });
await ping({ ...base, what: 'Letter tracing: A' }, 'python-requests/2.0');
await ping({ ...base, human: false });
const recs = [...store.data.entries()].filter(([k]) => k.startsWith('events/')).map(([, v]) => JSON.parse(v)).sort((a, b) => a.at.localeCompare(b.at));
eq(recs.length, 3, 'bot pings are not saved');
eq(recs.map((x) => x.what), ['Name tracing: first letter capital, large lines', null, null], 'labels with typed text are dropped server-side');
eq(recs.map((x) => x.vid), ['abcdefghijklmnop', 'abcdefghijklmnop', null], 'bad device code dropped');
eq(recs[0].place, 'Austin, Texas, US', 'place saved');
eq(Object.keys(recs[0]).sort(), ['at', 'member', 'pages', 'path', 'place', 'vid', 'what'], 'only the allowed fields');

const { POST: subscribe } = await import('../src/pages/api/subscribe.ts');
await subscribe({ request: new Request('https://tracelings.com/api/subscribe/', { method: 'POST', body: JSON.stringify({ email: 'New@Example.com', source: 'name-tracing', name: 'Emma' }), headers: { 'content-type': 'application/json' } }) } as any);
const sg = [...store.data.entries()].filter(([k]) => k.startsWith('signups/')).map(([, v]) => JSON.parse(v));
eq(sg.map((s) => [s.email, s.source]), [['new@example.com', 'name-tracing']], 'sign-up saved (email + source only)');
ok(!JSON.stringify(sg).includes('Emma'), 'no name in sign-up record');

srv.close();
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
