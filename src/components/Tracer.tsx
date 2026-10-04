import { useEffect, useMemo, useState } from 'preact/hooks';
import { buildSheet, rowKinds, styleName, type LetterStyle, type LineSize, type Page, type Paper, type Practice } from '../lib/sheet';
import { pageToSvg, pagesToPdf } from '../lib/render';
import { needsEmail, countDownload } from '../lib/gate';
import EmailGate from './EmailGate';
import { useMember } from '../lib/member';
import WordChips from './WordChips';
import RosterPanel from './RosterPanel';
import { useRoster } from '../lib/roster';

type Mode = 'name' | 'letter' | 'number' | 'words';
type Case = 'both' | 'upper' | 'lower';

const SIZES: { v: LineSize; label: string; age: string }[] = [
  { v: 'large', label: 'Large', age: 'ages 3–4' },
  { v: 'medium', label: 'Medium', age: 'ages 5–6' },
  { v: 'small', label: 'Small', age: 'ages 6+' },
];
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const DIGITS = '0123456789'.split('');

/** Sight words print in lowercase, except the pronoun I. */
export const wordCase = (w: string) => (w === 'I' ? w : w.toLowerCase());

export function Segmented<T extends string>(props: {
  legend: string;
  name: string;
  value: T;
  options: { v: T; label: string; sub?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset class="mb-5">
      <legend class="text-[15px] font-bold mb-2">{props.legend}</legend>
      <div class="grid gap-2" style={{ gridTemplateColumns: `repeat(${props.options.length}, minmax(0,1fr))` }}>
        {props.options.map((o) => {
          const on = o.v === props.value;
          return (
            <label
              class={`cursor-pointer rounded-lg border px-2 py-2 text-center text-[15px] leading-tight transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-rule ${
                on ? 'border-rule bg-white text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]' : 'border-hairline bg-white/60 text-muted hover:text-ink'
              }`}
            >
              <input type="radio" class="sr-only" checked={on} onChange={() => props.onChange(o.v)} name={props.name} />
              <span class="block font-bold">{o.label}</span>
              {o.sub && <span class="block text-[13px] text-muted mt-0.5">{o.sub}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function Tracer(props: { mode?: Mode; value?: string; pick?: boolean; source?: string; words?: string[] }) {
  const mode = props.mode ?? 'name';
  const [name, setName] = useState('');
  const [value, setValue] = useState(props.value ?? (mode === 'number' ? '1' : 'a'));
  const [style, setStyle] = useState<LetterStyle>('capital');
  const [letterCase, setLetterCase] = useState<Case>('both');
  const [size, setSize] = useState<LineSize>('large');
  const [paper, setPaper] = useState<Paper>('letter');
  const [practice, setPractice] = useState<Practice>('trace-write');
  const [startDots, setStartDots] = useState(true);
  const [modelRow, setModelRow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [done, setDone] = useState(false);
  const allWords = props.words ?? [];
  const [chosen, setChosen] = useState<string[]>(() => allWords.slice(0, 8));
  const source = props.source ?? `${mode}-tracing`;
  const member = useMember();
  const credit = !member.member;
  const [roster] = useRoster();
  const [useList, setUseList] = useState(false);
  useEffect(() => { if (roster.length) setUseList(true); }, [roster.length > 0]);
  const listNames = useMemo(
    () => (member.member && mode === 'name' && useList ? roster.slice(0, member.maxNames ?? 8) : []),
    [roster, useList, member.member, member.maxNames, mode],
  );

  // A name typed on the homepage is handed over in this tab only, never through the URL.
  useEffect(() => {
    if (mode !== 'name') return;
    try {
      const n = sessionStorage.getItem('tl-name');
      if (n) { setName(n); sessionStorage.removeItem('tl-name'); }
    } catch { /* storage unavailable */ }
  }, []);

  const rowTexts = useMemo(() => {
    if (mode === 'number') return [value];
    if (mode === 'letter') {
      const U = value.toUpperCase(), l = value.toLowerCase();
      return letterCase === 'upper' ? [U] : letterCase === 'lower' ? [l] : [`${U} ${l}`, U, l];
    }
    return undefined;
  }, [mode, value, letterCase]);

  // Word sheets: one word per practice row. When the chosen words don't fit on one page, the PDF gets more pages.
  const wordPages = useMemo(() => {
    if (mode !== 'words') return null;
    const list = (chosen.length ? chosen : allWords.slice(0, 1)).map(wordCase);
    const perPage = Math.max(1, rowKinds({ size, paper, practice, modelRow }).filter((k) => k === 'trace').length);
    const out: Page[] = [];
    for (let i = 0; i < list.length; i += perPage) {
      const chunk = list.slice(i, i + perPage);
      // Row 0 is the solid example (the page's first word); trace rows then cycle through the chunk.
      out.push(buildSheet({ name, style, size, paper, practice, startDots, modelRow, credit, rowTexts: [chunk[0], ...chunk] }));
    }
    return out;
  }, [mode, chosen, size, paper, practice, startDots, modelRow, credit]);

  const page = useMemo(
    () => wordPages?.[0] ?? buildSheet({ name: listNames[0] ?? name, style, size, paper, practice, startDots, modelRow, credit, rowTexts }),
    [wordPages, name, listNames, style, size, paper, practice, startDots, modelRow, rowTexts, credit],
  );
  const pages = wordPages ?? [page];
  const noWords = mode === 'words' && chosen.length === 0;
  const svg = useMemo(() => pageToSvg(page), [page]);
  const strip = useMemo(
    () => svg.replace(/viewBox="[^"]+"/, `viewBox="30 80 ${page.w - 60} ${size === 'large' ? 236 : size === 'medium' ? 172 : 124}"`),
    [svg, size, page.w],
  );

  const fileBase =
    mode === 'name' ? `${styleName(name, 'lower').replace(/\s+/g, '-') || 'name'}-tracing-worksheet`
    : mode === 'letter' ? `letter-${value.toLowerCase()}-tracing-worksheet`
    : mode === 'words' ? `${props.value ? `${props.value}-` : ''}sight-words-tracing-worksheet`
    : `number-${value}-tracing-worksheet`;

  async function save() {
    setBusy(true);
    try {
      const listPages = listNames.map((n) => buildSheet({ name: n, style, size, paper, practice, startDots, modelRow, credit, rowTexts }));
      const bytes = mode === 'words' ? await pagesToPdf(pages, 'Sight word tracing worksheet')
        : listPages.length ? await pagesToPdf(listPages, 'Class name tracing worksheets')
        : await pagesToPdf([page]);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = listNames.length ? 'class-name-tracing-worksheets.pdf' : `${fileBase}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      countDownload();
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  function requestDownload(e: Event) {
    e.preventDefault();
    if (noWords) return;
    if (!member.member && needsEmail()) setGate(true);
    else save();
  }

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={requestDownload}>
        {mode === 'name' && (
          <label class="block mb-5">
            <span class="block text-[15px] font-bold mb-2">Child's name</span>
            <input
              id="tracer-name"
              type="text"
              value={name}
              maxLength={24}
              autoComplete="off"
              spellcheck={false}
              placeholder="Type a name"
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-2xl text-ink placeholder:text-[#a3acbf] focus:border-rule focus:outline-none"
            />
            <span class="block text-[13px] text-muted mt-2">Stays on this device. Letters, numbers and spaces only.</span>
          </label>
        )}
        {mode === 'name' && member.member && (
          <RosterPanel use={useList} onUse={setUseList} maxNames={member.maxNames ?? 8} what="a tracing sheet" />
        )}

        {mode !== 'name' && props.pick && (
          <label class="block mb-5">
            <span class="block text-[15px] font-bold mb-2">{mode === 'letter' ? 'Letter' : 'Number'}</span>
            <select
              id="tracer-pick"
              value={value}
              onChange={(e) => setValue((e.target as HTMLSelectElement).value)}
              class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-xl text-ink focus:border-rule focus:outline-none"
            >
              {(mode === 'letter' ? ALPHABET : DIGITS).map((c) => (
                <option value={c}>{mode === 'letter' ? `${c.toUpperCase()} ${c}` : c}</option>
              ))}
            </select>
          </label>
        )}

        {mode === 'words' && (
          <WordChips
            legend="Words on the sheet"
            words={allWords}
            selected={chosen}
            onChange={(next) => { setChosen(next); setDone(false); }}
            hint="One word per row. Extra words go on extra pages."
          />
        )}

        <div class="lg:hidden -mt-1 mb-5 sheet-frame overflow-hidden" aria-hidden="true" dangerouslySetInnerHTML={{ __html: strip }} />

        {mode === 'name' && (
          <Segmented
            legend="Letter style"
            name="style"
            value={style}
            onChange={setStyle}
            options={[
              { v: 'capital', label: 'Capital first', sub: styleName(name, 'capital') || 'Emma' },
              { v: 'caps', label: 'ALL CAPS', sub: styleName(name, 'caps') || 'EMMA' },
              { v: 'lower', label: 'lowercase', sub: styleName(name, 'lower') || 'emma' },
            ]}
          />
        )}
        {mode === 'letter' && (
          <Segmented
            legend="Letters"
            name="case"
            value={letterCase}
            onChange={setLetterCase}
            options={[
              { v: 'both', label: 'Both', sub: `${value.toUpperCase()} and ${value.toLowerCase()}` },
              { v: 'upper', label: 'Capital', sub: value.toUpperCase() },
              { v: 'lower', label: 'Lowercase', sub: value.toLowerCase() },
            ]}
          />
        )}
        <Segmented legend="Line size" name="size" value={size} onChange={setSize} options={SIZES.map((s) => ({ v: s.v, label: s.label, sub: s.age }))} />
        <Segmented
          legend="Practice rows"
          name="practice"
          value={practice}
          onChange={setPractice}
          options={[
            { v: 'trace-write', label: 'Trace, then write', sub: 'blank rows last' },
            { v: 'trace', label: 'Trace only', sub: 'every row dotted' },
          ]}
        />

        <div class="mb-5 grid gap-2 text-[15px]">
          <label class="flex items-center gap-3 cursor-pointer">
            <input id="tracer-dots" type="checkbox" class="size-4 accent-[#5b86d9]" checked={startDots} onChange={(e) => setStartDots((e.target as HTMLInputElement).checked)} />
            Green starting dots
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input id="tracer-model" type="checkbox" class="size-4 accent-[#5b86d9]" checked={modelRow} onChange={(e) => setModelRow((e.target as HTMLInputElement).checked)} />
            Solid example on the first row
          </label>
        </div>

        <Segmented legend="Paper" name="paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />

        {noWords && <p class="mb-3 text-[14px] text-[#b4232c]" role="alert">Choose at least one word to make a sheet.</p>}
        <button type="submit" disabled={busy || noWords} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {busy ? 'Making your PDF…' : listNames.length ? `Download ${listNames.length} sheets` : 'Download PDF'}
        </button>
        {done ? (
          <p class="mt-4 text-[14px] text-[#1f7a50]" role="status">Downloaded. Check your downloads folder, then print at 100% size.</p>
        ) : null}
        <div class="mt-4 rounded-lg border border-dashed border-rule/60 bg-white/70 p-3 text-[14px] leading-snug text-muted">
          {member.member ? (
            <><span class="font-bold text-ink">Member printing is on.</span> No footer line on your sheets{mode === 'name' ? ', and class lists print in one PDF' : ''}. <a href="/class-pack/" class="text-[#2f5fc4] underline underline-offset-2">Make a class pack</a> · <a href="/account/" class="text-[#2f5fc4] underline underline-offset-2">Your account</a></>
          ) : (
            <><span class="font-bold text-ink">Members</span> print a whole class list in one PDF, with no footer line on any sheet.{' '}
            <a href="/membership/" class="text-[#2f5fc4] underline underline-offset-2">See membership</a></>
          )}
        </div>
      </form>

      <figure class="lg:sticky lg:top-6">
        <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption class="mt-3 text-[13px] text-muted">
          Live preview{pages.length > 1 ? ` of page 1 of ${pages.length}` : ''}. The PDF prints at full size on {paper === 'letter' ? 'US Letter' : 'A4'} paper.
        </figcaption>
      </figure>

      <EmailGate open={gate} source={source} onClose={() => setGate(false)} onDone={() => { setGate(false); save(); }} />
    </div>
  );
}
