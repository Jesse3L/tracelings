// QA mocks: Square on $SQ_PORT (4110), Anthropic on $AI_PORT (4111). Every request is logged to $QA_OUT/logs/mock-log.jsonl.
import http from 'node:http';
import fs from 'node:fs';
import art from '../../src/lib/program/sceneArt.json' with { type: 'json' };
import { setSceneArt } from '../../src/lib/program/story';
import { PLANS } from '../../src/lib/homeschool';
import { THEMES, THEME_IDS } from '../../src/lib/program/themes';
import { templateContentFor, sceneStoryFor } from '../../src/lib/program/templates';
import { validateContent, weekFacts, storyFacts } from '../../src/lib/server/ai';
setSceneArt(art as any);
const LOG = (process.env.QA_OUT ?? '/tmp/tracelings-qa') + '/logs/mock-log.jsonl';
fs.mkdirSync(LOG.replace(/[^/]+$/, ''), { recursive: true }); fs.writeFileSync(LOG, '');
const log = (o: any) => fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), ...o }) + '\n');
const body = (req: http.IncomingMessage) => new Promise<string>((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });
const send = (res: http.ServerResponse, code: number, o: any) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(typeof o === 'string' ? o : JSON.stringify(o)); };

// ---------- Square ----------
let sqMode = 'ok';
const v = (id: string, cents: number, cadence: string, name: string) => ({ id, type: 'SUBSCRIPTION_PLAN_VARIATION', subscription_plan_variation_data: { name, phases: [{ cadence, ordinal: 0, pricing: { type: 'STATIC', price_money: { amount: cents, currency: 'USD' } } }] } });
const variations: any[] = [v('V_FAM_M', 599, 'MONTHLY', 'Family monthly'), v('V_FAM_A', 3900, 'ANNUAL', 'Family yearly'), v('V_CLASS', 7900, 'ANNUAL', 'Classroom'), v('V_FOUND', 2900, 'ANNUAL', 'Founding')];
const plans: any[] = [];
const now = () => new Date().toISOString();
const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
// email -> customers; customer -> subs/cards
const people: Record<string, { cids: string[] }> = {
  'member@example.com': { cids: ['C_M1'] },
  'member2@example.com': { cids: ['C_M2'] },
  'lapsed@example.com': { cids: ['C_LAP'] },
  'canceling@example.com': { cids: ['C_CXL'] },
  'family@example.com': { cids: ['C_FAM'] },
  'classroom@example.com': { cids: ['C_CLS'] },
  'founding@example.com': { cids: ['C_FND'] },
  'fresh@example.com': { cids: ['C_FRESH'] },
  'twocust@example.com': { cids: ['C_TWO_A', 'C_TWO_B'] },
  'pending@example.com': { cids: ['C_PEND'] },
};
const subs: any[] = [
  { id: 'S_M1', customer_id: 'C_M1', plan: 'program-annual', status: 'ACTIVE', charged_through_date: '2027-10-01', created_at: ago(15) },
  { id: 'S_M2', customer_id: 'C_M2', plan: 'program-monthly', status: 'ACTIVE', charged_through_date: '2026-11-10', created_at: ago(6) },
  { id: 'S_LAP', customer_id: 'C_LAP', plan: 'program-monthly', status: 'CANCELED', charged_through_date: '2026-09-01', created_at: ago(90) },
  { id: 'S_CXL', customer_id: 'C_CXL', plan: 'program-monthly', status: 'ACTIVE', charged_through_date: '2026-11-01', canceled_date: '2026-11-01', created_at: ago(20) },
  { id: 'S_FAM', customer_id: 'C_FAM', variation: 'V_FAM_M', status: 'ACTIVE', charged_through_date: '2026-11-03', created_at: ago(200) },
  { id: 'S_CLS', customer_id: 'C_CLS', variation: 'V_CLASS', status: 'ACTIVE', charged_through_date: '2027-03-03', created_at: ago(200) },
  { id: 'S_FND', customer_id: 'C_FND', variation: 'V_FOUND', status: 'ACTIVE', charged_through_date: '2027-03-03', created_at: ago(200) },
  { id: 'S_FRESH', customer_id: 'C_FRESH', plan: 'program-annual', status: 'ACTIVE', charged_through_date: '2027-10-16', created_at: now() },
  { id: 'S_TWO_old', customer_id: 'C_TWO_A', plan: 'program-monthly', status: 'CANCELED', created_at: ago(300) },
  { id: 'S_TWO_new', customer_id: 'C_TWO_B', plan: 'program-annual', status: 'ACTIVE', charged_through_date: '2027-10-01', created_at: ago(3) },
  { id: 'S_PEND', customer_id: 'C_PEND', plan: 'program-monthly', status: 'PENDING', created_at: ago(0.01) },
];
const orders: Record<string, any> = {};
let orderN = 0;
const cards: Record<string, string[]> = { C_M1: ['4242'], C_M2: ['1111'], C_LAP: ['4242'], C_CXL: ['4242'], C_FAM: ['5555'], C_CLS: ['5555'], C_FND: ['5555'], C_FRESH: ['9999'], C_TWO_A: ['1234'], C_TWO_B: ['5678'], C_PEND: ['2222'] };
const varIdFor = (planKey: string) => {
  const want = planKey === 'program-annual' ? [9900, 'ANNUAL'] : [1499, 'MONTHLY'];
  return variations.find((x) => x.subscription_plan_variation_data.phases.at(-1).pricing.price_money.amount === want[0] && x.subscription_plan_variation_data.phases.at(-1).cadence === want[1])?.id ?? `MISSING_${planKey}`;
};
http.createServer(async (req, res) => {
  const b = await body(req);
  log({ svc: 'square', method: req.method, url: req.url, headers: req.headers, body: b });
  const u = new URL(req.url!, 'http://x');
  if (u.pathname === '/__mode') { sqMode = b || 'ok'; return send(res, 200, { sqMode }); }
  if (u.pathname === '/__state') return send(res, 200, { variations: variations.map((x) => x.id), subs });
  if (sqMode === 'down') return send(res, 500, { errors: [{ code: 'INTERNAL_SERVER_ERROR' }] });
  if (sqMode === 'slow') await new Promise((r) => setTimeout(r, 30000));
  if (sqMode === 'checkout-down' && u.pathname === '/v2/online-checkout/payment-links') return send(res, 500, { errors: [{ code: 'INTERNAL_SERVER_ERROR' }] });
  if (u.pathname === '/v2/locations') return send(res, 200, { locations: [{ id: 'LOC1', status: 'ACTIVE' }] });
  if (u.pathname === '/v2/catalog/list') {
    if (u.searchParams.get('types') === 'SUBSCRIPTION_PLAN') return send(res, 200, { objects: plans });
    return send(res, 200, { objects: variations });
  }
  if (u.pathname === '/v2/catalog/object') {
    const o = JSON.parse(b).object;
    if (o.type === 'SUBSCRIPTION_PLAN') { const p = { id: `PLAN_${plans.length + 1}`, ...o }; plans.push(p); return send(res, 200, { catalog_object: p }); }
    const id = `V_PROG_${variations.length + 1}`;
    variations.push({ id, type: 'SUBSCRIPTION_PLAN_VARIATION', subscription_plan_variation_data: o.subscription_plan_variation_data });
    return send(res, 200, { catalog_object: { id } });
  }
  if (u.pathname === '/v2/online-checkout/payment-links') {
    const id = `ORD_${++orderN}`;
    const j = JSON.parse(b);
    orders[id] = { id, state: 'OPEN', created_at: now(), total_money: j.quick_pay?.price_money ?? { amount: 0, currency: 'USD' }, net_amount_due_money: j.quick_pay?.price_money ?? { amount: 0, currency: 'USD' }, tenders: [], email: j.pre_populated_data?.buyer_email, plan: j.checkout_options?.subscription_plan_id };
    return send(res, 200, { payment_link: { id: `PL_${orderN}`, order_id: id, url: `https://square.example/checkout/${id}` } });
  }
  // Test hook: the buyer pays order <id> (body: {"email": "...", "last4": "..."}). Creates the customer and subscription like Square does.
  const pay = u.pathname.match(/^\/__pay\/([^/]+)$/);
  if (pay) {
    const o = pay[1] === 'latest' ? Object.values(orders).filter((x) => x.state === 'OPEN').at(-1) : orders[pay[1]];
    if (!o) return send(res, 404, {});
    pay[1] = o.id;
    const j = b ? JSON.parse(b) : {}; const email = j.email ?? o.email;
    const cid = `C_PAID_${pay[1]}`;
    (people[email] ??= { cids: [] }).cids.push(cid);
    cards[cid] = [j.last4 ?? '7777'];
    const planKey = variations.find((x) => x.id === o.plan)?.subscription_plan_variation_data.phases.at(-1).cadence === 'ANNUAL' ? 'program-annual' : 'program-monthly';
    subs.push({ id: `S_PAID_${pay[1]}`, customer_id: cid, plan: planKey, status: 'ACTIVE', charged_through_date: '2027-10-16', created_at: now() });
    Object.assign(o, { state: 'COMPLETED', customer_id: cid, net_amount_due_money: { amount: 0, currency: 'USD' }, tenders: [{ id: 'T1', type: 'CARD', customer_id: cid }] });
    return send(res, 200, { ok: true, cid });
  }
  const ord = u.pathname.match(/^\/v2\/orders\/([^/]+)$/);
  if (ord) { const o = orders[decodeURIComponent(ord[1])]; if (!o) return send(res, 404, { errors: [{ code: 'NOT_FOUND' }] }); const { email, plan, ...pub } = o; return send(res, 200, { order: pub }); }
  if (u.pathname === '/v2/customers/search') {
    const email = JSON.parse(b).query.filter.email_address.exact;
    return send(res, 200, { customers: (people[email]?.cids ?? []).map((id) => ({ id })) });
  }
  if (u.pathname === '/v2/subscriptions/search') {
    const ids: string[] = JSON.parse(b).query.filter.customer_ids;
    return send(res, 200, { subscriptions: subs.filter((s) => ids.includes(s.customer_id)).map((s) => ({ ...s, plan_variation_id: s.variation ?? varIdFor(s.plan) })) });
  }
  const m = u.pathname.match(/^\/v2\/subscriptions\/([^/]+)\/cancel$/);
  if (m) { const s = subs.find((x) => x.id === decodeURIComponent(m[1])); if (!s) return send(res, 404, { errors: [{ code: 'NOT_FOUND' }] }); s.canceled_date = s.charged_through_date ?? '2026-11-16'; return send(res, 200, { subscription: { ...s, plan_variation_id: s.variation ?? varIdFor(s.plan) } }); }
  if (u.pathname === '/v2/cards') return send(res, 200, { cards: (cards[u.searchParams.get('customer_id') ?? ''] ?? []).map((l) => ({ last_4: l, enabled: true })) });
  send(res, 404, { errors: [{ code: 'NOT_FOUND' }] });
}).listen(Number(process.env.SQ_PORT ?? 4110), '127.0.0.1');

