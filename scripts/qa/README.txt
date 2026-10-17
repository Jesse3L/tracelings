QA scripts (playbook step 7). Python ones need playwright + chromium, bs4 and lxml; pdftoppm for contact sheets.

Serve a build:   npm run build && python3 -m http.server 4401 --directory dist/client
Point scripts:   QA_BASE=http://127.0.0.1:4401 QA_OUT=/tmp/qa  (output defaults to scripts/qa/out, which is gitignored)

  npx tsx scripts/qa/test-names.mts            name cleaning: accents, ' and -, McKenzie, non-Latin names
  npx tsx scripts/qa/render-fixes.mts <dir>    X/Q weeks, blank ten frames, long words, long coloring names as PDFs
  python3 scripts/qa/t_names.py names          downloads a PDF from every name tool for the hard names (QA_NAMES to override)
  python3 scripts/qa/t_ui.py                   menus, Escape, touch targets, buttons before hydration, image sizes, screenshots
  python3 scripts/qa/text_scan.py dist/client  ",,", "..", double spaces, dashes, ": ." and FAQ schema vs visible text
  python3 scripts/qa/contact.py '<glob>.pdf' out.png [dpi] [pages]   tiles PDF pages into one image to look at
  t_font.py, t_tracing.py, t_home.py, t_math.py, t_extra.py, crawl.py   the original QA download and crawl scripts
