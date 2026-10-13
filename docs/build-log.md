# Build Log

One entry per growth run, newest last. Keep each entry to a few lines.

## 2026-10-13: Month 1 homeschool foundation
- Built `/homeschool/`, `/homeschool/preschool/`, `/homeschool/kindergarten/` with a weekly pack maker (plan page plus Monday to Friday pages, personalized with the child's name, built in the browser).
- Added 36-week Pre-K and Kindergarten plans in `src/lib/homeschool.ts` (letters in phonics order, review weeks, word families, Dolch sight words, ten frames, addition within 5 and 10).
- Added `/letter-of-the-week/` and 26 letter pages, a kindergarten curriculum guide in `/learn/`, previews, nav and footer links, membership rows (members print every kid or 4 weeks at once).
- Next in queue: Pre-K math worksheets page.

## 2026-10-13: Faith track
- Added an optional faith track to every weekly pack: a Bible verse of the week on the plan page and a verse copywork page (Pre-K traces a short phrase; Kindergarten traces the full verse, then copies it). Checkbox in the pack maker, remembered per device, off by default except on the Christian page.
- New page `/homeschool/christian/` with all 36 verses. Added colon and semicolon tracing glyphs.
- AI reading stories on hold per Jesse.
- Switched the faith track from KJV to the Berean Standard Bible (public domain since 2023) for easier reading. NIV is copyrighted and needs Biblica's written permission for website use.

## 2026-10-13: Pre-K math worksheets
- Built `/math-worksheets/pre-k/` with a worksheet maker (`src/lib/mathSheets.ts`, `src/components/MathSheets.tsx`): count and color (the plan's Thursday page, any number 1 to 20), ten frames, count and circle, more or fewer, missing numbers. Ranges 1 to 5, 1 to 10, 1 to 20, a New problems button, the child's name on the Name line (stays in the browser).
- Free: every type and range, one page at a time. Members: five different pages in one PDF, or one page for every kid on their list, no footer line.
- Keywords (Ubersuggest US): preschool math worksheets 3,600 / SD 27, pre k math worksheets 2,900 / 25, counting worksheets for preschool 1,000 / 28, ten frame worksheets 720 / 20.
- Linked from `/homeschool/`, `/homeschool/preschool/` and every letter of the week page (opens the count and color page for that week's number). Exported the page helpers in `homeschool.ts` for reuse. Added preview `pre-k-math-ten-frames.webp`.
- Next in queue: kindergarten addition worksheet maker.
