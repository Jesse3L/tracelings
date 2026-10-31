import { useEffect, useMemo, useState } from 'preact/hooks';
import { useHydrated } from '../lib/hydrated';
import { toLatin, type Page, type Paper } from '../lib/sheet';
import { pageToSvg } from '../lib/render';
import { savePdf } from '../lib/download';
import { whatLabel, kids } from '../lib/what';
import { needsEmail } from '../lib/gate';
import { useMember } from '../lib/member';
import { useRoster } from '../lib/roster';
import {
  ACTIVITIES, PRESETS, SCHEDULE_KINDS, SUBJECTS, DEFAULT_SUBJECTS, MAX_STEPS, MAX_LABEL, activityLabel, buildSchedulePage,
  loadScheduleIcons, scheduleIconUrl, scheduleLabel, type Routine, type ScheduleKind, type Step,
} from '../lib/schedule';
import { Segmented } from './Tracer';
import EmailGate from './EmailGate';

const link = 'text-[#2f5fc4] underline underline-offset-2';
const small = 'rounded-md border border-hairline bg-white px-2 py-1 text-[14px] leading-none text-ink disabled:opacity-40';

/**
 * Preschool schedule maker (/preschool-schedule/): a picture schedule for the day, cut-apart picture cards and a
 * weekly homeschool chart. Free: every page, every picture, one page at a time. Members also print all three pages
 * at once, or this page for every kid on their list. The child's name and the typed labels stay in the browser.
 */
