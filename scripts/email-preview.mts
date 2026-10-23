// Renders every marketing email in src/lib/email/templates.ts to HTML (plus the plain-text version), writes an
// index.html linking them, and screenshots each at 390px and 700px wide with Playwright (Python).
//   npx tsx scripts/email-preview.mts [outDir]
// Default outDir: $EMAIL_PREVIEW_DIR or ./email-preview. Images point at the local public/email/ files so the
// screenshots show them before they are deployed; the real emails use https://tracelings.com/email/...
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { allTemplates, withUnsubscribe, SITE_URL } from '../src/lib/email/templates';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? process.env.EMAIL_PREVIEW_DIR ?? 'email-preview');
fs.mkdirSync(out, { recursive: true });

const all = allTemplates();
const rows: string[] = [];
for (const [key, t0] of Object.entries(all)) {
  const t = withUnsubscribe(t0, '#unsubscribe');
  const html = t.html.split(`${SITE_URL}/email/`).join(`file://${path.join(root, 'public', 'email')}/`);
  fs.writeFileSync(path.join(out, `${key}.html`), html);
  fs.writeFileSync(path.join(out, `${key}.txt`), `Subject: ${t.subject}\nPreview: ${t.preview}\n\n${t.text}\n`);
  rows.push(`<tr><td><a href="${key}.html">${key}</a></td><td>${t.subject}</td><td>${t.preview}</td><td><a href="${key}-390.png">390</a> <a href="${key}-700.png">700</a> <a href="${key}.txt">text</a></td></tr>`);
}
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Tracelings emails</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:24px}td{padding:6px 10px;border-bottom:1px solid #ddd;vertical-align:top}</style>
<h1>Tracelings emails (${Object.keys(all).length})</h1><table><tr><th>Template</th><th>Subject</th><th>Preview</th><th>Files</th></tr>${rows.join('')}</table>`);

const py = `
import sys, os, glob
from playwright.sync_api import sync_playwright
out = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in (390, 700):
        pg = b.new_page(viewport={'width': w, 'height': 800}, device_scale_factor=1)
        for f in sorted(glob.glob(os.path.join(out, '*.html'))):
            if f.endswith('index.html'): continue
            pg.goto('file://' + f)
            pg.wait_for_load_state('load')
            sw = pg.evaluate('document.documentElement.scrollWidth')
            if sw > w: print('HORIZONTAL SCROLL', os.path.basename(f), w, sw)
            pg.screenshot(path=f[:-5] + f'-{w}.png', full_page=True)
    b.close()
print('screenshots done')
`;
const r = spawnSync('python3', ['-c', py, out], { stdio: 'inherit' });
if (r.status !== 0) console.error('screenshots failed (needs: pip install playwright && playwright install chromium)');
console.log(`${Object.keys(all).length} emails written to ${out}`);
