import { useEffect, useMemo, useState } from 'preact/hooks';
import { useHydrated } from '../lib/hydrated';
import { nameNote, toLatin, type Page, type Paper } from '../lib/sheet';
import { pageToSvg } from '../lib/render';
import { savePdf } from '../lib/download';
import { needsEmail } from '../lib/gate';
import { useMember } from '../lib/member';
import { useRoster } from '../lib/roster';
import { KINDS_FOR, BLANK_LAYOUTS, buildMathPage, buildMathSet, type MathKind, type MathRange, type Compare, type BlankLayout, type MathSeries } from '../lib/mathSheets';
import { Segmented } from './Tracer';
import EmailGate from './EmailGate';

const link = 'text-[#2f5fc4] underline underline-offset-2';
const SET = 5;
const PREFIX: Record<MathSeries, string> = { 'pre-k': 'Pre-K math', 'ten-frames': 'Ten frames', 'more-less': 'More or less', 'k-addition': 'Kindergarten math', 'k-subtraction': 'Kindergarten math' };
const FILE_PREFIX: Record<MathSeries, string> = { 'pre-k': 'pre-k-math', 'ten-frames': 'ten-frame', 'more-less': 'more-or-less', 'k-addition': 'kindergarten', 'k-subtraction': 'kindergarten' };
const FIRST: Record<MathSeries, MathKind> = { 'pre-k': 'ten-frame', 'ten-frames': 'blank-frame', 'more-less': 'more-less', 'k-addition': 'add-pictures', 'k-subtraction': 'subtract-pictures' };

/**
 * Math worksheet maker, used on /math-worksheets/pre-k/ (series 'pre-k'), /math-worksheets/ten-frames/ (series 'ten-frames'),
 * /math-worksheets/more-or-less/ (series 'more-less'), /math-worksheets/kindergarten-addition/ (series 'k-addition') and /math-worksheets/kindergarten-subtraction/ (series 'k-subtraction'). Free: any worksheet type, one page at a time, with fresh problems whenever you like.
 * Members also print a set of five different pages at once, or one page for every kid on their saved list.
 */
