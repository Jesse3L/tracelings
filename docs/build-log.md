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

## 2026-10-15: Ten frame printables and worksheets
- Built `/math-worksheets/ten-frames/` on the same maker as Pre-K math (`series: 'ten-frames'`): blank ten frames (one big counting mat, a double ten frame, six small frames), How many? (1 to 5, 1 to 10, 11 to 20 with two frames), Show the number, Make 10, and ten frame addition (within 5, within 10, sums 11 to 20 in two colors so the make-a-ten step shows).
- Free: every type and range, one page at a time. Members: five different pages in one PDF or one page per kid, no footer line. Names stay in the browser.
- Keywords (Ubersuggest US): ten frame printable 2,900 / SD 28, printable ten frame 1,600 / 26, double ten frame 1,300 / 17, blank ten frame 1,300 / 26, ten frame worksheets 720 / 20. Named the page around "ten frame printables" since it beats "ten frame worksheets" by 4x.
- Linked from `/math-worksheets/pre-k/`, `/homeschool/`, `/homeschool/preschool/`, `/homeschool/kindergarten/`. Added preview `ten-frame-worksheet-make-10.webp`.
- Next in queue: Kindergarten more or less worksheets.
- Before publishing: phone and desktop screenshots of the new page, and a site-wide scan of the built HTML found 8 links missing a space ("see the<a>", "preschool</a>and"), 6 of them already live on older pages. Fixed all of them. Jesse okayed publishing growth builds directly once they render correctly; the playbook now says to merge after the checks.

## 2026-10-16: Kindergarten math worksheets (hub, more or less, addition)
- Built three pages on the same math maker (`src/lib/mathSheets.ts`, `src/components/MathSheets.tsx`), with two new series:
  - `/math-worksheets/more-or-less/` (`series: 'more-less'`): compare groups with pictures (more or fewer), compare numbers (circle the bigger or smaller, with dots up to 10), greater than / less than with a symbol key and a few equal pairs, and one more, one less. Numbers 1 to 5, 1 to 10, 1 to 20.
  - `/math-worksheets/kindergarten-addition/` (`series: 'k-addition'`): picture addition, number line addition, addition facts (12 per page) and subtraction with pictures (crossed-out pictures). Within 5, 10 and 20.
  - `/math-worksheets/kindergarten/`: hub linking every math maker with its preview, plus a free 6-page sampler PDF for everyone (`src/components/MathSampler.tsx`), with the child's name.
- Free: every type and range, one page at a time, and the whole sampler. Members: five different pages in one PDF or one page per kid, no footer line. Names stay in the browser (checked: no request carried a typed test name).
- Keywords (Ubersuggest US): kindergarten math worksheets 22,200 / SD 47, kindergarten math worksheets free 4,400 / 27, free printable kindergarten math worksheets 1,300 / 25; kindergarten addition worksheets 3,600 / 26 (beat the queue's "addition kindergarten math worksheets" at 1,000, so the page is named for it), addition worksheets for kindergarten 1,300 / 24, kindergarten subtraction worksheets 2,900 / 23; kindergarten more or less worksheets 390 / 22, greater than less than kindergarten worksheet 390 / 26, one more one less worksheets 390 / 24.
- Each page opens with a one or two sentence plain answer of what it gives the parent, and has an FAQ with FAQPage schema (same Faqs component as the homeschool pages).
- Linked from `/homeschool/`, `/homeschool/kindergarten/` (new "Kindergarten math worksheets for extra practice" section), `/math-worksheets/pre-k/` and `/math-worksheets/ten-frames/`. Previews `kindergarten-greater-than-less-than-worksheet.webp` and `kindergarten-picture-addition-worksheet.webp`. Added `scripts/render-check.mts` (renders every new type at Letter and A4 with a long name, and flags anything drawn off the page).
- Fixed a stray double comma on `/homeschool/kindergarten/` ("easy modern English,,").
- Next in queue: Pre-K math page in the weekly pack; new todo items for a kindergarten subtraction page (2,900 / SD 23), a matching math page in the K weekly pack, and number bonds.
