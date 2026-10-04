import { useEffect, useMemo, useState } from 'preact/hooks';
import { buildSheet, styleName, type LetterStyle, type LineSize, type Paper, type Practice } from '../lib/sheet';
import { pageToSvg, pagesToPdf } from '../lib/render';

const STYLES: { v: LetterStyle; label: string; hint: (n: string) => string }[] = [
  { v: 'capital', label: 'Capital first', hint: (n) => styleName(n, 'capital') || 'Emma' },
  { v: 'caps', label: 'ALL CAPS', hint: (n) => styleName(n, 'caps') || 'EMMA' },
  { v: 'lower', label: 'lowercase', hint: (n) => styleName(n, 'lower') || 'emma' },
];
const SIZES: { v: LineSize; label: string; age: string }[] = [
  { v: 'large', label: 'Large', age: 'ages 3–4' },
  { v: 'medium', label: 'Medium', age: 'ages 5–6' },
  { v: 'small', label: 'Small', age: 'ages 6+' },
];

function Segmented<T extends string>(props: {
  legend: string;
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
              class={`cursor-pointer rounded-lg border px-2 py-2 text-center text-[15px] leading-tight transition-colors ${
                on ? 'border-rule bg-white text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]' : 'border-hairline bg-white/60 text-muted hover:text-ink'
              }`}
            >
              <input type="radio" class="sr-only" checked={on} onChange={() => props.onChange(o.v)} name={props.legend} />
              <span class="block font-bold">{o.label}</span>
              {o.sub && <span class="block text-[13px] text-muted mt-0.5">{o.sub}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function NameTracer() {
  const [name, setName] = useState('');
  const [style, setStyle] = useState<LetterStyle>('capital');
  const [size, setSize] = useState<LineSize>('large');
  const [paper, setPaper] = useState<Paper>('letter');
  const [practice, setPractice] = useState<Practice>('trace-write');
  const [startDots, setStartDots] = useState(true);
  const [modelRow, setModelRow] = useState(true);
  const [busy, setBusy] = useState(false);

  // A name typed on the homepage is handed over in this tab only, never through the URL.
  useEffect(() => {
    try {
      const n = sessionStorage.getItem('tl-name');
      if (n) { setName(n); sessionStorage.removeItem('tl-name'); }
    } catch { /* storage unavailable */ }
  }, []);

  const opts = { name, style, size, paper, practice, startDots, modelRow, credit: true };
  const page = useMemo(() => buildSheet(opts), [name, style, size, paper, practice, startDots, modelRow]);
  const svg = useMemo(() => pageToSvg(page), [page]);
  const strip = useMemo(() => svg.replace(/viewBox="[^"]+"/, `viewBox="30 80 ${page.w - 60} ${size === 'large' ? 236 : size === 'medium' ? 172 : 124}"`), [svg, size, page.w]);

  async function download() {
    setBusy(true);
    try {
      const bytes = await pagesToPdf([page]);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = styleName(name, 'lower').replace(/\s+/g, '-') || 'name';
      a.href = url;
      a.download = `${slug}-tracing-worksheet.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); download(); }}>
        <label class="block mb-5">
          <span class="block text-[15px] font-bold mb-2">Child's name</span>
          <input
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
        <div class="lg:hidden -mt-1 mb-5 sheet-frame overflow-hidden" aria-hidden="true" dangerouslySetInnerHTML={{ __html: strip }} />

        <Segmented legend="Letter style" value={style} onChange={setStyle} options={STYLES.map((s) => ({ v: s.v, label: s.label, sub: s.hint(name) }))} />
        <Segmented legend="Line size" value={size} onChange={setSize} options={SIZES.map((s) => ({ v: s.v, label: s.label, sub: s.age }))} />
        <Segmented
          legend="Practice rows"
          value={practice}
          onChange={setPractice}
          options={[
            { v: 'trace-write', label: 'Trace, then write', sub: 'blank rows last' },
            { v: 'trace', label: 'Trace only', sub: 'every row dotted' },
          ]}
        />

        <div class="mb-5 grid gap-2 text-[15px]">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" class="size-4 accent-[#5b86d9]" checked={startDots} onChange={(e) => setStartDots((e.target as HTMLInputElement).checked)} />
            Green starting dots
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" class="size-4 accent-[#5b86d9]" checked={modelRow} onChange={(e) => setModelRow((e.target as HTMLInputElement).checked)} />
            Solid example on the first row
          </label>
        </div>

        <Segmented legend="Paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />

        <button type="submit" disabled={busy} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {busy ? 'Making your PDF…' : 'Download PDF'}
        </button>
        <p class="mt-4 text-[13px] text-muted leading-snug">
          Need a sheet for every child in your class? Class lists are part of the membership, coming soon.
        </p>
      </form>

      <figure class="lg:sticky lg:top-6">
        <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption class="mt-3 text-[13px] text-muted">Live preview. The PDF prints at full size on {paper === 'letter' ? 'US Letter' : 'A4'} paper.</figcaption>
      </figure>
    </div>
  );
}
