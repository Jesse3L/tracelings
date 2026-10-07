import { useState } from 'preact/hooks';
import { needsEmail, countDownload } from '../lib/gate';
import { PAPER, type Paper } from '../lib/sheet';
import { SITE } from '../config';
import EmailGate from './EmailGate';
import { useMember } from '../lib/member';

// Downloads one coloring page as a full-page PDF. The image is fetched from our own site and placed on Letter or A4.
export default function ColoringDownload(props: { src: string; slug: string; title: string }) {
  const [paper, setPaper] = useState<Paper>('letter');
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);
  const member = useMember();

  async function save() {
    setBusy(true);
    setError(false);
    try {
      const { PDFDocument, rgb, StandardFonts } = await import('@cantoo/pdf-lib');
      const bytes = await fetch(props.src).then((r) => r.arrayBuffer());
      const doc = await PDFDocument.create();
      doc.setTitle(props.title);
      doc.setCreator(SITE.name);
      const img = await doc.embedPng(bytes);
      const { w, h } = PAPER[paper];
      const page = doc.addPage([w, h]);
      const m = 30;
      const scale = Math.min((w - 2 * m) / img.width, (h - 2 * m - 16) / img.height);
      const iw = img.width * scale, ih = img.height * scale;
      page.drawImage(img, { x: (w - iw) / 2, y: m + 16 + (h - 2 * m - 16 - ih) / 2, width: iw, height: ih });
      if (!member.member) {
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const credit = `Free printable from ${SITE.domain}`;
        page.drawText(credit, { x: (w - font.widthOfTextAtSize(credit, 8)) / 2, y: m - 6, size: 8, font, color: rgb(0.54, 0.58, 0.65) });
      }
      const out = await doc.save();
      const url = URL.createObjectURL(new Blob([out], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${props.slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      countDownload(1);
      setDone(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="rounded-xl border border-hairline bg-[#eef2f8] p-5">
      <fieldset class="mb-4">
        <legend class="text-[15px] font-bold mb-2">Paper</legend>
        <div class="grid grid-cols-2 gap-2">
          {(['letter', 'a4'] as Paper[]).map((p) => (
            <label class={`cursor-pointer rounded-lg border px-2 py-2 text-center text-[15px] font-bold ${paper === p ? 'border-rule bg-white text-ink shadow-[inset_0_0_0_1px_var(--color-rule)]' : 'border-hairline bg-white/60 text-muted'}`}>
              <input type="radio" name="paper" class="sr-only" checked={paper === p} onChange={() => setPaper(p)} />
              {p === 'letter' ? 'US Letter' : 'A4'}
            </label>
          ))}
        </div>
      </fieldset>
      <button type="button" disabled={busy} onClick={() => (!member.member && needsEmail() ? setGate(true) : save())} class="btn-pencil w-full px-5 py-3.5 text-lg disabled:opacity-60">
        {busy ? 'Making your PDF…' : 'Download PDF'}
      </button>
      {done && <p class="mt-3 text-[14px] text-[#1f7a50]" role="status">Downloaded. Print at 100% size for a full page.</p>}
      {error && <p class="mt-3 text-[14px] text-[#b4232c]" role="alert">The download didn't work. Refresh the page and try again.</p>}
      <EmailGate open={gate} source="coloring-pages" onClose={() => setGate(false)} onDone={() => { setGate(false); save(); }} />
    </div>
  );
}
