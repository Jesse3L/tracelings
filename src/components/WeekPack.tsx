import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Page, Paper } from '../lib/sheet';
import { pageToSvg } from '../lib/render';
import { savePdf } from '../lib/download';
import { needsEmail, subscribe, markEmailOk } from '../lib/gate';
import { useMember } from '../lib/member';
import { useRoster } from '../lib/roster';
import { loadFont, type LoadedFont } from '../lib/fontshape';
import { PLANS, buildWeekPack, type Level } from '../lib/homeschool';
import { Segmented } from './Tracer';
import EmailGate from './EmailGate';

const link = 'text-[#2f5fc4] underline underline-offset-2';
const FAITH_KEY = 'tl-faith-track';

/**
 * A personalized weekly homeschool pack: a plan page for the grown-up, then one printable for each day.
 * Free for one child, one week at a time. Members can print every child on their saved list, or four weeks at once.
 */
export default function WeekPack(props: { level?: Level; week?: number; fixedLevel?: boolean; source?: string; heading?: string; faith?: boolean }) {
  const [level, setLevel] = useState<Level>(props.level ?? 'pre-k');
  const [weekN, setWeekN] = useState(props.week ?? 1);
  const [name, setName] = useState('');
  const [paper, setPaper] = useState<Paper>('letter');
  const [font, setFont] = useState<LoadedFont | null>(null);
  const [faith, setFaith] = useState(props.faith ?? false);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState<null | 'week' | 'list' | 'month'>(null);
  const [done, setDone] = useState('');
  const member = useMember();
  const [roster] = useRoster();
  const credit = !member.member;
  const plan = PLANS[level];
  const week = plan.weeks[Math.min(plan.weeks.length, Math.max(1, weekN)) - 1];
  const source = props.source ?? 'homeschool';

  useEffect(() => {
    loadFont('bubble').then(setFont).catch(() => setFont(null));
    try {
      const q = new URLSearchParams(location.search);
      const w = Number(q.get('week'));
      if (w >= 1 && w <= 36) setWeekN(w);
      const lv = q.get('level');
      if (!props.fixedLevel && (lv === 'pre-k' || lv === 'kindergarten')) setLevel(lv);
      const n = sessionStorage.getItem('tl-name');
      if (n) setName(n);
      const f = localStorage.getItem(FAITH_KEY);
      if (props.faith === undefined && (f === '1' || f === '0')) setFaith(f === '1');
    } catch { /* storage or URL unavailable */ }
  }, []);
  // Keep the typed name for the other tools in this tab (never in the URL, never sent anywhere).
  useEffect(() => { try { if (name) sessionStorage.setItem('tl-name', name); } catch { /* ignore */ } }, [name]);

  const pages = useMemo(() => buildWeekPack({ level, week, name, paper, credit, bubble: font, faith }), [level, week, name, paper, credit, font, faith]);
  useEffect(() => { setShown(0); setDone(''); }, [level, weekN]);
  const svgs = useMemo(() => pages.map(pageToSvg), [pages]);
  const listNames = member.member ? roster.slice(0, member.maxNames ?? 8) : [];
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  async function save(kind: 'week' | 'list' | 'month') {
    setBusy(true);
    try {
      if (kind === 'list') {
        const all: Page[] = listNames.flatMap((n) => buildWeekPack({ level, week, name: n, paper, credit, bubble: font, faith }));
        await savePdf(all, `${slug(plan.label)}-week-${week.n}-${listNames.length}-kids.pdf`, `${plan.label} at home, week ${week.n}`);
        setDone(`Downloaded week ${week.n} for ${listNames.length} kids.`);
      } else if (kind === 'month') {
        const weeks = plan.weeks.slice(week.n - 1, week.n + 3);
        const all: Page[] = weeks.flatMap((w) => buildWeekPack({ level, week: w, name, paper, credit, bubble: font, faith }));
        await savePdf(all, `${slug(plan.label)}-weeks-${weeks[0].n}-to-${weeks[weeks.length - 1].n}.pdf`, `${plan.label} at home, weeks ${weeks[0].n} to ${weeks[weeks.length - 1].n}`);
        setDone(`Downloaded weeks ${weeks[0].n} to ${weeks[weeks.length - 1].n}.`);
      } else {
        const who = slug(name);
        await savePdf(pages, `${who ? `${who}-` : ''}${slug(plan.label)}-week-${week.n}-${slug(week.title)}.pdf`, `${plan.label} at home, week ${week.n}: ${week.title}`);
        setDone(`Downloaded week ${week.n}. Print at 100% size, then start with the plan page.`);
      }
    } finally {
      setBusy(false);
    }
  }
  const ask = (kind: 'week' | 'list' | 'month') => (!member.member && needsEmail() ? setGate(kind) : save(kind));

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); ask('week'); }}>
        {props.heading && <p class="mb-4 text-[17px] font-bold text-ink">{props.heading}</p>}
        <label class="block mb-5">
          <span class="block text-[15px] font-bold mb-2">Child's first name <span class="font-normal text-muted">(optional)</span></span>
          <input
            id="pack-name"
            type="text"
            value={name}
            maxLength={24}
            autoComplete="off"
            spellcheck={false}
            placeholder="Type a name"
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-2xl text-ink placeholder:text-[#a3acbf] focus:border-rule focus:outline-none"
          />
          <span class="block text-[13px] text-muted mt-2">Their name goes on the plan, the tracing page and the coloring page. It stays on this device.</span>
        </label>

        {!props.fixedLevel && (
          <Segmented legend="Level" name="pack-level" value={level} onChange={(v) => setLevel(v)} options={[
            { v: 'pre-k', label: 'Pre-K', sub: PLANS['pre-k'].ages },
            { v: 'kindergarten', label: 'Kindergarten', sub: PLANS.kindergarten.ages },
          ]} />
        )}

        <label class="block mb-5">
          <span class="block text-[15px] font-bold mb-2">Week</span>
          <select
            id="pack-week"
            value={String(week.n)}
            onChange={(e) => setWeekN(Number((e.target as HTMLSelectElement).value))}
            class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-lg text-ink focus:border-rule focus:outline-none"
          >
            {plan.weeks.map((w) => <option value={String(w.n)}>Week {w.n}: {w.title}</option>)}
          </select>
        </label>

        <label class="mb-5 flex items-start gap-3 cursor-pointer rounded-lg border border-hairline bg-white px-3 py-3 text-[15px]">
          <input id="pack-faith" type="checkbox" class="mt-1 size-4 accent-[#5b86d9]" checked={faith} onChange={(e) => {
            const on = (e.target as HTMLInputElement).checked;
            setFaith(on);
            try { localStorage.setItem(FAITH_KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
          }} />
          <span><span class="font-bold text-ink">Faith track</span> <span class="text-muted">(optional)</span><span class="block text-[13px] text-muted">Adds a Bible verse of the week (BSB) to the plan and a verse copywork page.</span></span>
        </label>

        <Segmented legend="Paper" name="pack-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />

        <button type="submit" disabled={busy} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {busy ? 'Making your PDF…' : `Download week ${week.n} (${pages.length} pages)`}
        </button>
        {!font && <p class="mt-2 text-[13px] text-muted">Loading the coloring page letters…</p>}
        {done && <p class="mt-4 text-[14px] text-[#1f7a50]" role="status">{done}</p>}

        <div class="mt-5 rounded-lg border border-dashed border-rule/60 bg-white/70 p-4 text-[14px] leading-snug text-muted">
          {member.member ? (
            <>
              <p class="font-bold text-ink">Member printing</p>
              <div class="mt-3 grid gap-2">
                <button type="button" disabled={busy || listNames.length === 0} onClick={() => save('list')} class="rounded-lg border border-rule bg-white px-4 py-2.5 text-left text-[15px] font-bold text-ink disabled:opacity-50">
                  {listNames.length ? `Week ${week.n} for all ${listNames.length} kids` : 'Week for every kid on your list'}
                </button>
                <button type="button" disabled={busy || week.n > plan.weeks.length - 1} onClick={() => save('month')} class="rounded-lg border border-rule bg-white px-4 py-2.5 text-left text-[15px] font-bold text-ink disabled:opacity-50">
                  Weeks {week.n} to {Math.min(plan.weeks.length, week.n + 3)} in one PDF
                </button>
              </div>
              {listNames.length === 0 && <p class="mt-2">Save your kids' names once in <a class={link} href="/name-tracing/">name tracing</a> and they show up here.</p>}
            </>
          ) : (
            <>
              <span class="font-bold text-ink">Teaching more than one child?</span> Members print this week for every kid at once, or a whole month of weeks in one PDF, with no footer line.{' '}
              <a href="/membership/" class={link}>See membership</a>
            </>
          )}
        </div>
      </form>

      <figure class="lg:sticky lg:top-20">
        <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svgs[shown] ?? svgs[0] }} />
        <figcaption class="mt-3 text-[13px] text-muted">Page {shown + 1} of {pages.length}. Tap a page below to preview it.</figcaption>
        <ul class="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2" aria-label="Pages in this week's pack">
          {svgs.map((s, i) => (
            <li>
              <button
                type="button"
                onClick={() => setShown(i)}
                aria-label={`Preview page ${i + 1}`}
                aria-current={i === shown ? 'true' : undefined}
                class={`block w-full overflow-hidden rounded border bg-white ${i === shown ? 'border-rule shadow-[0_0_0_2px_var(--color-rule)]' : 'border-hairline'}`}
                dangerouslySetInnerHTML={{ __html: s }}
              />
            </li>
          ))}
        </ul>
      </figure>

      <EmailGate open={gate !== null} source={source} onClose={() => setGate(null)} onDone={() => { const k = gate ?? 'week'; setGate(null); save(k); }} />
    </div>
  );
}

