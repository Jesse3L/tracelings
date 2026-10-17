import sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
from common import *
urls = [u.strip() for u in open(QA + '/urls.txt') if u.strip()]
out = []
os.makedirs(QA + '/shots', exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch()
    for vw, vh, tag in [(1280, 900, 'desk'), (390, 844, 'phone')]:
        ctx = b.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=1, is_mobile=(tag=='phone'), has_touch=(tag=='phone'))
        log = []
        setup_routes(ctx, log)
        for u in urls:
            page = ctx.new_page()
            errs, reqs, fails = [], [], []
            attach(page, errs, reqs, fails)
            try:
                page.goto(BASE + u, wait_until='networkidle', timeout=30000)
                page.wait_for_timeout(400)
            except Exception as e:
                errs.append('GOTO ' + str(e))
            info = page.evaluate('''() => {
              const W = document.documentElement.clientWidth;
              const sw = document.documentElement.scrollWidth;
              const off = [];
              for (const el of document.querySelectorAll('body *')) {
                const r = el.getBoundingClientRect();
                if (r.width && r.right > W + 1 && getComputedStyle(el).position !== 'fixed') {
                  let p = el.parentElement, clipped = false;
                  while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'auto' || o === 'scroll' || o==='clip') { const pr=p.getBoundingClientRect(); if (pr.right <= W+1) { clipped = true; break; } } p = p.parentElement; }
                  if (!clipped) off.push(el.tagName + '.' + (el.className && el.className.baseVal === undefined ? String(el.className).slice(0,60) : '') + ' r=' + Math.round(r.right));
                }
              }
              const small = [];
              if (W < 500) for (const el of document.querySelectorAll('button, a.btn-pencil, input, select')) { const r = el.getBoundingClientRect(); if (r.width && r.height && r.height < 24 && el.type !== 'checkbox' && el.type!=='radio') small.push(el.tagName + ':' + (el.textContent||'').trim().slice(0,30) + ' h=' + Math.round(r.height)); }
              return { sw, W, off: off.slice(0, 8), small: small.slice(0, 5), title: document.title, h1: document.querySelector('h1')?.textContent?.trim() };
            }''')
            shot = f'{QA}/shots/{tag}{u.strip("/").replace("/", "_") or "home"}.png'
            if not u.startswith('/learn/') or u == '/learn/':
                try: page.screenshot(path=shot, full_page=True)
                except Exception as e: errs.append('SHOT ' + str(e))
            fails2 = [f for f in fails if '_vercel' not in f]
            out.append({'u': u, 'vp': tag, 'errs': errs, 'fails': fails2, **info, 'shot': shot})
            # detach listeners
            page.close()
            print(tag, u, 'ERR' if errs else '', 'FAIL' if fails2 else '', 'HSCROLL' if info['sw'] > info['W'] else '', flush=True)
        ctx.close()
    b.close()
json.dump(out, open(QA + '/crawl.json', 'w'), indent=1)
