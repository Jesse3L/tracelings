import { useState } from 'preact/hooks';
import type { Paper } from '../../lib/sheet';
import { buildCursiveChart } from '../../lib/alphabetChart';
import { loadFont } from '../../lib/fontshape';
import { savePdf } from '../../lib/download';
import { needsEmail } from '../../lib/gate';
import { useMember } from '../../lib/member';
import EmailGate from '../EmailGate';

// One-click PDF of the cursive alphabet chart (capital and lowercase A to Z).
export default function Seo2ChartButton(props: { source?: string }) {
  const [paper, setPaper] = useState<Paper>('letter');
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const member = useMember();

  async function save() {
    setBusy(true);
    setFailed(false);
    try {
      const font = await loadFont('cursive');
      await savePdf([buildCursiveChart(font, { paper, letters: 'pairs', credit: !member.member })], 'cursive-alphabet-chart.pdf', 'Cursive alphabet chart');
      setDone(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy} class="btn-pencil px-5 py-3 text-lg disabled:opacity-60" onClick={() => (!member.member && needsEmail() ? setGate(true) : save())}>
        {busy ? 'Making your PDF…' : 'Download the chart (PDF)'}
      </button>
      <label class="text-[15px] text-muted flex items-center gap-2">
        Paper
        <select value={paper} onChange={(e) => setPaper((e.target as HTMLSelectElement).value as Paper)} class="rounded-lg border border-hairline bg-white px-3 py-2 text-ink">
          <option value="letter">US Letter</option>
          <option value="a4">A4</option>
        </select>
      </label>
      {done && <p class="w-full text-[14px] text-[#1f7a50]" role="status">Downloaded. Print at 100% size.</p>}
      {failed && <p class="w-full text-[14px] text-[#b4232c]" role="alert">The letters didn’t load. Refresh the page and try again.</p>}
      <EmailGate open={gate} source={props.source ?? 'cursive-alphabet-chart'} onClose={() => setGate(false)} onDone={() => { setGate(false); save(); }} />
    </div>
  );
}