// ---------- Anthropic ----------
let aiMode = 'good';
let n = 0;
const byLabel: Record<string, string> = Object.fromEntries(THEME_IDS.map((t) => [THEMES[t].short.toLowerCase(), t]));
function goodAnswer(user: string, k: number): any {
  const level = /Level: Pre-K/.test(user) ? 'pre-k' : 'kindergarten';
  const title = user.match(/This week: (.*?)( \(an extra review week.*\))?\.\n/)?.[1] ?? '';
  const theme = byLabel[user.match(/Theme: ([^.]*)\./)?.[1] ?? ''] ?? 'dinosaurs';
  const base = PLANS[level].weeks.find((w) => w.title === title) ?? PLANS[level].weeks[0];
  const review = /an extra review week/.test(user);
  const pw: any = { index: 2 + k, level, baseWeek: base.n, theme, focus: [], ...(review ? { extraReview: true } : {}) };
  const prof: any = { id: 'c_mockai1', ageYears: 5, skills: {}, interests: [theme], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16T00:00:00Z' };
  const c = templateContentFor(prof, pw);
  const f = weekFacts(prof, pw); const sf = storyFacts(f);
  for (let pick = k; pick < k + 8; pick++) {
    const st = sceneStoryFor(theme as any, level as any, base, pw, pick) ?? c.story;
    let story: any = sf ? { title: st.title, pathId: st.pathId ?? '', scenes: st.scenes, pages: st.pages } : st;
    // Sight words help: add a line on the last page when missing.
    const cand = { ...c, story, wordProblems: c.wordProblems.map((p) => ({ ...p, icon: p.icon ?? '' })), tracingSentence: 'I like to play.' };
    try { validateContent(cand, f, sf); return { ...cand, story: { ...story, title: story.title } }; } catch { /* try next */ }
  }
  return { ...c, tracingSentence: 'I like to play.' };
}
http.createServer(async (req, res) => {
  const b = await body(req);
  const u = new URL(req.url!, 'http://x');
  if (u.pathname === '/__mode') { aiMode = b || 'good'; log({ svc: 'anthropic-mode', mode: aiMode }); return send(res, 200, { aiMode }); }
  if (u.pathname === '/__count') return send(res, 200, { n });
  log({ svc: 'anthropic', method: req.method, url: req.url, headers: req.headers, body: b });
  n++;
  if (aiMode === 'down') return send(res, 529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } });
  if (aiMode === '500') return send(res, 500, 'oops');
  if (aiMode === 'timeout') { await new Promise((r) => setTimeout(r, 60000)); return send(res, 200, {}); }
  if (aiMode === 'hang-close') { req.socket.destroy(); return; }
  if (aiMode === 'garbage') return send(res, 200, { id: 'x', type: 'message', role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Sure! Here is a story about Liam and the dragon {not json' }] });
  if (aiMode === 'html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<html>bad gateway</html>'); }
  if (aiMode === 'refusal') return send(res, 200, { id: 'x', type: 'message', role: 'assistant', stop_reason: 'refusal', content: [] });
  const j = JSON.parse(b);
  const user: string = j.messages[0].content;
  const out = goodAnswer(user, n);
  if (aiMode === 'name') { out.story.pages[0] = 'Liam and Stomp sat on the hill.'; out.tracingSentence = 'Emma likes to play.'; }
  if (aiMode === 'badmath') out.wordProblems = out.wordProblems.map((p: any) => ({ ...p, a: 99, b: 50, answer: 149 }));
  if (aiMode === 'xss') out.story.pages[0] = '<script>alert(1)</script> {{name}} sees Stomp.';
  send(res, 200, { id: 'msg_' + n, type: 'message', role: 'assistant', model: j.model, stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(out) }] });
}).listen(Number(process.env.AI_PORT ?? 4111), '127.0.0.1');
console.log(`qa mocks up on ${process.env.SQ_PORT ?? 4110}/${process.env.AI_PORT ?? 4111}`);
