// Email checks with no network: audience rules, every template against the content guide and email rules, and a
// walk through each welcome automation graph (who gets which email when, and that members and unsubscribes stop it).
//   npx tsx scripts/test-email.mts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { interestFor, isTeacher, segmentsFor, schoolDomain, INTERESTS, welcomeEvent } from '../src/lib/email/audience';
import { allTemplates, UNSUB, MAILING_ADDRESS, SITE_URL, WELCOME_DAYS, LAUNCH } from '../src/lib/email/templates';
import { automationGraph, welcomeTemplateKeys, WELCOME_VARIANTS } from '../src/lib/server/emailAdmin';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0, passes = 0;
const ok = (cond: unknown, msg: string) => { if (cond) passes++; else { fails++; console.log('FAIL', msg); } };
const eq = (a: unknown, b: unknown, msg: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

// ---------- audience ----------
const cases: [string, string][] = [
  ['name-tracing', 'letters'], ['letter-tracing', 'letters'], ['cursive-alphabet-chart', 'letters'], ['sight-words', 'letters'], ['word-family-at', 'letters'], ['word-families', 'letters'], ['bubble-letters', 'letters'], ['alphabet-chart', 'letters'], ['word-tracing', 'letters'],
  ['coloring-pages', 'coloring'], ['name-coloring', 'coloring'],
  ['prek-math', 'math'], ['ten-frames', 'math'], ['more-or-less', 'math'], ['kindergarten-addition', 'math'], ['kindergarten-subtraction', 'math'], ['kindergarten-word-problems', 'math'], ['k-math-sampler', 'math'], ['number-tracing-1-10', 'math'], ['number-tracing', 'math'],
  ['homeschool', 'homeschool'], ['homeschool-prek-weekly', 'homeschool'], ['homeschool-christian', 'homeschool'], ['letter-of-the-week', 'homeschool'],
  ['program-week1', 'program'], ['program-showme', 'program'],
  ['waitlist', 'general'], ['support-page', 'general'], ['other', 'general'], ['import-oct-2026', 'general'], ['download-card', 'general'],
];
for (const [s, want] of cases) eq(interestFor(s), want, `interestFor(${s})`);
for (const d of ['a@austinisd.org', 'b@cfisd.net', 'c@lausd.net', 'd@students.k12.ca.us', 'e@school.edu', 'f@springfieldschools.org', 'g@district12.org', 'h@k12.wa.us']) ok(schoolDomain(d), `school domain ${d}`);
for (const d of ['a@gmail.com', 'b@yahoo.com', 'c@icloud.com', 'd@outlook.com', 'e@hisdomain.com', 'f@paradise.net']) ok(!schoolDomain(d), `not school ${d}`);
ok(isTeacher('x@gmail.com', 'waitlist', 'classroom'), 'classroom role is teacher');
ok(isTeacher('x@gmail.com', 'class-pack'), 'class-pack is teacher');
eq(segmentsFor('x@gmail.com', 'homeschool-prek'), ['prospects'], 'homeschool segments');
eq(segmentsFor('x@gmail.com', 'program-week1'), ['prospects'], 'program segments');
eq(segmentsFor('x@austinisd.org', 'name-tracing'), ['teachers'], 'teacher segments');
eq(segmentsFor('x@gmail.com', 'coloring-pages'), ['prospects'], 'family segments');

// ---------- templates ----------
const BANNED = [/unlock/i, /seamless/i, /elevate/i, /dive in/i, /dive into/i, /deep dive/i, /whether you'?re/i, /in today'?s world/i, /game[- ]changer/i, /it'?s important to note/i,
  /look no further/i, /in this article/i, /without further ado/i, /\bnavigate/i, /\bjourney\b/i, /ultimate guide/i, /click here/i, /hey kids/i, /\bcan you find\b/i];
const pages = (p: string) => {
  const clean = p.replace(/^\//, '').replace(/\/$/, '');
  if (!clean) return fs.existsSync(path.join(root, 'src/pages/index.astro'));
  const dir = path.join(root, 'src/pages', clean);
  if (fs.existsSync(path.join(dir, 'index.astro')) || fs.existsSync(dir + '.astro')) return true;
  // dynamic routes: /coloring-pages/<collection>/
  const parts = clean.split('/');
  const parent = path.join(root, 'src/pages', ...parts.slice(0, -1));
  return fs.existsSync(parent) && fs.readdirSync(parent).some((f) => /^\[.+\](\.astro)?$/.test(f));
};
const all = allTemplates();
eq(Object.keys(all).length, 20, 'template count');
for (const [key, t] of Object.entries(all)) {
  const visible = (t.subject + ' ' + t.preview + ' ' + t.text);
  ok(!/[—–]/.test(visible + t.html), `${key}: no em or en dashes`);
  for (const re of BANNED) ok(!re.test(visible), `${key}: banned ${re}`);
  ok(t.subject.length <= 70, `${key}: subject length ${t.subject.length}`);
  ok(t.preview.length >= 20 && t.preview.length <= 110, `${key}: preview length ${t.preview.length}`);
  ok(t.html.includes(`href="${UNSUB}"`), `${key}: unsubscribe link in html`);
  ok(t.text.includes(UNSUB), `${key}: unsubscribe link in text`);
  ok(t.html.includes(MAILING_ADDRESS) && t.text.includes(MAILING_ADDRESS), `${key}: mailing address`);
  ok(Buffer.byteLength(t.html) < 90_000, `${key}: html under Gmail clip size (${Buffer.byteLength(t.html)})`);
  ok(!/\{\{|\}\}/.test((t.html + t.text).split(UNSUB).join('')), `${key}: no stray template braces`);
  ok(!/\bname\}|\{name|childName|\{\{name/i.test(t.html), `${key}: no child-name placeholder`);
  const buttons = (t.html.match(/border-bottom:3px solid/g) ?? []).length;
  eq(buttons, 1, `${key}: exactly one button`);
  const hrefs = [...t.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  for (const h of hrefs) {
    if (h === UNSUB) continue;
    ok(h.startsWith(SITE_URL + '/'), `${key}: link on tracelings.com ${h}`);
    const u = new URL(h);
    ok(u.searchParams.get('utm_source') === 'email' && u.searchParams.get('utm_medium') && u.searchParams.get('utm_campaign'), `${key}: utm tags on ${h}`);
    ok(pages(u.pathname), `${key}: link target exists ${u.pathname}`);
  }
  if (key.startsWith('welcome-') && key !== 'welcome-teacher') {
    const day = key.split('-')[1];
    ok(hrefs.filter((h) => h !== UNSUB).every((h) => new URL(h).searchParams.get('utm_campaign') === `day${day}` && new URL(h).searchParams.get('utm_medium') === 'welcome'), `${key}: utm_campaign=day${day}`);
  }
  for (const m of t.html.matchAll(/<img [^>]*>/g)) {
    const alt = m[0].match(/alt="([^"]*)"/)?.[1] ?? '';
    ok(alt.length >= 5, `${key}: img alt text`);
    const src = m[0].match(/src="([^"]+)"/)![1];
    ok(src.startsWith(SITE_URL + '/email/'), `${key}: img absolute ${src}`);
    const file = path.join(root, 'public', new URL(src).pathname);
    ok(fs.existsSync(file) && fs.statSync(file).size < 150_000, `${key}: image exists and < 150KB ${src}`);
  }
}
// The offer emails must match /membership/ (price and refund promise).
const membership = fs.readFileSync(path.join(root, 'src/pages/membership.astro'), 'utf8');
ok(/\$14\.99/.test(membership) && /\$99/.test(membership) && /\$8\.25/.test(membership), 'membership prices unchanged');
ok(/first 14 days\? Email us for a full refund/.test(membership), 'membership still states the 14-day refund');
for (const k of ['welcome-14', 'launch-c']) ok(all[k].text.includes('$14.99') && all[k].text.includes('$99') && all[k].text.includes('14 days'), `${k}: price and refund`);
for (const k of Object.keys(all)) if (!['welcome-14', 'launch-c'].includes(k)) ok(!all[k].text.includes('refund'), `${k}: refund only in the offer emails`);
eq(LAUNCH['launch-a-teacher'].segment, 'teachers', 'teacher launch goes to teachers');
for (const k of ['launch-a', 'launch-b', 'launch-c'] as const) eq(LAUNCH[k].segment, 'prospects', `${k} goes to prospects`);

// ---------- automation graphs ----------
const ids = Object.fromEntries(Object.keys(all).map((k) => [k, `tpl-${k}`]));
const daysOf = (d: string) => Number(d.match(/^(\d+) days$/)![1]);
function simulate(v: (typeof WELCOME_VARIANTS)[number], memberFromDay: number | null, unsubFromDay: number | null) {
  const g = automationGraph(v, ids);
  const byKey = new Map(g.steps.map((s: any) => [s.key, s]));
  const out = (k: string, type = 'default') => g.connections.find((c: any) => c.from === k && (c.type ?? 'default') === type)?.to;
  const sent: { day: number; template: string }[] = [];
  let day = 0, key: string | undefined = 'start', status = 'none', guard = 0;
  while (key && guard++ < 200) {
    const s: any = byKey.get(key);
    if (s.type === 'trigger') { key = out(key); continue; }
    if (s.type === 'send_email') { if (!(unsubFromDay !== null && day >= unsubFromDay)) sent.push({ day, template: s.config.template.id }); key = out(key); continue; }
    if (s.type === 'delay') { day += daysOf(s.config.duration); key = out(key); continue; }
    if (s.type === 'condition') {
      const member = memberFromDay !== null && day >= memberFromDay ? 'true' : 'false';
      ok(s.config.field === 'contact.properties.member' && s.config.operator === 'eq', 'condition checks member');
      key = out(key, member === String(s.config.value) ? 'condition_met' : 'condition_not_met'); continue;
    }
    if (s.type === 'contact_update') { status = s.config.properties.welcome_status; key = out(key); continue; }
    throw new Error('unexpected step ' + s.type);
  }
  return { sent, status, graph: g };
}
for (const v of WELCOME_VARIANTS) {
  const { sent, status, graph } = simulate(v, null, null);
  const keys = welcomeTemplateKeys(v);
  eq(sent.map((s) => s.template), keys.map((k) => ids[k]), `${v}: sends every email in order`);
  eq(sent.map((s) => s.day), v === 'teacher' ? [0] : [...WELCOME_DAYS], `${v}: on days 0, 2, 5, 9, 14`);
  eq(status, 'done', `${v}: ends done`);
  eq(graph.steps[0].config.event_name, welcomeEvent(v), `${v}: trigger event`);
  const incoming = new Map<string, number>();
  for (const c of graph.connections) incoming.set(c.to, (incoming.get(c.to) ?? 0) + 1);
  ok([...incoming.values()].every((n) => n === 1), `${v}: no step reached from two places`);
  ok(graph.steps.every((s: any) => s.type !== 'send_email' || (s.config.template.id && s.config.from && s.config.reply_to)), `${v}: send steps have template, from, reply_to`);
  for (const s of graph.steps.filter((x: any) => x.type === 'condition')) {
    const types = graph.connections.filter((c: any) => c.from === s.key).map((c: any) => c.type).sort();
    eq(types, ['condition_met', 'condition_not_met'], `${v}: ${s.key} has both branches`);
  }
  if (v !== 'teacher') {
    const m = simulate(v, 3, null);
    eq(m.sent.map((s) => s.day), [0, 2], `${v}: member on day 3 gets only days 0 and 2`);
    eq(m.status, 'stopped-member', `${v}: member stop recorded`);
    const m0 = simulate(v, 0, null);
    eq(m0.sent.map((s) => s.day), [0], `${v}: member from the start gets only the welcome`);
    const u = simulate(v, null, 6);
    eq(u.sent.map((s) => s.day), [0, 2, 5], `${v}: unsubscribe on day 6 stops later emails`);
  }
}
eq(INTERESTS.length + 1, WELCOME_VARIANTS.length, 'one automation per interest plus teachers');

console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
