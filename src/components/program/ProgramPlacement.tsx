import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Paper, Page } from '../../lib/sheet';
import { pageToSvg } from '../../lib/render';
import { savePdf } from '../../lib/download';
import { needsEmail } from '../../lib/gate';
import { useMember } from '../../lib/member';
import { loadFont, type LoadedFont } from '../../lib/fontshape';
import type { ChildProfile, SkillId, SkillState, ThemeId } from '../../lib/program/types';
import { THEMES, THEME_IDS, coverUrl, loadThemeIcons } from '../../lib/program/themes';
import { placeChild, weekTitle, SKILL_LABELS } from '../../lib/program/engine';
import { templateContentFor, weekBlurb } from '../../lib/program/templates';
import { buildProgramWeek, showMePage } from '../../lib/program/pages';
import { loadLocalProgram, upsertLocalChild, newChildId } from '../../lib/program/local';
import { Segmented } from '../Tracer';
import EmailGate from '../EmailGate';

const link = 'text-[#2f5fc4] underline underline-offset-2';
const AGES = [3, 4, 5, 6, 7] as const;

/** Parent-friendly skills checklist, grouped. Every skill gets "Not yet", "Learning", "Got it". */
const GROUPS: { title: string; skills: SkillId[] }[] = [
  { title: 'Letters and reading', skills: ['name-writing', 'letter-names', 'letter-sounds', 'blending', 'word-families', 'sight-words'] },
  { title: 'Numbers and math', skills: ['count-10', 'count-20', 'numerals', 'compare', 'add-5', 'add-10'] },
];
const STATE_OPTS: { v: SkillState; label: string }[] = [
  { v: 'not-yet', label: 'Not yet' },
  { v: 'learning', label: 'Learning' },
  { v: 'got-it', label: 'Got it' },
];