export default function MathSheets(props: { kind?: MathKind; source?: string; series?: MathSeries }) {
  const series: MathSeries = props.series ?? 'pre-k';
  const KINDS = KINDS_FOR[series];
  const prefix = PREFIX[series];
  const filePrefix = FILE_PREFIX[series];
  const [kind, setKind] = useState<MathKind>(props.kind ?? FIRST[series]);
  const [blank, setBlank] = useState<BlankLayout>('one');
  const [range, setRange] = useState<MathRange>(10);
  const [number, setNumber] = useState(5);
  const [compare, setCompare] = useState<Compare>('more');
  const [name, setName] = useState('');
  const [paper, setPaper] = useState<Paper>('letter');
  const [seed, setSeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const ready = useHydrated();
  const [gate, setGate] = useState<null | 'one' | 'set' | 'list'>(null);
  const [done, setDone] = useState('');
  const member = useMember();
  const [roster] = useRoster();
  const credit = !member.member;
  const source = props.source ?? 'prek-math';

  useEffect(() => {
    try {
      const q = new URLSearchParams(location.search);
      const k = q.get('type') as MathKind | null;
      if (k && KINDS.some((x) => x.v === k)) setKind(k);
      const r = Number(q.get('range'));
      if (r === 5 || r === 10 || r === 20) setRange(r);
      const n = Number(q.get('number'));
      if (series === 'pre-k' && n >= 1 && n <= 20) { setNumber(n); if (k !== 'find-number') setKind('count-color'); }
      const nm = sessionStorage.getItem('tl-name');
      if (nm) setName(nm);
    } catch { /* storage or URL unavailable */ }
  }, []);
  // Keep the typed name for the other tools in this tab (never in the URL, never sent anywhere).
  useEffect(() => { try { if (name) sessionStorage.setItem('tl-name', name); } catch { /* ignore */ } }, [name]);
  useEffect(() => setDone(''), [kind, range, number, compare, blank]);

  const opts = { kind, range, number, compare, name, paper, credit, seed, blank, series };
  const page = useMemo(() => buildMathPage(opts), [kind, range, number, compare, name, paper, credit, seed, blank]);
  const svg = useMemo(() => pageToSvg(page), [page]);
  const listNames = member.member ? roster.slice(0, member.maxNames ?? 8) : [];
  const kindLabel = KINDS.find((x) => x.v === kind)!.label;
  const byNumber = kind === 'count-color' || kind === 'find-number'; // the page is about one number, picked below
  const noRange = byNumber || kind === 'make-ten' || kind === 'blank-frame';
  const fixed = kind === 'count-color' || kind === 'blank-frame'; // nothing random on the page
  const blankLabel = BLANK_LAYOUTS.find((x) => x.v === blank)!.label;
  const slug = (s: string) => toLatin(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const within = series === 'k-addition' || series === 'k-subtraction';
  const what = byNumber ? `number-${number}` : kind === 'blank-frame' ? slug(blankLabel) : kind === 'make-ten' ? 'to-10' : within ? `within-${range}` : `1-to-${range}`;
  const fileKind = kind === 'blank-frame' ? 'blank' : slug(kindLabel);

  async function save(k: 'one' | 'set' | 'list') {
    setBusy(true);
    try {
      let pages: Page[];
      let file: string;
      if (k === 'list') {
        pages = listNames.map((n) => buildMathPage({ ...opts, name: n }));
        file = `${filePrefix}-${fileKind}-${what}-${listNames.length}-kids.pdf`;
      } else if (k === 'set') {
        pages = buildMathSet(opts, SET);
        file = `${filePrefix}-${fileKind}-${what}-${SET}-pages.pdf`;
      } else {
        pages = [page];
        const who = slug(name);
        file = `${who ? `${who}-` : ''}${filePrefix}-${fileKind}-${what}.pdf`;
      }
      await savePdf(pages, file, `${prefix}: ${kindLabel}`);
      setDone(k === 'one' ? (fixed ? 'Downloaded. Print at 100% size.' : 'Downloaded. Print at 100% size. Tap "New problems" any time for a fresh page.') : `Downloaded ${pages.length} pages.`);
    } finally {
      setBusy(false);
    }
  }
  const ask = (k: 'one' | 'set' | 'list') => (!member.member && needsEmail() ? setGate(k) : save(k));

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); ask('one'); }}>
        <fieldset class="mb-5">
          <legend class="text-[15px] font-bold mb-2">Worksheet</legend>
          <div class="grid gap-2">
            {KINDS.map((o) => {
              const on = o.v === kind;
              return (
                <label class={`cursor-pointer rounded-lg border px-3 py-2 text-[15px] leading-tight transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-rule ${on ? 'border-rule bg-white text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]' : 'border-hairline bg-white/60 text-muted hover:text-ink'}`}>
                  <input type="radio" class="sr-only" name="math-kind" checked={on} onChange={() => setKind(o.v)} />
                  <span class="block font-bold">{o.label}</span>
                  <span class="block text-[13px] text-muted mt-0.5">{o.sub}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {byNumber ? (
          <label class="block mb-5">
            <span class="block text-[15px] font-bold mb-2">Number</span>
            <select id="math-number" value={String(number)} onChange={(e) => setNumber(Number((e.target as HTMLSelectElement).value))}
              class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-lg text-ink focus:border-rule focus:outline-none">
              {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => <option value={String(n)}>{n}</option>)}
            </select>
          </label>
        ) : kind === 'blank-frame' ? (
          <Segmented legend="Layout" name="math-blank" value={blank} onChange={setBlank} options={BLANK_LAYOUTS} />
        ) : noRange ? null : kind === 'tf-add' ? (
          <Segmented legend="Add" name="math-range" value={String(range) as '5' | '10' | '20'} onChange={(v) => setRange(Number(v) as MathRange)} options={[
            { v: '5', label: 'Within 5', sub: 'one row' },
            { v: '10', label: 'Within 10', sub: 'one frame' },
            { v: '20', label: '11 to 20', sub: 'two frames' },
          ]} />
        ) : within ? (
          <Segmented legend="Numbers" name="math-range" value={String(range) as '5' | '10' | '20'} onChange={(v) => setRange(Number(v) as MathRange)} options={[
            { v: '5', label: 'Within 5', sub: 'just starting' },
            { v: '10', label: 'Within 10', sub: 'most of K' },
            { v: '20', label: 'Within 20', sub: 'ready for more' },
          ]} />
        ) : (
          <Segmented legend="Numbers" name="math-range" value={String(range) as '5' | '10' | '20'} onChange={(v) => setRange(Number(v) as MathRange)} options={[
            { v: '5', label: '1 to 5', sub: 'just starting' },
            { v: '10', label: '1 to 10', sub: series === 'ten-frames' ? 'one frame' : series === 'more-less' ? 'most of K' : 'most Pre-K' },
            { v: '20', label: series === 'ten-frames' ? '11 to 20' : '1 to 20', sub: series === 'ten-frames' ? 'two frames' : 'ready for more' },
          ]} />
        )}

        {kind === 'more-less' && (
          <Segmented legend="Circle the group with" name="math-compare" value={compare} onChange={setCompare} options={[{ v: 'more', label: 'More' }, { v: 'fewer', label: 'Fewer' }]} />
        )}
        {kind === 'compare-numbers' && (
          <Segmented legend="Circle the number that is" name="math-compare" value={compare} onChange={setCompare} options={[{ v: 'more', label: 'Bigger' }, { v: 'fewer', label: 'Smaller' }]} />
        )}

        <label class="block mb-5">
          <span class="block text-[15px] font-bold mb-2">Child's first name <span class="font-normal text-muted">(optional)</span></span>
          <input id="math-name" type="text" value={name} maxLength={24} autoComplete="off" spellcheck={false} placeholder="Type a name"
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-xl text-ink placeholder:text-[#a3acbf] focus:border-rule focus:outline-none" />
          <span class="block text-[13px] text-muted mt-2">Printed on the Name line. It stays on this device.</span>
          {nameNote(name) && <span class="block text-[13px] text-[#b4232c] mt-1" role="status">{nameNote(name)}</span>}
        </label>

        <Segmented legend="Paper" name="math-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />

        {!fixed && (
          <button type="button" onClick={() => setSeed((s) => s + 1)} class="mb-3 w-full rounded-lg border border-rule bg-white px-5 py-2.5 text-[16px] font-bold text-ink">
            New problems
          </button>
        )}
        <button type="submit" disabled={!ready || busy} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {!ready ? 'Loading…' : busy ? 'Making your PDF…' : 'Download this worksheet'}
        </button>
        {done && <p class="mt-4 text-[14px] text-[#1f7a50]" role="status">{done}</p>}

        <div class="mt-5 rounded-lg border border-dashed border-rule/60 bg-white/70 p-4 text-[14px] leading-snug text-muted">
          {member.member ? (
            <>
              <p class="font-bold text-ink">Member printing</p>
              <div class="mt-3 grid gap-2">
                {kind !== 'blank-frame' && (
                  <button type="button" disabled={busy} onClick={() => save('set')} class="rounded-lg border border-rule bg-white px-4 py-2.5 text-left text-[15px] font-bold text-ink disabled:opacity-50">
                    {byNumber ? `Numbers ${number} to ${((number + SET - 2) % 20) + 1} in one PDF` : `${SET} different pages in one PDF`}
                  </button>
                )}
                <button type="button" disabled={busy || listNames.length === 0} onClick={() => save('list')} class="rounded-lg border border-rule bg-white px-4 py-2.5 text-left text-[15px] font-bold text-ink disabled:opacity-50">
                  {listNames.length ? `This page for all ${listNames.length} kids` : 'This page for every kid on your list'}
                </button>
              </div>
              {listNames.length === 0 && <p class="mt-2">Save your kids' names once in <a class={link} href="/name-tracing/">name tracing</a> and they show up here.</p>}
            </>
          ) : (
            <>
              <span class="font-bold text-ink">Want a week of math at once?</span> Members print five different pages in one PDF, or one for every kid, with no footer line.{' '}
              <a href="/membership/" class={link}>See membership</a>
            </>
          )}
        </div>
      </form>

      <figure class="lg:sticky lg:top-20">
        <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption class="mt-3 text-[13px] text-muted">{kindLabel}{byNumber ? `, number ${number}` : kind === 'blank-frame' ? `, ${blankLabel.toLowerCase()}` : kind === 'make-ten' ? '' : kind === 'tf-add' ? (range === 20 ? ', sums 11 to 20' : `, within ${range}`) : within ? `, within ${range}` : series === 'ten-frames' && range === 20 ? ', numbers 11 to 20' : `, numbers 1 to ${range}`}. This is exactly what prints.</figcaption>
      </figure>

      <EmailGate open={gate !== null} source={source} onClose={() => setGate(null)} onDone={() => { const k = gate ?? 'one'; setGate(null); save(k); }} />
    </div>
  );
}
