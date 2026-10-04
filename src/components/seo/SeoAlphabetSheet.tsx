import { useMemo, useState } from 'preact/hooks';
import { buildSheet, rowKinds, type LineSize, type Page, type Paper } from '../../lib/sheet';
import { pageToSvg } from '../../lib/render';
import { savePdf } from '../../lib/download';
import { needsEmail } from '../../lib/gate';
import { useMember } from '../../lib/member';
import { Segmented } from '../Tracer';
import EmailGate from '../EmailGate';

type Case = 'both' | 'upper' | 'lower';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const CAP: Record<LineSize, number> = { large: 64, medium: 46, small: 32 };

/** Keeps letters on the first `n` rows only, so a short last page ends with empty handwriting lines instead of repeats. */
function keepRows(page: Page, n: number, size: LineSize): Page {
  const cap = CAP[size];
  const gap = Math.max(16, cap * 0.42);
  const cutoff = 92 + n * (cap * 1.5 + gap) - gap / 2;
  const yOf = (d: string) => Number(d.replace(/^[A-Z]/, '').split(' ')[1]);
  return {
    ...page,
    items: page.items.filter((it) => (it.kind === 'path' ? yOf(it.d) < cutoff : it.kind === 'dot' ? it.cy < cutoff : true)),
  };
}

export function buildAlphabetPages(letterCase: Case, size: LineSize, paper: Paper, startDots: boolean, credit: boolean): Page[] {
  const rows = ALPHABET.map((l) => (letterCase === 'upper' ? l.toUpperCase() : letterCase === 'lower' ? l : `${l.toUpperCase()} ${l}`));
  const perPage = Math.max(1, rowKinds({ size, paper, practice: 'trace', modelRow: false }).length);
  const out: Page[] = [];
  for (let i = 0; i < rows.length; i += perPage) {
    const chunk = rows.slice(i, i + perPage);
    // Trace rows read rowTexts[1..], so index 0 is padding. A one-letter chunk is passed alone so every row gets that letter.
    const page = buildSheet({ name: '', style: 'capital', size, paper, practice: 'trace', startDots, modelRow: false, credit, rowTexts: chunk.length === 1 ? chunk : [chunk[0], ...chunk] });
    out.push(chunk.length < perPage ? keepRows(page, chunk.length, size) : page);
  }
  return out;
}

// The whole alphabet in one PDF: one letter per tracing row, as many pages as the line size needs.
export default function SeoAlphabetSheet(props: { source?: string }) {
  const [letterCase, setLetterCase] = useState<Case>('both');
  const [size, setSize] = useState<LineSize>('medium');
  const [paper, setPaper] = useState<Paper>('letter');
  const [startDots, setStartDots] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [done, setDone] = useState(false);
  const member = useMember();
  const credit = !member.member;

  const pages = useMemo(() => buildAlphabetPages(letterCase, size, paper, startDots, credit), [letterCase, size, paper, startDots, credit]);
  const svg = useMemo(() => pageToSvg(pages[0]), [pages]);

  async function save() {
    setBusy(true);
    try {
      const name = letterCase === 'upper' ? 'uppercase' : letterCase === 'lower' ? 'lowercase' : 'alphabet';
      await savePdf(pages, `${name}-a-to-z-tracing-worksheets.pdf`, 'Alphabet tracing worksheets A to Z');
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); !member.member && needsEmail() ? setGate(true) : save(); }}>
        <Segmented legend="Letters" name="abc-case" value={letterCase} onChange={(v) => { setLetterCase(v); setDone(false); }} options={[
          { v: 'both', label: 'Both', sub: 'A a' },
          { v: 'upper', label: 'Capital', sub: 'A B C' },
          { v: 'lower', label: 'Lowercase', sub: 'a b c' },
        ]} />
        <Segmented legend="Line size" name="abc-size" value={size} onChange={setSize} options={[
          { v: 'large', label: 'Large', sub: 'ages 3–4' },
          { v: 'medium', label: 'Medium', sub: 'ages 5–6' },
          { v: 'small', label: 'Small', sub: 'ages 6+' },
        ]} />
        <label class="mb-5 flex items-center gap-3 cursor-pointer text-[15px]">
          <input id="abc-dots" type="checkbox" class="size-4 accent-[#5b86d9]" checked={startDots} onChange={(e) => setStartDots((e.target as HTMLInputElement).checked)} />
          Green starting dots
        </label>
        <Segmented legend="Paper" name="abc-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />
        <button type="submit" disabled={busy} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {busy ? 'Making your PDF…' : `Download A to Z (${pages.length} pages)`}
        </button>
        {done && <p class="mt-4 text-[14px] text-[#1f7a50]" role="status">Downloaded. Check your downloads folder, then print at 100% size.</p>}
        <p class="mt-4 text-[14px] text-muted">One letter per row, A to Z in order. Smaller lines fit more letters on each page.</p>
      </form>

      <figure class="lg:sticky lg:top-6">
        <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption class="mt-3 text-[13px] text-muted">Live preview of page 1 of {pages.length}. The PDF prints at full size on {paper === 'letter' ? 'US Letter' : 'A4'} paper.</figcaption>
      </figure>

      <EmailGate open={gate} source={props.source ?? 'letter-tracing-az'} onClose={() => setGate(false)} onDone={() => { setGate(false); save(); }} />
    </div>
  );
}