type Step = 'about' | 'skills' | 'interests' | 'pace' | 'plan';
const STEPS: { id: Step; label: string }[] = [
  { id: 'about', label: 'Your child' },
  { id: 'skills', label: 'What they can do' },
  { id: 'interests', label: 'What they love' },
  { id: 'pace', label: 'Your week' },
  { id: 'plan', label: 'Their plan' },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * The placement check for Tracelings at Home, Personalized: age, skills, interests and pace, then the child's
 * 36-week plan with week 1 free to print. Everything happens in the browser. The name stays on this device.
 */
export default function ProgramPlacement() {
  const [step, setStep] = useState<Step>('about');
  const [name, setName] = useState('');
  const [age, setAge] = useState<ChildProfile['ageYears'] | null>(null);
  const [skills, setSkills] = useState<Partial<Record<SkillId, SkillState>>>({});
  const [interests, setInterests] = useState<ThemeId[]>([]);
  const [days, setDays] = useState<ChildProfile['daysPerWeek']>(5);
  const [minutes, setMinutes] = useState<ChildProfile['minutesPerDay']>(15);
  const [faith, setFaith] = useState(false);
  const [paper, setPaper] = useState<Paper>('letter');
  const [id, setId] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [font, setFont] = useState<LoadedFont | null>(null);
  const [iconsOk, setIconsOk] = useState(0);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState<null | 'week' | 'showme'>(null);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const member = useMember();
  const top = useRef<HTMLDivElement>(null);

  // ?return=/account/ (members adding a child) and &edit=<childId> (members changing one child) come from the dashboard.
  const [returnTo, setReturnTo] = useState('');
  const [editing, setEditing] = useState(false);

  // Restore the child being edited, or the last child from this device. "Add a child" starts fresh.
  useEffect(() => {
    const saved = loadLocalProgram();
    let q: URLSearchParams | null = null;
    try { q = new URLSearchParams(location.search); } catch { /* ignore */ }
    const ret = safeReturn(q?.get('return'));
    const editId = q?.get('edit') ?? '';
    setReturnTo(ret);
    const c = editId ? saved.children.find((x) => x.id === editId) : ret ? undefined : saved.children[saved.children.length - 1];
    if (c) setEditing(Boolean(editId));
    if (c) {
      setId(c.id); setCreatedAt(c.createdAt); setAge(c.ageYears); setSkills(c.skills); setInterests(c.interests);
      setDays(c.daysPerWeek); setMinutes(c.minutesPerDay); setFaith(c.faith); setName(saved.names[c.id] ?? '');
    } else {
      setId(newChildId());
      setCreatedAt(new Date().toISOString());
    }
    loadThemeIcons(THEME_IDS.slice(0, 1)).then(() => setIconsOk((n) => n + 1));
  }, []);

  const profile: ChildProfile | null = age && interests.length && id ? {
    id, ageYears: age, skills, interests, daysPerWeek: days, minutesPerDay: minutes, faith, createdAt,
  } : null;
  const plan = useMemo(() => (profile ? placeChild(profile) : null), [JSON.stringify(profile)]);

  // Load what the plan needs: the theme pictures and the bubble letters for the coloring pages.
  useEffect(() => {
    if (step !== 'plan' || !profile) return;
    loadThemeIcons(profile.interests).then(() => setIconsOk((n) => n + 1));
    if (!font) loadFont('bubble').then(setFont).catch(() => setFont(null));
  }, [step, profile?.interests.join(',')]);

  const week1 = plan?.weeks[0];
  const pages = useMemo<Page[]>(() => {
    if (!profile || !plan || !week1 || step !== 'plan') return [];
    const content = templateContentFor(profile, week1);
    return buildProgramWeek({ name, profile, week: week1, content, paper, credit: !member.member, bubble: font, planLength: plan.weeks.length });
  }, [JSON.stringify(profile), plan, name, paper, font, iconsOk, member.member, step]);
  const svgs = useMemo(() => pages.map(pageToSvg), [pages]);
  useEffect(() => { setShown(0); }, [JSON.stringify(profile)]);

  function persist() {
    if (profile) upsertLocalChild(profile, name);
  }
  function go(s: Step) {
    setError('');
    if (s !== 'about' && !age) { setStep('about'); setError('Pick your child\'s age to keep going.'); return; }
    if ((s === 'pace' || s === 'plan') && !interests.length) { setStep('interests'); setError('Pick at least one thing your child loves.'); return; }
    setStep(s);
    persist();
    try { (window as any).gtag?.('event', 'program_step', { step: s }); } catch { /* analytics optional */ }
    requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  useEffect(() => { if (step === 'plan') persist(); }, [step, name]);

  async function save(kind: 'week' | 'showme') {
    setBusy(true);
    try {
      if (kind === 'showme') {
        await loadThemeIcons([interests[0] ?? 'dinosaurs']);
        await savePdf([showMePage(paper, interests[0] ?? 'dinosaurs')], 'tracelings-placement-check.pdf', 'Tracelings placement check');
        setDone('Downloaded the placement check. Tick what your child gets right, then come back to answer the questions.');
      } else if (week1 && plan) {
        const who = slug(name);
        await savePdf(pages, `${who ? `${who}-` : ''}tracelings-week-1-${slug(THEMES[week1.theme].label)}.pdf`, `Tracelings at Home, personalized: week 1`);
        setDone('Downloaded week 1. Print at 100% size, start with the plan page, and cut out the little book together.');
      }
    } finally {
      setBusy(false);
    }
  }
  const ask = (kind: 'week' | 'showme') => (!member.member && needsEmail() ? setGate(kind) : save(kind));

  /** Members: save on this device, then go back to the account page, which saves the profile (never the name). */
  function finish() {
    persist();
    const dest = returnTo || '/account/';
    const u = new URL(dest, location.origin);
    u.searchParams.set('sync', '1');
    u.searchParams.set('child', id);
    location.href = u.pathname + u.search;
  }
  const isMember = member.member;

  const toggleInterest = (t: ThemeId) => setInterests((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length >= 3 ? [...cur.slice(1), t] : [...cur, t]));
  const stepIdx = STEPS.findIndex((s) => s.id === step);
  const who = name.trim() || 'your child';
  const Who = name.trim() || 'Your child';

  const nav = (back: Step | null, next: Step, label: string) => (
    <div class="mt-6 flex flex-wrap items-center gap-3">
      <button type="button" class="btn-pencil px-6 py-3 text-lg" onClick={() => go(next)}>{label}</button>
      {back && <button type="button" class="px-3 py-2 text-[15px] text-muted underline underline-offset-2" onClick={() => go(back)}>Back</button>}
    </div>
  );

  return (
    <div ref={top} class="scroll-mt-24">
      <ol class="mb-6 flex flex-wrap gap-x-1 gap-y-2 text-[13px]" aria-label="Placement check steps">
        {STEPS.map((s, i) => (
          <li class="flex items-center gap-1">
            <button type="button" onClick={() => (i <= stepIdx || (s.id !== 'plan' && age) ? go(s.id) : undefined)} aria-current={s.id === step ? 'step' : undefined}
              class={`rounded-full px-3 py-1.5 font-bold ${s.id === step ? 'bg-ink text-white' : i < stepIdx ? 'bg-[#e4ecf9] text-ink' : 'bg-white text-muted border border-hairline'}`}>
              <span class="mr-1 opacity-70">{i + 1}</span>{s.label}
            </button>
          </li>
        ))}
      </ol>
      {error && <p class="mb-4 rounded-lg bg-[#fdeeee] px-4 py-3 text-[15px] text-[#9c2a2a]" role="alert">{error}</p>}

      {step === 'about' && (
        <section class="rounded-xl border border-hairline bg-white p-5 sm:p-7" aria-labelledby="pc-about">
          <h2 id="pc-about" class="text-[1.5rem] font-bold text-ink">{editing ? 'Change your answers' : 'Tell us about your child'}</h2>
          <p class="mt-1 text-muted">It takes about 5 minutes. You can change any answer later.</p>
          <label class="mt-6 block max-w-md">
            <span class="block text-[15px] font-bold mb-2">First name <span class="font-normal text-muted">(optional)</span></span>
            <input id="pc-name" type="text" value={name} maxLength={24} autoComplete="off" spellcheck={false} placeholder="Type a name"
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-2xl text-ink placeholder:text-[#a3acbf] focus:border-rule focus:outline-none" />
            <span class="mt-2 block text-[13px] text-muted">It goes on the pages and in the story. It stays on this device and is never sent to us.</span>
          </label>
          <fieldset class="mt-6">
            <legend class="text-[15px] font-bold mb-2">How old is {who}?</legend>
            <div class="grid grid-cols-5 gap-2 max-w-md">
              {AGES.map((a) => (
                <label class={`cursor-pointer rounded-lg border px-2 py-3 text-center text-lg font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-rule ${age === a ? 'border-rule bg-[#eef2f8] text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]' : 'border-hairline bg-white text-muted hover:text-ink'}`}>
                  <input type="radio" name="pc-age" class="sr-only" checked={age === a} onChange={() => setAge(a)} />
                  {a}{a === 7 ? '+' : ''}
                </label>
              ))}
            </div>
          </fieldset>
          {nav(null, 'skills', 'Next: what they can do')}
        </section>
      )}

      {step === 'skills' && (
        <section class="rounded-xl border border-hairline bg-white p-5 sm:p-7" aria-labelledby="pc-skills">
          <h2 id="pc-skills" class="text-[1.5rem] font-bold text-ink">What can {who} do today?</h2>
          <p class="mt-1 text-muted leading-relaxed">Go with your gut. "Learning" means sometimes, with help. If you're not sure, leave it on "Not yet" and the plan will start a little easier.</p>
          <p class="mt-2 text-[14px] text-muted">
            Want to check?{' '}
            <button type="button" class={link} onClick={() => ask('showme')} disabled={busy}>Print a one-page "show me" check</button>{' '}
            for {who} to try, then tick what they got right.
          </p>
          {done && step === 'skills' && <p class="mt-2 text-[14px] text-[#1f7a50]" role="status">{done}</p>}
          {GROUPS.map((g) => (
            <div class="mt-6">
              <h3 class="text-[13px] font-bold uppercase tracking-wider text-muted">{g.title}</h3>
              <ul class="mt-2 divide-y divide-hairline border-y border-hairline">
                {g.skills.map((s) => {
                  const cur = skills[s] ?? 'not-yet';
                  return (
                    <li class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span class="text-[15px] text-ink sm:pr-4">{SKILL_LABELS[s].parent}</span>
                      <span class="grid grid-cols-3 gap-1 shrink-0 sm:w-[300px]" role="radiogroup" aria-label={SKILL_LABELS[s].label}>
                        {STATE_OPTS.map((o) => (
                          <label class={`cursor-pointer rounded-md border px-2 py-1.5 text-center text-[14px] font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-rule ${cur === o.v ? (o.v === 'got-it' ? 'border-[#2f9e6b] bg-[#eaf7f0] text-[#1f6e4a]' : o.v === 'learning' ? 'border-[#d9a52f] bg-[#fdf6e3] text-[#7a5a12]' : 'border-rule bg-[#eef2f8] text-ink') : 'border-hairline bg-white text-muted hover:text-ink'}`}>
                            <input type="radio" class="sr-only" name={`pc-${s}`} checked={cur === o.v} onChange={() => setSkills((k) => ({ ...k, [s]: o.v }))} />
                            {o.label}
                          </label>
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <p class="mt-4 text-[13px] text-muted">Kids learn these at very different ages, and that's normal. If you have concerns, ask your child's teacher or pediatrician.</p>
          {nav('about', 'interests', 'Next: what they love')}
        </section>
      )}

      {step === 'interests' && (
        <section class="rounded-xl border border-hairline bg-white p-5 sm:p-7" aria-labelledby="pc-int">
          <h2 id="pc-int" class="text-[1.5rem] font-bold text-ink">What does {who} love?</h2>
          <p class="mt-1 text-muted">Pick up to 3. Each week leans on one of them: the pictures they count, the story, the word problems.</p>
          <ul class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {THEME_IDS.map((t) => {
              const on = interests.includes(t);
              const n = interests.indexOf(t) + 1;
              return (
                <li>
                  <button type="button" aria-pressed={on} onClick={() => toggleInterest(t)}
                    class={`relative flex w-full flex-col items-center rounded-xl border bg-white px-2 pb-3 pt-4 text-center transition-colors ${on ? 'border-rule shadow-[0_0_0_2px_var(--color-rule)]' : 'border-hairline hover:border-rule'}`}>
                    {on && <span class="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-rule text-[13px] font-bold text-white" aria-hidden="true">{n}</span>}
                    <img src={coverUrl(t)} alt="" width={96} height={96} loading="lazy" class="size-20 sm:size-24" />
                    <span class="mt-2 text-[15px] font-bold leading-tight text-ink">{THEMES[t].label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p class="mt-3 text-[14px] text-muted" aria-live="polite">{interests.length ? `Picked: ${interests.map((t) => THEMES[t].label).join(', ')}.` : 'Nothing picked yet.'}</p>
          {nav('skills', 'pace', 'Next: your week')}
        </section>
      )}

      {step === 'pace' && (
        <section class="rounded-xl border border-hairline bg-white p-5 sm:p-7" aria-labelledby="pc-pace">
          <h2 id="pc-pace" class="text-[1.5rem] font-bold text-ink">What does a week look like for you?</h2>
          <p class="mt-1 mb-6 text-muted">The plan stays in the same order. This only changes how the pages are spread across your days.</p>
          <div class="max-w-xl">
            <Segmented legend="Days a week" name="pc-days" value={String(days) as '3' | '4' | '5'} onChange={(v) => setDays(Number(v) as 3 | 4 | 5)} options={[
              { v: '3', label: '3 days' }, { v: '4', label: '4 days' }, { v: '5', label: '5 days' },
            ]} />
            <Segmented legend="Minutes a day" name="pc-min" value={String(minutes) as '10' | '15' | '20' | '30'} onChange={(v) => setMinutes(Number(v) as 10 | 15 | 20 | 30)} options={[
              { v: '10', label: '10' }, { v: '15', label: '15' }, { v: '20', label: '20' }, { v: '30', label: '30' },
            ]} />
            <label class="mb-5 flex items-start gap-3 cursor-pointer rounded-lg border border-hairline bg-white px-3 py-3 text-[15px]">
              <input id="pc-faith" type="checkbox" class="mt-1 size-4 accent-[#5b86d9]" checked={faith} onChange={(e) => setFaith((e.target as HTMLInputElement).checked)} />
              <span><span class="font-bold text-ink">Faith track</span> <span class="text-muted">(optional)</span><span class="block text-[13px] text-muted">Adds a Bible verse each week (Berean Standard Bible) to the plan page, with a verse copywork page.</span></span>
            </label>
          </div>
          {nav('interests', 'plan', `See ${name.trim() ? `${name.trim()}'s` : 'the'} plan`)}
        </section>
      )}

      {step === 'plan' && plan && profile && week1 && (
        <section aria-labelledby="pc-plan">
          <div class="rounded-xl border border-hairline bg-white p-5 sm:p-7">
            <p class="text-[13px] font-bold uppercase tracking-wider text-muted">{plan.level === 'pre-k' ? 'Pre-K track' : 'Kindergarten track'}, {plan.weeks.length} weeks</p>
            <h2 id="pc-plan" class="mt-1 text-[1.6rem] sm:text-[1.9rem] font-bold text-ink">{name.trim() ? `${name.trim()}'s plan` : 'Your child\'s plan'} is ready</h2>
            <p class="mt-2 max-w-2xl text-muted leading-relaxed">{planSummary(profile, plan.level, plan.weeks.length, plan.weeks.filter((w) => w.extraReview).length, Who)}</p>
            <div class="mt-4 flex flex-wrap gap-2">
              {profile.interests.map((t) => (
                <span class="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-[#f6f8fb] py-1 pl-1 pr-3 text-[14px] font-bold text-ink">
                  <img src={coverUrl(t)} alt="" width={28} height={28} class="size-7 rounded-full bg-white" />{THEMES[t].label}
                </span>
              ))}
              <button type="button" class="px-2 text-[14px] text-muted underline underline-offset-2" onClick={() => go('skills')}>Change answers</button>
            </div>
          </div>

          <div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
            <div class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6">
              {isMember && (
                <div class="mb-5 rounded-lg border border-[#9fd3b8] bg-[#eef8f2] p-4">
                  <p class="font-bold text-ink">{editing ? 'Save these answers to your account' : 'Add this child to your account'}</p>
                  <p class="mt-1 text-[14px] text-muted leading-snug">Their weekly packs, stories and check-ins are on your account page. Only the profile is saved there, never the name.</p>
                  <button type="button" onClick={finish} class="btn-pencil mt-3 w-full px-5 py-3 text-[16px]">{editing ? 'Save and go back to my account' : 'Save and go to my account'}</button>
                </div>
              )}
              <p class="text-[13px] font-bold uppercase tracking-wider text-[#1f7a50]">{isMember ? 'Included' : 'Free'}</p>
              <h3 class="mt-1 text-xl font-bold text-ink">Week 1: {weekTitle(week1)}</h3>
              <p class="mt-1 text-[15px] text-muted leading-snug">{THEMES[week1.theme].label} week. A plan page for you, then {pages.length - 1} pages across the week, including a little book starring {who}.</p>
              <div class="mt-5">
                <Segmented legend="Paper" name="pc-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />
              </div>
              <button type="button" disabled={busy || !pages.length} onClick={() => ask('week')} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
                {busy ? 'Making your PDF…' : `Download week 1 (${pages.length} pages)`}
              </button>
              {!font && <p class="mt-2 text-[13px] text-muted">Loading the coloring page letters…</p>}
              {done && <p class="mt-3 text-[14px] text-[#1f7a50]" role="status">{done}</p>}
              <p class="mt-3 text-[13px] text-muted">{name.trim() ? `${name.trim()}'s name is` : 'Names are'} added on this device. Nothing about {who} is sent to us.</p>
            </div>

            <figure class="lg:sticky lg:top-20 min-w-0">
              <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svgs[shown] ?? svgs[0] ?? '' }} />
              <figcaption class="mt-3 text-[13px] text-muted">Page {shown + 1} of {pages.length}. Tap a page below to preview it.</figcaption>
              <ul class="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2" aria-label="Pages in week 1">
                {svgs.map((s, i) => (
                  <li>
                    <button type="button" onClick={() => setShown(i)} aria-label={`Preview page ${i + 1}`} aria-current={i === shown ? 'true' : undefined}
                      class={`block w-full overflow-hidden rounded border bg-white ${i === shown ? 'border-rule shadow-[0_0_0_2px_var(--color-rule)]' : 'border-hairline'}`}
                      dangerouslySetInnerHTML={{ __html: s }} />
                  </li>
                ))}
              </ul>
            </figure>
          </div>

          <div class="mt-10 rounded-xl border border-hairline bg-white p-5 sm:p-7">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 class="text-[1.35rem] font-bold text-ink">The whole year, week by week</h3>
                <p class="mt-1 text-muted">{isMember ? `Print each week from your account, with a fresh story and word problems made for ${who}.` : `Week 1 is free. The rest arrive one week at a time, with a fresh story and word problems made for ${who}.`}</p>
              </div>
              {isMember
                ? <button type="button" onClick={finish} class="btn-pencil shrink-0 px-5 py-3 text-center text-[16px]">Save and go to my account</button>
                : <a href="/membership/" class="btn-pencil shrink-0 px-5 py-3 text-center text-[16px]">Start the full program</a>}
            </div>
            <ol class="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {plan.weeks.map((w) => {
                const free = w.index === 1 || isMember;
                return (
                  <li class={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${free ? 'border-[#9fd3b8] bg-[#eef8f2]' : 'border-hairline bg-[#fafbfd]'}`}>
                    <img src={coverUrl(w.theme)} alt="" width={36} height={36} loading="lazy" class={`mt-0.5 size-9 shrink-0 ${free ? '' : 'opacity-60'}`} />
                    <span class="min-w-0">
                      <span class="block text-[12px] font-bold uppercase tracking-wider text-muted">Week {w.index}{w.extraReview ? ', extra review' : ''}</span>
                      <span class="block font-bold text-ink leading-tight">{weekTitle(w)}</span>
                      <span class="block text-[13px] text-muted leading-snug">{weekBlurb(w)}</span>
                    </span>
                    {!isMember && (
                      <span class="ml-auto shrink-0 pt-0.5 text-[12px] font-bold" aria-label={free ? 'Free' : 'Locked'}>
                        {free ? <span class="text-[#1f7a50]">Free</span> : <LockIcon />}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            {!isMember && (
              <div class="mt-6 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-[15px] text-muted">$14.99 a month or $99 a year. Covers up to 4 kids. Cancel anytime.</p>
                <a href="/membership/" class="btn-pencil px-5 py-3 text-[16px]">Start the full program</a>
              </div>
            )}
          </div>
        </section>
      )}

      <EmailGate open={gate !== null} source={gate === 'showme' ? 'program-showme' : 'program-week1'} onClose={() => setGate(null)} onDone={() => { const k = gate ?? 'week'; setGate(null); save(k); }} />
    </div>
  );
}

/** Only same-site relative paths ("/account/"), never another site or a protocol-relative "//host". */
function safeReturn(raw: string | null | undefined): string {
  if (!raw || raw.length > 200 || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '';
  try {
    const u = new URL(raw, location.origin);
    return u.origin === location.origin ? u.pathname + u.search : '';
  } catch { return ''; }
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" class="text-[#8a93a6]" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  );
}

function planSummary(p: ChildProfile, level: 'pre-k' | 'kindergarten', len: number, reviews: number, Who: string): string {
  const parts: string[] = [];
  const got = (s: SkillId) => p.skills[s] === 'got-it';
  if (level === 'pre-k') parts.push(`${Who} starts on the Pre-K track: one letter a week in phonics order, with counting and numbers alongside.`);
  else if (got('word-families')) parts.push(`${Who} already reads short words, so the plan goes straight to word families, with sight words and adding.`);
  else if (got('letter-sounds') && got('letter-names')) parts.push(`${Who} knows letters and sounds, so the plan skips ahead to word families and early reading.`);
  else parts.push(`${Who} starts on the Kindergarten track: two letters a week, then word families and sight words.`);
  if (reviews) parts.push(`We added ${reviews} extra review ${reviews === 1 ? 'week' : 'weeks'} for skills that are still settling in.`);
  parts.push(`About ${p.minutesPerDay} minutes a day, ${p.daysPerWeek} days a week, built around ${p.interests.map((t) => THEMES[t].short).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`);
  return parts.join(' ');
}
