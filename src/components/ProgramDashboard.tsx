import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ChildProfile, ChildPlan, CheckIn, FamilyResponse, ProgramWeek, SkillId, WeekResponse } from '../lib/program/types';
import type { Paper } from '../lib/sheet';
import { loadLocalProgram, saveLocalProgram } from '../lib/program/local';
import { buildProgramWeek } from '../lib/program/pages';
import { loadThemeIcons } from '../lib/program/themes';
import { loadFont, type LoadedFont } from '../lib/fontshape';
import { buildProgressReport, SKILL_LABELS } from '../lib/program/report';
import { PLANS } from '../lib/homeschool';
import { savePdf } from '../lib/download';
import { pageToSvg, imagesIn, loadImages } from '../lib/render';
import type { Page } from '../lib/sheet';

// The member's program dashboard. Profiles and plans come from the server (no names); names come from this
// browser's localStorage and are only ever used here, to build the PDF.

const link = 'text-[#2f5fc4] underline underline-offset-2';
const btn = 'rounded-lg border border-rule bg-white px-4 py-2.5 text-[15px] font-bold text-ink disabled:opacity-50';
const PROFILE_KEYS = ['id', 'ageYears', 'skills', 'interests', 'daysPerWeek', 'minutesPerDay', 'faith', 'createdAt'] as const;
const THEME_NAMES: Record<string, string> = { dinosaurs: 'dinosaurs', trucks: 'trucks and cars', unicorns: 'unicorns', ocean: 'ocean animals', space: 'space', farm: 'farm animals', bugs: 'bugs', castles: 'princesses and castles', trains: 'trains', sports: 'sports', pets: 'pets', jungle: 'jungle animals' };
const PAPER_KEY = 'tl-paper';

/** Only the ChildProfile fields, so nothing else (like a name) can ride along to the server. */
const profileOnly = (p: ChildProfile): ChildProfile => Object.fromEntries(PROFILE_KEYS.map((k) => [k, p[k]])) as unknown as ChildProfile;
const same = (a: ChildProfile, b: ChildProfile) => JSON.stringify(profileOnly(a)) === JSON.stringify(profileOnly(b));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function api<T>(path: string, body?: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const r = await fetch(path, body === undefined
      ? { credentials: 'same-origin', cache: 'no-store' }
      : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, data: data as T } : { ok: false, status: r.status, error: (data as any).error ?? 'error' };
  } catch {
    return { ok: false, status: 0, error: 'network' };
  }
}

const weekTitle = (wk: ProgramWeek) => PLANS[wk.level].weeks[wk.baseWeek - 1]?.title ?? `Week ${wk.baseWeek}`;

