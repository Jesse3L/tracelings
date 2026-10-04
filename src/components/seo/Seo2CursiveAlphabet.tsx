import { useEffect, useMemo, useState } from 'preact/hooks';
import type { LineSize, Paper, Practice } from '../../lib/sheet';
import { pageToSvg } from '../../lib/render';
import { loadFont, type LoadedFont } from '../../lib/fontshape';
import { buildCursiveSheet } from '../../lib/cursive';
import { needsEmail } from '../../lib/gate';
import { savePdf } from '../../lib/download';
import { useMember } from '../../lib/member';
import { Segmented } from '../Tracer';
import EmailGate from '../EmailGate';

export const CURSIVE_SETS = [
  { label: 'A to G', text: 'Aa Bb Cc Dd Ee Ff Gg' },
  { label: 'H to N', text: 'Hh Ii Jj Kk Ll Mm Nn' },
  { label: 'O to U', text: 'Oo Pp Qq Rr Ss Tt Uu' },
  { label: 'V to Z', text: 'Vv Ww Xx Yy Zz' },
];

// Cursive alphabet sheets: pick a set with one click, or print all four sets (A to Z) in one PDF.
export default function Seo2CursiveAlphabet(props: { source?: string }) {
  const [font, setFont] = useState<LoadedFont | null>(null);
  const [failed, setFailed] = useState(false);
  const [set, setSet] = useState(0);
  const [size, setSize] = useState<LineSize>('large');
  const [practice, setPractice] = useState<Practice>('trace-write');
  const [modelRow, setModelRow] = useState(true);
  const [paper, setPaper] = useState<Paper>('letter');
  const [busy, setBusy] = useState<'' | 'one' | 'all'>('');
  const [gate, setGate] = useState<'' | 'one' | 'all'>('');
  const [done, setDone] = useState(false);
  const member = useMember();
  const credit = !member.member;

  useEffect(() => { loadFont('cursive').then(setFont).catch(() => setFailed(true)); }, []);

  const build = (text: string) => buildCursiveSheet(font!, { text, size, paper, practice, modelRow, credit });
  const page = useMemo(() => (font ? build(CURSIVE_SETS[set].text) : null), [font, set, size, paper, practice, modelRow, credit]);
  const svg = useMemo(() => (page ? pageToSvg(page) : ''), [page]);

  async function save(which: 'one' | 'all') {
    if (!font) return;
    setBusy(which);
    try {
      if (which === 'all') await savePdf(CURSIVE_SETS.map((s) => build(s.text)), 'cursive-alphabet-a-to-z-worksheets.pdf', 'Cursive alphabet worksheets A to Z');
      else await savePdf([build(CURSIVE_SETS[set].text)], `cursive-alphabet-${CURSIVE_SETS[set].label.toLowerCase().replace(/\s+/g, '-')}.pdf`, `Cursive alphabet ${CURSIVE_SETS[set].label}`);
      setDone(true);
    } finally {
      setBusy('');
    }
  }
  const request = (which: 'one' | 'all') => (!member.member && needsEmail() ? setGate(which) : save(which));

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); request('one'); }}>
        <fieldset class="mb-5">
          <legend class="text-[15px] font-bold mb-2">Letters on the sheet</legend>
          <div class="grid grid-cols-2 gap-2">
            {CURSIVE_SETS.map((s, i) => (
              <button type="button" aria-pressed={i === set} onClick={() => { setSet(i); setDone(false); }}
                class={`rounded-lg border px-2 py-2 text-center text-[15px] leading-tight ${i === set ? 'border-rule bg-white text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]' : 'border-hairline bg-white/60 text-muted hover:text-ink'}`}>
                <span class="block font-bold">{s.label}</span>
                <span class="block text-[13px] text-muted mt-0.5">{s.text.split(' ').length} letters</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Segmented legend="Line size" name="ca-size" value={size} onChange={setSize} options={[
          { v: 'large', label: 'Large', sub: 'starting out' },
          { v: 'medium', label: 'Medium', sub: 'most kids' },
          { v: 'small', label: 'Small', sub: 'confident' },
        ]} />
        <Segmented legend="Practice rows" name="ca-practice" value={practice} onChange={setPractice} options={[
          { v: 'trace-write', label: 'Trace, then write', sub: 'blank rows last' },
          { v: 'trace', label: 'Trace only', sub: 'every row gray' },
        ]} />
        <label class="mb-5 flex items-center gap-3 cursor-pointer text-[15px]">
          <input id="ca-model" type="checkbox" class="size-4 accent-[#5b86d9]" checked={modelRow} onChange={(e) => setModelRow((e.target as HTMLInputElement).checked)} />
          Solid example on the first row
        </label>
        <Segmented legend="Paper" name="ca-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />
        <button type="submit" disabled={!!busy || !font} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {busy === 'one' ? 'Making your PDF…' : `Download ${CURSIVE_SETS[set].label}`}
        </button>
        <button type="button" disabled={!!busy || !font} onClick={() => request('all')} class="mt-3 w-full rounded-lg border-2 border-rule bg-white px-5 py-3 text-lg font-bold text-ink hover:bg-[#f6f8fb] disabled:opacity-60">
          {busy === 'all' ? 'Making your PDF…' : 'Print A to Z (4 pages)'}
        </button>
        {done && <p class="mt-4 text-[14px] text-[#1f7a50]" role="status">Downloaded. Check your downloads folder, then print at 100% size.</p>}
        <div class="mt-4 rounded-lg border border-dashed border-rule/60 bg-white/70 p-3 text-[14px] leading-snug text-muted">
          {member.member ? (
            <><span class="font-bold text-ink">Member printing is on.</span> No footer line on your sheets. <a href="/class-pack/" class="text-[#2f5fc4] underline underline-offset-2">Make a class pack</a> · <a href="/account/" class="text-[#2f5fc4] underline underline-offset-2">Your account</a></>
          ) : (
            <><span class="font-bold text-ink">Members</span> get every printable with no footer line, plus class lists that print a page for every child in one PDF.{' '}
            <a href="/membership/" class="text-[#2f5fc4] underline underline-offset-2">See membership</a></>
          )}
        </div>
      </form>

      <figure class="lg:sticky lg:top-6">
        {svg ? (
          <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div class="sheet-frame aspect-[8.5/11] grid place-items-center text-muted">{failed ? 'The letters didn’t load. Refresh the page to try again.' : 'Loading letters…'}</div>
        )}
        <figcaption class="mt-3 text-[13px] text-muted">Live preview of {CURSIVE_SETS[set].label}. The PDF prints at full size on {paper === 'letter' ? 'US Letter' : 'A4'} paper.</figcaption>
      </figure>

      <EmailGate open={!!gate} source={props.source ?? 'cursive-alphabet'} onClose={() => setGate('')} onDone={() => { const w = gate || 'one'; setGate(''); save(w); }} />
    </div>
  );
}
