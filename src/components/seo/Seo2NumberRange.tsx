import { useMemo, useState } from 'preact/hooks';
import type { LineSize, Paper, Practice } from '../../lib/sheet';
import { buildRangePages, type RangeLayout } from '../../lib/rowSheet';
import { pageToSvg } from '../../lib/render';
import { savePdf } from '../../lib/download';
import { needsEmail } from '../../lib/gate';
import { useMember } from '../../lib/member';
import { Segmented } from '../Tracer';
import EmailGate from '../EmailGate';

// Numbers from..to in counting order: all on one page, or one number per row across several pages.
export default function Seo2NumberRange(props: { from?: number; to: number; source?: string }) {
  const from = props.from ?? 1;
  const to = props.to;
  const [layout, setLayout] = useState<RangeLayout>('page');
  const [size, setSize] = useState<LineSize>('medium');
  const [practice, setPractice] = useState<Practice>('trace-write');
  const [startDots, setStartDots] = useState(true);
  const [paper, setPaper] = useState<Paper>('letter');
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [done, setDone] = useState(false);
  const member = useMember();
  const credit = !member.member;

  const pages = useMemo(
    () => buildRangePages({ from, to, layout, size, paper, practice, startDots, credit }),
    [from, to, layout, size, paper, practice, startDots, credit],
  );
  const svg = useMemo(() => pageToSvg(pages[0]), [pages]);

  async function save() {
    setBusy(true);
    try {
      await savePdf(pages, `number-tracing-${from}-${to}${layout === 'rows' ? `-${size}` : ''}.pdf`, `Number tracing ${from} to ${to}`);
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); !member.member && needsEmail() ? setGate(true) : save(); }}>
        <Segmented legend="Layout" name="range-layout" value={layout} onChange={(v) => { setLayout(v); setDone(false); }} options={[
          { v: 'page', label: 'One page', sub: `${from} to ${to} together` },
          { v: 'rows', label: 'Bigger numbers', sub: 'one per row' },
        ]} />
        {layout === 'rows' && (
          <Segmented legend="Line size" name="range-size" value={size} onChange={setSize} options={[
            { v: 'large', label: 'Large', sub: 'ages 3–4' },
            { v: 'medium', label: 'Medium', sub: 'ages 5–6' },
            { v: 'small', label: 'Small', sub: 'ages 6+' },
          ]} />
        )}
        <Segmented legend="Practice" name="range-practice" value={practice} onChange={setPractice} options={[
          { v: 'trace-write', label: 'Trace, then write', sub: 'space left to write' },
          { v: 'trace', label: 'Trace only', sub: 'full rows' },
        ]} />
        <label class="mb-5 flex items-center gap-3 cursor-pointer text-[15px]">
          <input id="range-dots" type="checkbox" class="size-4 accent-[#5b86d9]" checked={startDots} onChange={(e) => setStartDots((e.target as HTMLInputElement).checked)} />
          Green starting dots
        </label>
        <Segmented legend="Paper" name="range-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />
        <button type="submit" disabled={busy} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {busy ? 'Making your PDF…' : `Download ${from} to ${to} (${pages.length} ${pages.length === 1 ? 'page' : 'pages'})`}
        </button>
        {done && <p class="mt-4 text-[14px] text-[#1f7a50]" role="status">Downloaded. Check your downloads folder, then print at 100% size.</p>}
        <p class="mt-4 text-[14px] text-muted">Each row starts with a solid number to look at, then dotted copies to trace.</p>
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
        <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption class="mt-3 text-[13px] text-muted">
          Live preview{pages.length > 1 ? ` of page 1 of ${pages.length}` : ''}. The PDF prints at full size on {paper === 'letter' ? 'US Letter' : 'A4'} paper.
        </figcaption>
      </figure>

      <EmailGate open={gate} source={props.source ?? 'number-tracing'} onClose={() => setGate(false)} onDone={() => { setGate(false); save(); }} />
    </div>
  );
}
