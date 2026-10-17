# UI checks on a built site: header menus, sight word All/None touch targets, download buttons before hydration,
# image sizes vs displayed sizes, the name note, and phone + desktop screenshots of the pages changed by the QA fixes.
# Usage: QA_BASE=http://127.0.0.1:4401 QA_OUT=/some/dir python3 scripts/qa/t_ui.py
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from common import *

PAGES = ['/name-tracing/', '/name-coloring-pages/', '/bubble-letters/', '/sight-words/kindergarten/', '/letter-of-the-week/x/',
         '/homeschool/preschool/', '/math-worksheets/ten-frames/', '/math-worksheets/kindergarten/', '/membership/', '/coloring-pages/',
         '/coloring-pages/dinosaur-coloring-pages/t-rex-coloring-page/', '/support/', '/cursive-alphabet/', '/letter-tracing/', '/word-tracing/']
out = {}
def check(name, ok, detail=''):
    out[name] = {'ok': bool(ok), 'detail': detail}; print('PASS' if ok else 'FAIL', name, detail, flush=True)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # --- desktop: dropdown opened by hover stays open on click; Escape closes it
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); setup_routes(ctx, [])
    p = ctx.new_page(); p.goto(BASE + '/', wait_until='networkidle')
    dd = p.locator('[data-dd]').first; btn = dd.locator('button').first
    btn.hover(); p.wait_for_timeout(100)
    opened_by_hover = btn.get_attribute('aria-expanded') == 'true'
    btn.click(); p.wait_for_timeout(100)
    check('desktop: hover opens dropdown', opened_by_hover)
    check('desktop: click after hover keeps it open', btn.get_attribute('aria-expanded') == 'true')
    btn.click(); p.wait_for_timeout(100)
    check('desktop: second click closes it', btn.get_attribute('aria-expanded') == 'false')
    btn.click(); p.wait_for_timeout(100)
    check('desktop: third click opens it again', btn.get_attribute('aria-expanded') == 'true')
    p.keyboard.press('Escape'); p.wait_for_timeout(100)
    check('desktop: Escape closes dropdown', btn.get_attribute('aria-expanded') == 'false')
    # keyboard only: focus + Enter toggles
    p.mouse.move(5, 800); p.wait_for_timeout(300); btn.focus(); p.keyboard.press('Enter'); p.wait_for_timeout(100)
    check('desktop: Enter opens dropdown', btn.get_attribute('aria-expanded') == 'true')
    p.keyboard.press('Enter'); p.wait_for_timeout(100)
    check('desktop: Enter again closes dropdown', btn.get_attribute('aria-expanded') == 'false')
    ctx.close()

    # --- phone: menu toggle and Escape, touch targets
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); setup_routes(ctx, [])
    p = ctx.new_page(); p.goto(BASE + '/', wait_until='networkidle')
    t = p.locator('[data-menu-toggle]'); t.tap(); p.wait_for_timeout(100)
    check('phone: menu opens', not p.locator('#mobile-menu').is_hidden())
    p.keyboard.press('Escape'); p.wait_for_timeout(100)
    check('phone: Escape closes menu', p.locator('#mobile-menu').is_hidden() and t.get_attribute('aria-expanded') == 'false',
          'focus on toggle: ' + str(p.evaluate("document.activeElement.hasAttribute('data-menu-toggle')")))
    p.goto(BASE + '/sight-words/kindergarten/', wait_until='networkidle')
    p.locator('label', has_text='Choose words').first.click(); p.wait_for_timeout(200)
    sizes = [p.locator('button', has_text=x).first.bounding_box() for x in ['All', 'None']]
    check('phone: All/None at least 40px', all(s and s['height'] >= 40 and s['width'] >= 40 for s in sizes), json.dumps(sizes))
    ctx.close()

    # --- download buttons before hydration: block the island scripts, the button must be disabled and say Loading
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); setup_routes(ctx, [])
    ctx.route(re.compile(r'.*/_astro/.*\.js'), lambda r, q: r.abort())
    p = ctx.new_page()
    for u, label in [('/cursive-alphabet/', 'chart'), ('/sight-words/kindergarten/', 'flash'), ('/coloring-pages/dinosaur-coloring-pages/t-rex-coloring-page/', 'coloring'),
                     ('/bubble-letters/', 'bubble'), ('/letter-tracing/', 'a-z')]:
        p.goto(BASE + u, wait_until='load')
        btns = p.locator('button.btn-pencil').all()
        st = [(x.is_disabled(), x.inner_text().strip()[:30]) for x in btns]
        check(f'pre-hydration: {label} buttons disabled', st and all(d for d, _ in st if 'Download' in _ or 'Loading' in _), json.dumps(st))
    ctx.close()
    # and with scripts: they become enabled and islands use client:load
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); setup_routes(ctx, [])
    p = ctx.new_page()
    for u in ['/cursive-alphabet/', '/sight-words/kindergarten/', '/coloring-pages/dinosaur-coloring-pages/t-rex-coloring-page/', '/bubble-letters/', '/letter-tracing/']:
        p.goto(BASE + u, wait_until='load')
        vis = p.evaluate("[...document.querySelectorAll('astro-island')].filter(i => (i.getAttribute('client')||'')==='visible').map(i=>i.getAttribute('component-url'))")
        p.wait_for_timeout(2500)
        en = [x.inner_text().strip()[:30] for x in p.locator('button.btn-pencil').all() if not x.is_disabled()]
        check(f'hydrated: {u}', len(en) > 0 and not any('Download' in v for v in vis), f'enabled={en} visible-islands={vis}')
    # name note for a non-Latin name
    p.goto(BASE + '/name-tracing/', wait_until='networkidle'); p.fill('#tracer-name', '小明'); p.wait_for_timeout(200)
    check('name note shown for 小明', p.locator('text=Our tracing letters are A to Z').count() > 0)
    p.fill('#tracer-name', 'McKenzie'); p.wait_for_timeout(200)
    check('capital first keeps McKenzie', p.locator('fieldset:has(legend:text("Letter style")) label').first.inner_text().find('McKenzie') >= 0)
    p.screenshot(path=f'{QA}/shots/ui_name_mckenzie.png')
    p.fill('#tracer-name', '小明'); p.wait_for_timeout(200)
    p.locator('#tracer-name').scroll_into_view_if_needed(); p.screenshot(path=f'{QA}/shots/ui_name_note.png')
    # image sizes
    for u in ['/math-worksheets/kindergarten/', '/coloring-pages/dinosaur-coloring-pages/t-rex-coloring-page/']:
        p.goto(BASE + u, wait_until='networkidle'); p.evaluate('window.scrollTo(0, document.body.scrollHeight)'); p.wait_for_timeout(800)
        imgs = p.evaluate("[...document.images].filter(i=>i.complete && i.naturalWidth && !i.src.endsWith('.svg')).map(i=>[i.currentSrc.split('/').pop(), i.naturalWidth, Math.round(i.getBoundingClientRect().width)])")
        big = [x for x in imgs if x[2] and x[1] > 2.5 * x[2] and x[1] > 300]
        check(f'images sized: {u}', not big, json.dumps(big or imgs[:4]))
    ctx.close()

    # --- screenshots
    for vw, vh, tag in [(390, 844, 'phone'), (1280, 900, 'desk')]:
        ctx = b.new_context(viewport={'width': vw, 'height': vh}, is_mobile=tag == 'phone', has_touch=tag == 'phone'); setup_routes(ctx, [])
        p = ctx.new_page()
        for u in PAGES:
            p.goto(BASE + u, wait_until='networkidle'); p.evaluate('window.scrollTo(0, document.body.scrollHeight)'); p.wait_for_timeout(500); p.evaluate('window.scrollTo(0,0)'); p.wait_for_timeout(300)
            sw = p.evaluate('document.documentElement.scrollWidth')
            if sw > vw: check(f'{tag} no horizontal scroll {u}', False, str(sw))
            p.screenshot(path=f"{QA}/shots/{tag}{u.strip('/').replace('/', '_') or 'home'}.png", full_page=True)
        ctx.close()
        check(f'{tag} screenshots', True, str(len(PAGES)))
    b.close()
json.dump(out, open(f'{QA}/ui-results.json', 'w'), indent=1)
print(sum(not v['ok'] for v in out.values()), 'failures')
