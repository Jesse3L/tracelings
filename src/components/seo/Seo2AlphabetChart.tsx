import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Paper } from '../../lib/sheet';
import { buildPrintChart, buildCursiveChart, type ChartLetters } from '../../lib/alphabetChart';
import { loadFont, type LoadedFont } from '../../lib/fontshape';
import { pageToSvg } from '../../lib/render';
import { savePdf } from '../../lib/download';
import { needsEmail } from '../../lib/gate';
import { useMember } from '../../lib/member';
import { Segmented } from '../Tracer';
import EmailGate from '../EmailGate';

type Style = 'print' | 'cursive';

// A to Z on one page, in print or cursive, for the wall, a desk or a folder.
export default function Seo2AlphabetChart(props: { source?: string; defaultStyle?: Style }) {
  const [style, setStyle] = useState<Style>(props.defaultStyle ?? 'print');
  const [letters, setLetters] = useState<ChartLetters>('pairs');
  const [startDots, setStartDots] = useState(false);
  const [paper, setPaper] = useState<Paper>('letter');
  const [font, setFont] = useState<LoadedFont | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [done, setDone] = useState(false);
  const member = useMember();
  const credit = !member.member;

  useEffect(() => {
    if (style === 'cursive' && !font) loadFont('cursive').then(setFont).catch(() => setFailed(true));
  }, [style]);

  const page = useMemo(() => {
    if (style === 'print') return buildPrintChart({ paper, letters, startDots, credit });
    return font ? buildCursiveChart(font, { paper, letters, credit }) : null;
  }, [style, paper, letters, startDots, credit, font]);
  const svg = useMemo(() => (page ? pageToSvg(page).replace('aria-label="Worksheet preview"', `aria-label="${style === 'cursive' ? 'Cursive' : 'Print'} alphabet chart preview"`) : ''), [page, style]);

  async function save() {
    if (!page) return;
    setBusy(true);
    try {
      const which = letters === 'upper' ? '-uppercase' : letters === 'lower' ? '-lowercase' : '';
      await savePdf([page], `${style === 'cursive' ? 'cursive-' : ''}alphabet-chart${which}.pdf`, style === 'cursive' ? 'Cursive alphabet chart' : 'Alphabet chart');
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); !member.member && needsEmail() ? setGate(true) : save(); }}>
        <Segmented legend="Letter style" name="chart-style" value={style} onChange={(v) => { setStyle(v); setDone(false); }} options={[
          { v: 'print', label: 'Print', sub: 'ball and stick' },
          { v: 'cursive', label: 'Cursive', sub: 'traditional' },
        ]} />
        <Segmented legend="Letters" name="chart-letters" value={letters} onChange={(v) => { setLetters(v); setDone(false); }} options={[
          { v: 'pairs', label: 'Both', sub: 'A a' },
          { v: 'upper', label: 'Capital', sub: 'A B C' },
          { v: 'lower', label: 'Lowercase', sub: 'a b c' },
        ]} />
        {style === 'print' && (
          <label class="mb-5 flex items-center gap-3 cursor-pointer text-[15px]">
            <input id="chart-dots" type="checkbox" class="size-4 accent-[#5b86d9]" checked={startDots} onChange={(e) => setStartDots((e.target as HTMLInputElement).checked)} />
            Green starting dots
          </label>
        )}
        <Segmented legend="Paper" name="chart-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />
        <button type="submit" disabled={busy || !page} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {busy ? 'Making your PDF…' : 'Download the chart'}
        </button>
        {done && <p class="mt-4 text-[14px] text-[#1f7a50]" role="status">Downloaded. Check your downloads folder, then print at 100% size.</p>}
        <div class="mt-4 rounded-lg border border-dashed border-rule/60 bg-white/70 p-3 text-[14px] leading-snug text-muted">
          {member.member ? (
            <><span class="font-bold text-ink">Member printing is on.</span> No footer line on your charts. <a href="/class-pack/" class="text-[#2f5fc4] underline underline-offset-2">Make a class pack</a> · <a href="/account/" class="text-[#2f5fc4] underline underline-offset-2">Your account</a></>
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
        <figcaption class="mt-3 text-[13px] text-muted">Live preview. The PDF prints at full size on {paper === 'letter' ? 'US Letter' : 'A4'} paper.</figcaption>
      </figure>

      <EmailGate open={gate} source={props.source ?? 'alphabet-chart'} onClose={() => setGate(false)} onDone={() => { setGate(false); save(); }} />
    </div>
  );
}