/** "Send me next week's plan": a small sign-up for the weekly homeschool email. */
export function WeeklyEmail(props: { level?: Level }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error' | 'down'>('idle');
  async function submit(e: Event) {
    e.preventDefault();
    setState('sending');
    const r = await subscribe(email, props.level === 'kindergarten' ? 'homeschool-k-weekly' : 'homeschool-prek-weekly', 'homeschool');
    if (r === 'invalid') return setState('error');
    if (r === 'unavailable') return setState('down');
    markEmailOk();
    setState('done');
  }
  if (state === 'done') {
    return (
      <div class="rounded-xl border border-[#9fd3b8] bg-[#eef8f2] p-6" role="status">
        <p class="font-bold text-lg text-ink">You're in.</p>
        <p class="mt-2 text-muted leading-relaxed">Each week we'll send a short email with that week's plan and a link that opens the pack, ready for your child's name.</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} class="rounded-xl border border-hairline bg-white p-6">
      <p class="text-xl font-bold text-ink">Get each week's plan by email</p>
      <p class="mt-2 text-muted leading-relaxed">One short email a week with the plan and a link to that week's pack. Free, and you can stop anytime.</p>
      <label class="block mt-4">
        <span class="sr-only">Your email</span>
        <input id="weekly-email" type="email" required autoComplete="email" value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          class="w-full rounded-lg border border-hairline px-4 py-3 text-lg focus:border-rule focus:outline-none" placeholder="you@example.com" />
      </label>
      {state === 'error' && <p class="mt-3 text-[14px] text-[#b4232c]" role="alert">That email doesn't look quite right. Mind checking it?</p>}
      {state === 'down' && <p class="mt-3 text-[14px] text-[#b4232c]" role="alert">We couldn't save your email just now. Please try again in a minute.</p>}
      <button type="submit" disabled={state === 'sending'} class="btn-pencil mt-4 w-full px-5 py-3 text-lg disabled:opacity-60">
        {state === 'sending' ? 'Signing up…' : 'Send me the weekly plan'}
      </button>
      <p class="mt-3 text-[13px] text-muted">We only ask for your email. Never your child's name.</p>
    </form>
  );
}