export default function ScheduleMaker(props: { source?: string; preset?: string; kinds?: ScheduleKind[] }) {
  const start = PRESETS.find((p) => p.v === props.preset) ?? PRESETS[0];
  // The bedtime and morning pages offer the day list and the cards; the weekly homeschool chart lives on /preschool-schedule/.
  const KINDS = SCHEDULE_KINDS.filter((x) => !props.kinds || props.kinds.includes(x.v));
  const [kind, setKind] = useState<ScheduleKind>(KINDS[0].v);
  const [preset, setPreset] = useState(start.v);
  const [steps, setSteps] = useState<Step[]>(start.steps);
  const [routine, setRoutine] = useState<Routine>(start.routine ?? 'day');
  const [subjects, setSubjects] = useState<string[]>(DEFAULT_SUBJECTS);
  const [name, setName] = useState('');
  const [paper, setPaper] = useState<Paper>('letter');
  const [icons, setIcons] = useState(0);
  const [busy, setBusy] = useState(false);
  const ready = useHydrated();
  const [gate, setGate] = useState<null | 'one' | 'all' | 'list'>(null);
  const [done, setDone] = useState('');
  const [add, setAdd] = useState('');
  const member = useMember();
  const [roster] = useRoster();
  const credit = !member.member;

  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search);
      const k = q.get('type') as ScheduleKind | null;
      if (k && KINDS.some((x) => x.v === k)) setKind(k);
      const p = PRESETS.find((x) => x.v === q.get('preset'));
      if (p) { setPreset(p.v); setSteps(p.steps); setRoutine(p.routine ?? 'day'); }
      const nm = sessionStorage.getItem('tl-name');
      if (nm) setName(nm);
    } catch { /* storage or URL unavailable */ }
    loadScheduleIcons().then(() => setIcons((n) => n + 1));
  }, []);
  // Keep the typed name for the other tools in this tab (never in the URL, never sent anywhere).
  useEffect(() => { try { if (name) sessionStorage.setItem('tl-name', name); } catch { /* ignore */ } }, [name]);
  useEffect(() => setDone(''), [kind]);

  const opts = { kind, name, paper, credit, steps, subjects, routine };
  const page = useMemo(() => buildSchedulePage(opts), [kind, name, paper, credit, steps, subjects, routine, icons]);
  const svg = useMemo(() => pageToSvg(page), [page]);
  const listNames = member.member ? roster.slice(0, member.maxNames ?? 8) : [];
  const kindOf = (o: (typeof SCHEDULE_KINDS)[number]) => (routine !== 'day' && o.v === 'day' ? { ...o, label: scheduleLabel('day', routine), sub: 'Each step in order, with a picture and a box to check off' } : o);
  const routineFile = routine === 'bedtime' ? 'bedtime-routine' : routine === 'morning' ? 'morning-routine' : 'preschool-schedule';
  const routineTitle = routine === 'bedtime' ? 'Bedtime routine chart' : routine === 'morning' ? 'Morning routine chart' : 'Preschool schedule';
  const routineWord = routine === 'bedtime' ? 'Bedtime' : routine === 'morning' ? 'Morning' : 'Day';
  const kindLabel = kindOf(KINDS.find((x) => x.v === kind) ?? KINDS[0]).label;
  const slug = (s: string) => toLatin(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const base = slug(scheduleLabel(kind, routine));

  const pickPreset = (v: string) => { const p = PRESETS.find((x) => x.v === v); if (p) { setPreset(v); setSteps(p.steps); setRoutine(p.routine ?? 'day'); } };
  const edit = (i: number, patch: Partial<Step>) => { setPreset(''); setSteps((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x))); };
  const move = (i: number, d: -1 | 1) => { setPreset(''); setSteps((s) => { const t = [...s]; [t[i], t[i + d]] = [t[i + d], t[i]]; return t; }); };
  const remove = (i: number) => { setPreset(''); setSteps((s) => s.filter((_, k) => k !== i)); };
  const addStep = (icon: string) => { if (!icon) return; setPreset(''); setSteps((s) => (s.length >= MAX_STEPS ? s : [...s, { icon, label: activityLabel(icon), time: '' }])); setAdd(''); };
  const toggleSubject = (id: string) => setSubjects((s) => (s.includes(id) ? (s.length > 2 ? s.filter((x) => x !== id) : s) : SUBJECTS.map((x) => x.id).filter((x) => x === id || s.includes(x))));

  async function save(k: 'one' | 'all' | 'list') {
    setBusy(true);
    try {
      await loadScheduleIcons();
      let pages: Page[];
      let file: string;
      if (k === 'list') {
        pages = listNames.map((n) => buildSchedulePage({ ...opts, name: n }));
        file = `${base}-${listNames.length}-kids.pdf`;
      } else if (k === 'all') {
        pages = KINDS.map((x) => buildSchedulePage({ ...opts, kind: x.v }));
        file = `${routineFile}-${pages.length}-pages.pdf`;
      } else {
        pages = [buildSchedulePage(opts)];
        const who = slug(name);
        file = `${who ? `${who}-` : ''}${base}.pdf`;
      }
      await savePdf(pages, file, routineTitle, whatLabel('Preschool schedule', k === 'all' ? `all ${pages.length} pages` : kindLabel.toLowerCase(), routine !== 'day' && k === 'all' && routine, k === 'list' && kids(pages.length)));
      setDone(k === 'one' ? 'Downloaded. Print at 100% size.' : `Downloaded ${pages.length} pages.`);
    } finally {
      setBusy(false);
    }
  }
  const ask = (k: 'one' | 'all' | 'list') => (!member.member && needsEmail() ? setGate(k) : save(k));
  const unused = ACTIVITIES.filter((a) => !steps.some((s) => s.icon === a.icon));

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6 min-w-0" onSubmit={(e) => { e.preventDefault(); ask('one'); }}>
        <fieldset class="mb-5">
          <legend class="text-[15px] font-bold mb-2">Page</legend>
          <div class="grid gap-2">
            {KINDS.map(kindOf).map((o) => {
              const on = o.v === kind;
              return (
                <label class={`cursor-pointer rounded-lg border px-3 py-2 text-[15px] leading-tight transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-rule ${on ? 'border-rule bg-white text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]' : 'border-hairline bg-white/60 text-muted hover:text-ink'}`}>
                  <input type="radio" class="sr-only" name="sch-kind" checked={on} onChange={() => setKind(o.v)} />
                  <span class="block font-bold">{o.label}</span>
                  <span class="block text-[13px] text-muted mt-0.5">{o.sub}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {kind !== 'week' ? (
          <div class="mb-5">
            <label class="block mb-3">
              <span class="block text-[15px] font-bold mb-2">Start from</span>
              <select value={preset} onChange={(e) => pickPreset((e.target as HTMLSelectElement).value)}
                class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-lg text-ink focus:border-rule focus:outline-none">
                {preset === '' && <option value="">{routine !== 'day' ? 'Your own routine' : 'Your own day'}</option>}
                {PRESETS.map((p) => <option value={p.v}>{p.label}</option>)}
              </select>
            </label>
            <p class="text-[15px] font-bold mb-2">Steps in order <span class="font-normal text-muted">({steps.length} of {MAX_STEPS})</span></p>
            <ol class="grid gap-2">
              {steps.map((s, i) => (
                <li class="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 rounded-lg border border-hairline bg-white p-2">
                  <img src={scheduleIconUrl(s.icon)} alt="" width={32} height={32} class="h-8 w-8 row-span-2 self-center" />
                  <input type="text" value={s.label} maxLength={MAX_LABEL} aria-label={`Step ${i + 1} words`} autoComplete="off"
                    onInput={(e) => edit(i, { label: (e.target as HTMLInputElement).value })}
                    class="col-start-2 min-w-0 w-full rounded-md border border-hairline px-2 py-1.5 text-[15px] text-ink focus:border-rule focus:outline-none" />
                  <input type="text" value={s.time} maxLength={8} aria-label={`Step ${i + 1} time (optional)`} placeholder="time (optional)" autoComplete="off"
                    onInput={(e) => edit(i, { time: (e.target as HTMLInputElement).value })}
                    class="col-start-2 row-start-2 w-32 max-w-full rounded-md border border-hairline px-2 py-1 text-[14px] text-ink placeholder:text-[#a3acbf] focus:border-rule focus:outline-none" />
                  <div class="col-start-3 row-start-1 row-span-2 flex gap-1 self-center">
                    <button type="button" class={small} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move step ${i + 1} up`}>↑</button>
                    <button type="button" class={small} disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label={`Move step ${i + 1} down`}>↓</button>
                    <button type="button" class={small} disabled={steps.length <= 1} onClick={() => remove(i)} aria-label={`Remove step ${i + 1}`}>×</button>
                  </div>
                </li>
              ))}
            </ol>
            {steps.length < MAX_STEPS && (
              <label class="mt-2 block">
                <span class="sr-only">Add a step</span>
                <select value={add} onChange={(e) => addStep((e.target as HTMLSelectElement).value)}
                  class="w-full rounded-lg border border-dashed border-rule bg-white px-4 py-2.5 text-[16px] text-ink focus:border-rule focus:outline-none">
                  <option value="">+ Add a step</option>
                  {(unused.length ? unused : ACTIVITIES).map((a) => <option value={a.icon}>{a.label}</option>)}
                </select>
              </label>
            )}
            <p class="mt-2 text-[13px] text-muted">Change any words, add a time if you like, or leave times blank. {kind === 'cards' && 'Empty cards print blank, to draw your own.'}</p>
          </div>
        ) : (
          <fieldset class="mb-5">
            <legend class="text-[15px] font-bold mb-2">Rows on the chart</legend>
            <div class="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
              {SUBJECTS.map((s) => (
                <label class="flex cursor-pointer items-center gap-2 rounded-lg border border-hairline bg-white px-3 py-2 text-[15px] text-ink">
                  <input type="checkbox" checked={subjects.includes(s.id)} onChange={() => toggleSubject(s.id)} class="h-4 w-4 accent-[#2f5fc4]" />
                  <img src={scheduleIconUrl(s.icon)} alt="" width={24} height={24} class="h-6 w-6" />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label class="block mb-5">
          <span class="block text-[15px] font-bold mb-2">Child's first name <span class="font-normal text-muted">(optional)</span></span>
          <input id="sch-name" type="text" value={name} maxLength={24} autoComplete="off" spellcheck={false} placeholder="Type a name"
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-xl text-ink placeholder:text-[#a3acbf] focus:border-rule focus:outline-none" />
          <span class="block text-[13px] text-muted mt-2">Printed in the title, like "Maya's {routineWord}". It stays on this device.</span>
        </label>

        <Segmented legend="Paper" name="sch-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />

        <button type="submit" disabled={!ready || busy} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {!ready ? 'Loading…' : busy ? 'Making your PDF…' : 'Download this page'}
        </button>
        {done && <p class="mt-4 text-[14px] text-[#1f7a50]" role="status">{done}</p>}

        <div class="mt-5 rounded-lg border border-dashed border-rule/60 bg-white/70 p-4 text-[14px] leading-snug text-muted">
          {member.member ? (
            <>
              <p class="font-bold text-ink">Member printing</p>
              <div class="mt-3 grid gap-2">
                <button type="button" disabled={busy} onClick={() => save('all')} class="rounded-lg border border-rule bg-white px-4 py-2.5 text-left text-[15px] font-bold text-ink disabled:opacity-50">
                  All {KINDS.length} pages in one PDF
                </button>
                <button type="button" disabled={busy || listNames.length === 0} onClick={() => save('list')} class="rounded-lg border border-rule bg-white px-4 py-2.5 text-left text-[15px] font-bold text-ink disabled:opacity-50">
                  {listNames.length ? `This page for all ${listNames.length} kids` : 'This page for every kid on your list'}
                </button>
              </div>
              {listNames.length === 0 && <p class="mt-2">Save your kids' names once in <a class={link} href="/name-tracing/">name tracing</a> and they show up here.</p>}
            </>
          ) : (
            <>
              <span class="font-bold text-ink">More than one child?</span> Members print this page for every kid at once, or all {KINDS.length === 3 ? 'three' : 'both'} pages in one PDF, with no footer line.{' '}
              <a href="/membership/" class={link}>See membership</a>
            </>
          )}
        </div>
      </form>

      <figure class="lg:sticky lg:top-20 min-w-0">
        <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption class="mt-3 text-[13px] text-muted">{kindLabel}. This is exactly what prints.</figcaption>
      </figure>

      <EmailGate open={gate !== null} source={props.source ?? 'preschool-schedule'} onClose={() => setGate(null)} onDone={() => { const k = gate ?? 'one'; setGate(null); save(k); }} />
    </div>
  );
}
