import { useMemo, useState } from 'preact/hooks';
import type { LineSize, Paper, Practice } from '../../lib/sheet';
import { buildWordPages, cleanTraceText } from '../../lib/rowSheet';
import { pageToSvg } from '../../lib/render';
import { savePdf } from '../../lib/download';
import { needsEmail } from '../../lib/gate';
import { useMember } from '../../lib/member';
import { Segmented } from '../Tracer';
import EmailGate from '../EmailGate';

const MAX_LINES = 30;
const MAX_CHARS = 120;

const EXAMPLES = [
  { label: 'Spelling list', text: 'friend\nbecause\nwhere\nthrough\nanswer\nlearn' },
  { label: 'A sentence', text: 'The little red hen found a seed.' },
  { label: 'Days of the week', text: 'Monday\nTuesday\nWednesday\nThursday\nFriday\nSaturday\nSunday' },
];

// Free-text tracing: each line of the box becomes its own practice row, with capital letters kept as typed.
export default function Seo2WordTracing(props: { source?: string; preset?: string }) {
  const [text, setText] = useState(props.preset ?? EXAMPLES[0].text);
  const [size, setSize] = useState<LineSize>('medium');
  const [practice, setPractice] = useState<Practice>('trace-write');
  const [startDots, setStartDots] = useState(true);
  const [model, setModel] = useState(true);
  const [paper, setPaper] = useState<Paper>('letter');
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [done, setDone] = useState(false);
  const member = useMember();
  const credit = !member.member;

  const lines = useMemo(() => text.split(/\r?\n/).map((l) => l.slice(0, MAX_CHARS)).filter((l) => cleanTraceText(l)).slice(0, MAX_LINES), [text]);
  const dropped = useMemo(() => /[^A-Za-z0-9 '’‘`.,?!\-\r\n]/.test(text), [text]);
  const pages = useMemo(() => buildWordPages({ lines, size, paper, practice, startDots, model, credit }), [lines, size, paper, practice, startDots, model, credit]);
  const svg = useMemo(() => pageToSvg(pages[0]), [pages]);
  const empty = lines.length === 0;

  const slug = (cleanTraceText(lines[0] ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)) || 'word';

  async function save() {
    setBusy(true);
    try {
      await savePdf(pages, `${slug}-tracing-worksheet.pdf`, 'Word tracing worksheet');
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); if (empty) return; !member.member && needsEmail() ? setGate(true) : save(); }}>
        <label class="block mb-3">
          <span class="block text-[15px] font-bold mb-2">Words or sentences, one per line</span>
          <textarea
            id="word-text"
            rows={6}
            value={text}
            autoComplete="off"
            spellcheck={false}
            placeholder={'cat\ndog\nI can read.'}
            onInput={(e) => { setText((e.target as HTMLTextAreaElement).value); setDone(false); }}
            class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-xl leading-snug text-ink placeholder:text-[#a3acbf] focus:border-rule focus:outline-none"
          />
          <span class="block text-[13px] text-muted mt-2">Stays on this device. Up to {MAX_LINES} lines. Capitals stay as you type them.</span>
          {dropped && <span class="block text-[13px] text-[#b4232c] mt-1">Some characters can’t be traced and were left out. Letters, numbers and . , ? ! ' - work.</span>}
        </label>
        <div class="mb-5 flex flex-wrap gap-2" role="group" aria-label="Examples">
          {EXAMPLES.map((ex) => (
            <button type="button" class="rounded-full border border-hairline bg-white px-3 py-1 text-[14px] text-muted hover:text-ink hover:border-rule" onClick={() => { setText(ex.text); setDone(false); }}>{ex.label}</button>
          ))}
        </div>
        <Segmented legend="Line size" name="word-size" value={size} onChange={setSize} options={[
          { v: 'large', label: 'Large', sub: 'ages 3–4' },
          { v: 'medium', label: 'Medium', sub: 'ages 5–6' },
          { v: 'small', label: 'Small', sub: 'ages 6+' },
        ]} />
        <Segmented legend="Practice" name="word-practice" value={practice} onChange={setPractice} options={[
          { v: 'trace-write', label: 'Trace, then write', sub: 'space to write' },
          { v: 'trace', label: 'Trace only', sub: 'every row dotted' },
        ]} />
        <div class="mb-5 grid gap-2 text-[15px]">
          <label class="flex items-center gap-3 cursor-pointer">
            <input id="word-dots" type="checkbox" class="size-4 accent-[#5b86d9]" checked={startDots} onChange={(e) => setStartDots((e.target as HTMLInputElement).checked)} />
            Green starting dots
          </label>
          <label class="flex items-center gap-3 cursor-pointer">
            <input id="word-model" type="checkbox" class="size-4 accent-[#5b86d9]" checked={model} onChange={(e) => setModel((e.target as HTMLInputElement).checked)} />
            Solid example before short words
          </label>
        </div>
        <Segmented legend="Paper" name="word-paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />
        {empty && <p class="mb-3 text-[14px] text-[#b4232c]" role="alert">Type at least one word to make a sheet.</p>}
        <button type="submit" disabled={busy || empty} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {busy ? 'Making your PDF…' : `Download PDF (${pages.length} ${pages.length === 1 ? 'page' : 'pages'})`}
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
        <div class="sheet-frame overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
        <figcaption class="mt-3 text-[13px] text-muted">
          Live preview{pages.length > 1 ? ` of page 1 of ${pages.length}` : ''}. The PDF prints at full size on {paper === 'letter' ? 'US Letter' : 'A4'} paper.
        </figcaption>
      </figure>

      <EmailGate open={gate} source={props.source ?? 'word-tracing'} onClose={() => setGate(false)} onDone={() => { setGate(false); save(); }} />
    </div>
  );
}