export default function ProgramDashboard() {
  const [book, setBook] = useState<Page[]>([]);
  const [fam, setFam] = useState<FamilyResponse | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [local, setLocal] = useState<{ children: ChildProfile[]; names: Record<string, string> }>({ children: [], names: {} });
  const [sel, setSel] = useState('');
  const [paper, setPaper] = useState<Paper>('letter');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [redosLeft, setRedosLeft] = useState<Record<string, number>>({});
  const [check, setCheck] = useState<Partial<Record<SkillId, 'got-it' | 'still-working'>>>({});
  const [showAll, setShowAll] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [confirmRemove, setConfirmRemove] = useState('');
  const [font, setFont] = useState<LoadedFont | null>(null);
  const autoSynced = useRef(false);

  async function load() {
    const r = await api<FamilyResponse>('/api/program/family/');
    if (!r.ok) { setLoadErr(r.error); return; }
    setFam(r.data);
    setLoadErr('');
  }

  useEffect(() => {
    setLocal(loadLocalProgram());
    try { const p = localStorage.getItem(PAPER_KEY); if (p === 'a4' || p === 'letter') setPaper(p); } catch { /* storage unavailable */ }
    load();
    // Bubble letters for the coloring pages in the pack (same as the free weekly packs).
    loadFont('bubble').then(setFont).catch(() => setFont(null));
  }, []);
  useEffect(() => { try { localStorage.setItem(PAPER_KEY, paper); } catch { /* ignore */ } }, [paper]);

  // Every child we know about: server profiles first, then profiles only this browser has.
  const kids = useMemo(() => {
    const server = fam?.children ?? [];
    const out = server.map((p) => {
      const l = local.children.find((c) => c.id === p.id);
      return { profile: p, onServer: true, localDiffers: Boolean(l && !same(l, p)), localProfile: l };
    });
    for (const l of local.children) if (!server.some((p) => p.id === l.id)) out.push({ profile: l, onServer: false, localDiffers: false, localProfile: l });
    return out;
  }, [fam, local]);

  useEffect(() => {
    if (!kids.length) return;
    if (!kids.some((k) => k.profile.id === sel)) {
      let want = '';
      try { want = new URLSearchParams(location.search).get('child') ?? ''; } catch { /* ignore */ }
      setSel(kids.find((k) => k.profile.id === want)?.profile.id ?? kids[0].profile.id);
    }
  }, [kids]);
  useEffect(() => { setCheck({}); setMsg(null); setShowAll(false); setNameDraft(''); setBook([]); }, [sel]);

  // Back from the placement check (?sync=1&child=<id>): save that child's new or changed answers to the account,
  // through the same sync() as the buttons below. Only the profile goes, never the name.
  useEffect(() => {
    if (autoSynced.current || !fam || !kids.length) return;
    let want = '';
    try { const q = new URLSearchParams(location.search); if (q.get('sync') === '1') want = q.get('child') ?? ''; } catch { /* ignore */ }
    autoSynced.current = true;
    if (!want) return;
    try { const u = new URL(location.href); u.searchParams.delete('sync'); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch { /* ignore */ }
    const k = kids.find((x) => x.profile.id === want);
    if (!k) return;
    if (!k.onServer && fam.children.length < (fam.limits.maxChildren ?? 4)) sync(k.profile);
    else if (k.onServer && k.localDiffers && k.localProfile) sync(k.localProfile);
  }, [fam, kids]);

  const kid = kids.find((k) => k.profile.id === sel);
  const plan: ChildPlan | undefined = kid && fam?.plans[kid.profile.id];
  const name = kid ? local.names[kid.profile.id] ?? '' : '';
  const week = plan ? plan.weeks[plan.current - 1] : undefined;
  const wkKey = plan ? `${plan.childId}:${plan.current}` : '';
  const left = wkKey in redosLeft ? redosLeft[wkKey] : Math.max(0, (fam?.limits.redosPerWeek ?? 2) - (fam?.redos[wkKey] ?? 0));
  const maxKids = fam?.limits.maxChildren ?? 4;
  const lastCheck: CheckIn | undefined = plan && fam ? fam.checkIns.filter((c) => c.childId === plan.childId && c.weekIndex === plan.current).at(-1) : undefined;

  async function sync(p: ChildProfile) {
    setBusy('sync');
    setMsg(null);
    const r = await api<FamilyResponse>('/api/program/family/', { children: [profileOnly(p)] });
    setBusy('');
    if (r.ok) { setFam(r.data); setMsg({ kind: 'ok', text: 'Saved to your account. The name stays on this device.' }); }
    else setMsg({ kind: 'error', text: r.error === 'too_many_children' ? `Your plan covers up to ${maxKids} kids. Remove one first.` : 'That didn’t save. Please try again in a minute.' });
  }

  function saveName(id: string, n: string) {
    const clean = n.replace(/\s+/g, ' ').trim().slice(0, 24);
    if (!clean) return;
    const next = { ...local, names: { ...local.names, [id]: clean } };
    // Keep the profile locally too, so /program/ shows this child on this device.
    const p = kids.find((k) => k.profile.id === id)?.profile;
    if (p && !next.children.some((c) => c.id === id)) next.children = [...next.children, profileOnly(p)];
    saveLocalProgram(next);
    setLocal(next);
  }

  async function printWeek(wk: ProgramWeek, redo = false) {
    if (!kid || !plan) return;
    setBusy(redo ? 'redo' : `week-${wk.index}`);
    setMsg(null);
    const r = await api<WeekResponse>('/api/program/week/', { childId: kid.profile.id, weekIndex: wk.index, ...(redo ? { redo: true } : {}) });
    if (!r.ok) {
      setBusy('');
      setMsg({ kind: 'error', text: r.error === 'busy' ? 'That week is still being made. Try again in a few seconds.' : r.status === 401 || r.status === 403 ? 'Please sign in again to print member weeks.' : 'We couldn’t get that week just now. Please try again in a minute.' });
      return;
    }
    const k = `${kid.profile.id}:${wk.index}`;
    setRedosLeft((s) => ({ ...s, [k]: r.data.redosLeft }));
    if (!r.data.cached) load();
    try {
      // The theme's pictures must be loaded first, or every picture prints as a plain star.
      await loadThemeIcons([wk.theme]);
      const pages = buildProgramWeek({ name, profile: kid.profile, week: wk, content: r.data.content, paper, credit: false, bubble: font, planLength: plan.weeks.length });
      // The story's scene pictures are loaded before the PDF is made (savePdf also does this, cached).
      await loadImages(imagesIn(pages));
      // Show the picture book sheets on screen too.
      setBook(pages.filter((pg) => pg.items.some((it) => it.kind === 'image')));
      const title = `${PLANS[wk.level].label} at home, week ${wk.index}: ${weekTitle(wk)}`;
      await savePdf(pages, `${name ? `${slug(name)}-` : ''}week-${wk.index}-${slug(weekTitle(wk))}.pdf`, title);
      const notes: Record<string, string> = {
        'redo-limit': 'You’ve used both new stories for this week, so this is the last one made.',
        'not-yet': 'This week prints with our ready-made story for now. Its personal story is made when the plan reaches it.',
        limit: 'This one uses our ready-made themed story. Personal stories pick up again next month.',
        fallback: 'Our story writer is busy, so this week uses a ready-made themed story. Try again later for a personal one.',
      };
      setMsg({ kind: 'ok', text: r.data.note ? notes[r.data.note] : redo ? 'Here’s a new story. Your PDF is downloading.' : 'Your PDF is downloading.' });
    } catch {
      setMsg({ kind: 'error', text: 'The PDF didn’t build. Please try again.' });
    } finally {
      setBusy('');
    }
  }

  async function sendCheckIn(e: Event) {
    e.preventDefault();
    if (!plan || !Object.keys(check).length) return;
    setBusy('checkin');
    setMsg(null);
    const r = await api<{ plan: ChildPlan }>('/api/program/checkin/', { childId: plan.childId, weekIndex: plan.current, results: check });
    setBusy('');
    if (!r.ok) { setMsg({ kind: 'error', text: 'The check-in didn’t save. Please try again.' }); return; }
    const added = r.data.plan.weeks.length > plan.weeks.length;
    await load();
    setCheck({});
    setMsg({ kind: 'ok', text: added ? 'Thanks. We added a review week so these skills get a little more practice.' : 'Thanks. The plan is updated.' });
  }

  async function moveTo(n: number) {
    if (!plan) return;
    setBusy('move');
    const r = await api<FamilyResponse>('/api/program/family/', { current: { [plan.childId]: n } });
    setBusy('');
    if (r.ok) setFam(r.data);
  }

  async function remove(id: string) {
    setBusy('remove');
    const r = await api<FamilyResponse>('/api/program/family/', { remove: [id] });
    setBusy('');
    setConfirmRemove('');
    if (!r.ok) { setMsg({ kind: 'error', text: 'That didn’t work. Please try again in a minute.' }); return; }
    const next = { children: local.children.filter((c) => c.id !== id), names: Object.fromEntries(Object.entries(local.names).filter(([k]) => k !== id)) };
    saveLocalProgram(next);
    setLocal(next);
    setFam(r.data);
  }

  async function printReport() {
    if (!kid || !plan || !fam) return;
    setBusy('report');
    try {
      await savePdf(buildProgressReport({ name, profile: kid.profile, plan, checkIns: fam.checkIns, paper, credit: false }), `${name ? `${slug(name)}-` : ''}progress-report.pdf`, 'Progress report');
    } finally { setBusy(''); }
  }

  const editHref = (id?: string) => `/program/?return=${encodeURIComponent('/account/')}${id ? `&edit=${encodeURIComponent(id)}` : ''}`;
  /** Before editing a child on a device that only has the server copy, keep that profile locally so the placement check can fill it in. */
  function keepLocal(id: string) {
    const p = kids.find((k) => k.profile.id === id)?.profile;
    if (!p || local.children.some((c) => c.id === id)) return;
    const next = { ...local, children: [...local.children, profileOnly(p)].slice(-4) };
    saveLocalProgram(next);
    setLocal(next);
  }

  if (loadErr) {
    return (
      <div class="rounded-xl border border-hairline bg-white p-6">
        <h2 class="text-xl font-bold">Your program</h2>
        <p class="mt-2 text-muted">{loadErr === 'signed_out' || loadErr === 'not_member' ? 'Sign in again to see your kids’ plans.' : 'We couldn’t load your kids’ plans just now.'}</p>
        <button type="button" onClick={load} class={`${btn} mt-4`}>Try again</button>
      </div>
    );
  }
  if (!fam) return <div class="rounded-xl border border-hairline bg-white p-6 text-muted">Loading your program…</div>;

  if (!kids.length) {
    return (
      <div class="rounded-xl border border-hairline bg-white p-6">
        <h2 class="text-xl font-bold">Your program</h2>
        <p class="mt-2 text-muted leading-relaxed">Add your first child with the 5-minute placement check. You’ll get a plan at their level, themed on what they love. Their name stays on this device.</p>
        <a href={editHref()} class="btn-pencil mt-4 inline-block px-5 py-3 text-lg">Add a child</a>
      </div>
    );
  }

  const focus = week?.focus ?? [];
  const timeline = plan ? (showAll ? plan.weeks : plan.weeks.slice(Math.max(0, plan.current - 3), plan.current + 5)) : [];

  return (
    <div class="grid gap-5">
      <div class="rounded-xl border border-hairline bg-white p-5 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <h2 class="text-xl font-bold">Your program</h2>
          <label class="text-[14px] text-muted">Paper{' '}
            <select value={paper} onChange={(e) => setPaper((e.target as HTMLSelectElement).value as Paper)} class="ml-1 rounded-md border border-hairline bg-white px-2 py-1 text-ink">
              <option value="letter">US Letter</option>
              <option value="a4">A4</option>
            </select>
          </label>
        </div>
        <div class="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Choose a child">
          {kids.map((k, i) => (
            <button type="button" role="tab" aria-selected={k.profile.id === sel} onClick={() => setSel(k.profile.id)}
              class={`rounded-full border px-4 py-2 text-[15px] font-bold ${k.profile.id === sel ? 'border-rule bg-[#eef4ff] text-ink' : 'border-hairline text-muted'}`}>
              {local.names[k.profile.id] || `Child ${i + 1}`}{!k.onServer && <span class="ml-1 font-normal">(this device)</span>}
            </button>
          ))}
          {kids.length < maxKids && <a href={editHref()} class="rounded-full border border-dashed border-hairline px-4 py-2 text-[15px] font-bold text-muted">+ Add a child</a>}
        </div>

        {kid && !kid.onServer && (
          <div class="mt-4 rounded-lg bg-[#fff8e6] p-4 text-[15px]">
            <p class="text-ink"><strong>This child is only saved on this device.</strong> Save their profile to your account to get their weekly packs and stories. Only the profile is sent (age, skills, interests and pace), never the name.</p>
            <button type="button" disabled={busy === 'sync' || (fam.children.length >= maxKids)} onClick={() => sync(kid.profile)} class={`${btn} mt-3`}>{busy === 'sync' ? 'Saving…' : 'Save profile to my account'}</button>
            {fam.children.length >= maxKids && <p class="mt-2 text-[14px] text-muted">Your plan covers up to {maxKids} kids.</p>}
          </div>
        )}
        {kid && kid.onServer && kid.localDiffers && kid.localProfile && (
          <div class="mt-4 rounded-lg bg-[#fff8e6] p-4 text-[15px]">
            <p class="text-ink">You changed this child’s answers on this device. Update your account to match? Their plan will be rebuilt from the new answers.</p>
            <button type="button" disabled={busy === 'sync'} onClick={() => sync(kid.localProfile!)} class={`${btn} mt-3`}>{busy === 'sync' ? 'Saving…' : 'Update profile'}</button>
          </div>
        )}
        {kid && kid.onServer && !name && (
          <form class="mt-4 rounded-lg bg-[#f6f8fc] p-4 text-[15px]" onSubmit={(e) => { e.preventDefault(); saveName(kid.profile.id, nameDraft); }}>
            <label class="block"><span class="block font-bold text-ink">Child’s first name on this device</span>
              <span class="block text-[14px] text-muted">Names are saved only in this browser, so type it once on each device. It goes on the pages and in the story.</span>
              <span class="mt-2 flex gap-2">
                <input value={nameDraft} maxLength={24} onInput={(e) => setNameDraft((e.target as HTMLInputElement).value)} class="min-w-0 flex-1 rounded-lg border border-hairline px-3 py-2 text-ink" placeholder="First name" autoComplete="off" />
                <button type="submit" class={btn}>Save</button>
              </span>
            </label>
          </form>
        )}

        {kid && kid.onServer && plan && week && (
          <div class="mt-5">
            <p class="text-[14px] text-muted">{PLANS[plan.level].label} plan, week {plan.current} of {plan.weeks.length}. {kid.profile.daysPerWeek} days a week, about {kid.profile.minutesPerDay} minutes a day. Loves {kid.profile.interests.map((t) => THEME_NAMES[t] ?? t).join(', ')}.</p>
            <div class="mt-3 rounded-xl border border-rule bg-[#f6f8fc] p-4 sm:p-5">
              <p class="text-[13px] font-bold uppercase tracking-wide text-muted">This week</p>
              <p class="mt-1 text-lg font-bold text-ink">{weekTitle(week)}{week.extraReview ? ' (review)' : ''}, with {THEME_NAMES[week.theme] ?? week.theme}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={Boolean(busy)} onClick={() => printWeek(week)} class="btn-pencil px-5 py-3 text-[16px] disabled:opacity-60">{busy === `week-${week.index}` ? 'Making the pack…' : 'Print this week’s pack'}</button>
                <button type="button" disabled={Boolean(busy) || left <= 0} onClick={() => printWeek(week, true)} class={btn}>{busy === 'redo' ? 'Writing a new story…' : `Make a new story (${left} left)`}</button>
              </div>
              <p class="mt-2 text-[13px] text-muted">One PDF: the plan page, the day pages, the story as a picture book to cut, staple and color, word problems and a note for you.</p>
              {book.length > 0 && (
                <details class="mt-3" open>
                  <summary class="cursor-pointer text-[14px] font-bold text-ink">This week’s picture book ({book.length} sheets)</summary>
                  <p class="mt-1 text-[13px] text-muted">Cut each sheet on the dashed line, fold each strip with the pictures outside, stack by page number and staple along the fold.</p>
                  <ul class="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2" aria-label="Picture book sheets">
                    {book.map((pg, i) => <li class="overflow-hidden rounded border border-hairline bg-white" aria-label={`Sheet ${i + 1}`} dangerouslySetInnerHTML={{ __html: pageToSvg(pg) }} />)}
                  </ul>
                </details>
              )}
            </div>
          </div>
        )}
        {msg && <p class={`mt-3 text-[14px] ${msg.kind === 'error' ? 'text-[#b4232c]' : 'text-[#1f7a50]'}`} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</p>}
      </div>

      {kid && kid.onServer && plan && week && (
        <form onSubmit={sendCheckIn} class="rounded-xl border border-hairline bg-white p-5 sm:p-6">
          <h3 class="text-lg font-bold">1-minute check-in</h3>
          <p class="mt-1 text-[15px] text-muted">At the end of the week, tap one for each skill. “Still working” adds a little more practice; it’s normal and common.</p>
          {lastCheck && <p class="mt-2 text-[14px] text-[#1f7a50]">Checked in for this week. You can change it below.</p>}
          <div class="mt-3 grid gap-2">
            {(focus.length ? focus : (['letter-names'] as SkillId[])).map((s) => (
              <fieldset class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hairline px-3 py-2">
                <legend class="sr-only">{SKILL_LABELS[s]}</legend>
                <span class="text-[15px] text-ink">{SKILL_LABELS[s]}</span>
                <span class="flex gap-2">
                  {(['got-it', 'still-working'] as const).map((v) => {
                    const on = (check[s] ?? lastCheck?.results[s]) === v;
                    return (
                      <label class={`cursor-pointer rounded-full border px-3 py-1.5 text-[14px] font-bold ${on ? (v === 'got-it' ? 'border-[#1f7a50] bg-[#eef8f2] text-[#1f7a50]' : 'border-[#7a5a00] bg-[#fff4d6] text-[#7a5a00]') : 'border-hairline text-muted'}`}>
                        <input type="radio" class="sr-only" name={`ck-${s}`} checked={on} onChange={() => setCheck((c) => ({ ...c, [s]: v }))} />
                        {v === 'got-it' ? 'Got it' : 'Still working'}
                      </label>
                    );
                  })}
                </span>
              </fieldset>
            ))}
          </div>
          <button type="submit" disabled={busy === 'checkin' || !Object.keys(check).length} class={`${btn} mt-4`}>{busy === 'checkin' ? 'Saving…' : 'Save check-in'}</button>
        </form>
      )}

      {kid && kid.onServer && plan && (
        <div class="rounded-xl border border-hairline bg-white p-5 sm:p-6">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h3 class="text-lg font-bold">The plan</h3>
            <button type="button" onClick={() => setShowAll(!showAll)} class={`${link} text-[14px]`}>{showAll ? 'Show fewer weeks' : `Show all ${plan.weeks.length} weeks`}</button>
          </div>
          <ol class="mt-3 divide-y divide-hairline">
            {timeline.map((wk) => (
              <li class="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span class="min-w-0 text-[15px]">
                  <span class={`font-bold ${wk.index === plan.current ? 'text-ink' : 'text-muted'}`}>Week {wk.index}</span>{' '}
                  <span class="text-ink">{weekTitle(wk)}</span>
                  {wk.extraReview && <span class="ml-1 rounded-full bg-[#fff4d6] px-2 py-0.5 text-[12px] font-bold text-[#7a5a00]">review</span>}
                  {wk.index === plan.current && <span class="ml-1 rounded-full bg-[#eef4ff] px-2 py-0.5 text-[12px] font-bold text-ink">now</span>}
                  <span class="block text-[13px] text-muted">{THEME_NAMES[wk.theme] ?? wk.theme}</span>
                </span>
                <span class="flex gap-3 text-[14px]">
                  {wk.index !== plan.current && <button type="button" disabled={Boolean(busy)} onClick={() => moveTo(wk.index)} class={link}>Make current</button>}
                  <button type="button" disabled={Boolean(busy)} onClick={() => printWeek(wk)} class={link}>{busy === `week-${wk.index}` ? 'Making…' : 'Print'}</button>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {kid && kid.onServer && plan && (
        <div class="rounded-xl border border-hairline bg-white p-5 sm:p-6 text-[15px]">
          <h3 class="text-lg font-bold">Progress and profile</h3>
          <p class="mt-1 text-muted">A one-page report of skills and weeks covered, handy for homeschool records.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy === 'report'} onClick={printReport} class={btn}>{busy === 'report' ? 'Making…' : 'Print progress report'}</button>
            <a href={editHref(kid.profile.id)} onClick={() => keepLocal(kid.profile.id)} class={`${btn} inline-block`}>Edit answers or interests</a>
          </div>
          {confirmRemove === kid.profile.id ? (
            <div class="mt-4 rounded-lg bg-[#fff4f4] p-4">
              <p class="text-ink">Remove this child from your account? Their profile, plan, check-ins and saved stories are deleted. This can’t be undone.</p>
              <div class="mt-3 flex flex-wrap gap-3">
                <button type="button" disabled={busy === 'remove'} onClick={() => remove(kid.profile.id)} class="rounded-lg border border-[#b4232c] px-4 py-2 font-bold text-[#b4232c] disabled:opacity-60">{busy === 'remove' ? 'Removing…' : 'Yes, remove'}</button>
                <button type="button" onClick={() => setConfirmRemove('')} class="rounded-lg border border-hairline px-4 py-2 font-bold text-ink">Keep</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmRemove(kid.profile.id)} class="mt-4 text-[14px] text-[#b4232c] underline underline-offset-2">Remove this child</button>
          )}
        </div>
      )}
    </div>
  );
}
