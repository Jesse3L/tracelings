import { useEffect, useMemo, useState } from 'preact/hooks';
import type { LineSize, Paper, Practice, Page } from '../lib/sheet';
import { pageToSvg } from '../lib/render';
import { loadFont, type LoadedFont } from '../lib/fontshape';
import { buildCursiveSheet, cleanCursiveText } from '../lib/cursive';
import { buildColoringPage, type Theme } from '../lib/coloring';
import { needsEmail } from '../lib/gate';
import { savePdf } from '../lib/download';
import { Segmented } from './Tracer';
import EmailGate from './EmailGate';
import { useMember } from '../lib/member';
import RosterPanel from './RosterPanel';
import { useRoster } from '../lib/roster';

type Kind = 'cursive' | 'coloring';

export default function FontTool(props: { kind: Kind; preset?: string; source?: string }) {
  const kind = props.kind;
  const [font, setFont] = useState<LoadedFont | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState(props.preset ?? '');
  const [size, setSize] = useState<LineSize>('large');
  const [practice, setPractice] = useState<Practice>('trace-write');
  const [modelRow, setModelRow] = useState(true);
  const [paper, setPaper] = useState<Paper>('letter');
  const [theme, setTheme] = useState<Theme>('stars');
  const [caps, setCaps] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [done, setDone] = useState(false);
  const member = useMember();
  const credit = !member.member;
  const [roster] = useRoster();
  const [useList, setUseList] = useState(false);
  useEffect(() => { if (roster.length) setUseList(true); }, [roster.length > 0]);
  const listNames = member.member && useList ? roster.slice(0, member.maxNames ?? 8) : [];
  const source = props.source ?? (kind === 'cursive' ? 'cursive' : 'name-coloring');

  useEffect(() => {
    loadFont(kind === 'cursive' ? 'cursive' : 'bubble').then(setFont).catch(() => setFailed(true));
    if (!props.preset) {
      try {
        const n = sessionStorage.getItem('tl-name');
        if (n) setText(n);
      } catch { /* storage unavailable */ }
    }
  }, []);

  const page: Page | null = useMemo(() => {
    if (!font) return null;
    return kind === 'cursive'
      ? buildCursiveSheet(font, { text: listNames[0] ?? text, size, paper, practice, modelRow, credit })
      : buildColoringPage(font, { name: (listNames[0] ?? text).slice(0, 16), theme, paper, caps, credit });
  }, [font, text, size, paper, practice, modelRow, theme, caps, credit, listNames[0]]);
  const svg = useMemo(() => (page ? pageToSvg(page) : ''), [page]);

  const slug = cleanCursiveText(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || (kind === 'cursive' ? 'cursive' : 'name');
  const filename = kind === 'cursive' ? `${slug}-cursive-worksheet.pdf` : `${slug}-coloring-page.pdf`;

  async function save() {
    if (!page) return;
    setBusy(true);
    try {
      if (listNames.length && font) {
        const pages = listNames.map((n) => kind === 'cursive'
          ? buildCursiveSheet(font, { text: n, size, paper, practice, modelRow, credit })
          : buildColoringPage(font, { name: n.slice(0, 16), theme, paper, caps, credit }));
        await savePdf(pages, kind === 'cursive' ? 'class-cursive-worksheets.pdf' : 'class-name-coloring-pages.pdf', kind === 'cursive' ? 'Class cursive worksheets' : 'Class name coloring pages');
      } else {
        await savePdf([page], filename, kind === 'cursive' ? 'Cursive practice worksheet' : 'Name coloring page');
      }
      setDone(true);
    }
    finally { setBusy(false); }
  }

  return (
    <div class="grid gap-8 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <form class="rounded-xl border border-hairline bg-[#eef2f8] p-5 sm:p-6" onSubmit={(e) => { e.preventDefault(); !member.member && needsEmail() ? setGate(true) : save(); }}>
        <label class="block mb-5">
          <span class="block text-[15px] font-bold mb-2">{kind === 'cursive' ? 'Name, word or short sentence' : 'Name or letter'}</span>
          <input
            id={`${kind}-text`}
            type="text"
            value={text}
            maxLength={kind === 'cursive' ? 40 : 16}
            autoComplete="off"
            spellcheck={false}
            placeholder={kind === 'cursive' ? 'Type a name or word' : 'Type a name'}
            onInput={(e) => setText((e.target as HTMLInputElement).value)}
            class="w-full rounded-lg border border-hairline bg-white px-4 py-3 text-2xl text-ink placeholder:text-[#a3acbf] focus:border-rule focus:outline-none"
          />
          <span class="block text-[13px] text-muted mt-2">Stays on this device.</span>
        </label>

        {member.member && (
          <RosterPanel use={useList} onUse={setUseList} maxNames={member.maxNames ?? 8} what={kind === 'cursive' ? 'a cursive sheet' : 'a coloring page'} />
        )}

        {kind === 'cursive' ? (
          <>
            <Segmented legend="Line size" name="size" value={size} onChange={setSize} options={[
              { v: 'large', label: 'Large', sub: 'starting out' },
              { v: 'medium', label: 'Medium', sub: 'most kids' },
              { v: 'small', label: 'Small', sub: 'confident' },
            ]} />
            <Segmented legend="Practice rows" name="practice" value={practice} onChange={setPractice} options={[
              { v: 'trace-write', label: 'Trace, then write', sub: 'blank rows last' },
              { v: 'trace', label: 'Trace only', sub: 'every row gray' },
            ]} />
            <label class="mb-5 flex items-center gap-3 cursor-pointer text-[15px]">
              <input id="cursive-model" type="checkbox" class="size-4 accent-[#5b86d9]" checked={modelRow} onChange={(e) => setModelRow((e.target as HTMLInputElement).checked)} />
              Solid example on the first row
            </label>
          </>
        ) : (
          <>
            <Segmented legend="Shapes around the name" name="theme" value={theme} onChange={setTheme} options={[
              { v: 'stars', label: 'Stars' },
              { v: 'hearts', label: 'Hearts' },
              { v: 'flowers', label: 'Flowers' },
              { v: 'bubbles', label: 'Bubbles' },
            ]} />
            <label class="mb-5 flex items-center gap-3 cursor-pointer text-[15px]">
              <input id="coloring-caps" type="checkbox" class="size-4 accent-[#5b86d9]" checked={caps} onChange={(e) => setCaps((e.target as HTMLInputElement).checked)} />
              All capital letters
            </label>
          </>
        )}

        <Segmented legend="Paper" name="paper" value={paper} onChange={setPaper} options={[{ v: 'letter', label: 'US Letter' }, { v: 'a4', label: 'A4' }]} />

        <button type="submit" disabled={busy || !page} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
          {busy ? 'Making your PDF…' : listNames.length ? `Download ${listNames.length} ${kind === 'cursive' ? 'sheets' : 'pages'}` : 'Download PDF'}
        </button>
        {done && <p class="mt-4 text-[14px] text-[#1f7a50]" role="status">Downloaded. Check your downloads folder, then print at 100% size.</p>}
        <div class="mt-4 rounded-lg border border-dashed border-rule/60 bg-white/70 p-3 text-[14px] leading-snug text-muted">
          {member.member ? (
            <><span class="font-bold text-ink">Member printing is on.</span> No footer line on your sheets. <a href="/class-pack/" class="text-[#2f5fc4] underline underline-offset-2">Make a class pack</a> · <a href="/account/" class="text-[#2f5fc4] underline underline-offset-2">Your account</a></>
          ) : (
            <><span class="font-bold text-ink">Members</span> get every printable with no footer line, plus class lists and new themes as they launch.{' '}
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

      <EmailGate open={gate} source={source} onClose={() => setGate(false)} onDone={() => { setGate(false); save(); }} />
    </div>
  );
}
