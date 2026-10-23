"""On-site offer checks: the program card after a free download on school-style pages (coffee elsewhere), and the
slim program banner on the homeschool plan pages. Screenshots at 390 and 1280 to $QA_OUT/shots/email-*.png.
Run against a dev server from scripts/qa/up.sh:  python3 scripts/qa/email_ui.py"""
import os, re, sys
from playwright.sync_api import sync_playwright

BASE = f"http://127.0.0.1:{os.environ.get('QA_PORT', '4421')}"
OUT = os.path.join(os.environ.get('QA_OUT', '/tmp/tracelings-qa'), 'shots')
os.makedirs(OUT, exist_ok=True)
fails, passes = [], 0
def ok(c, m):
    global passes
    if c: passes += 1
    else: fails.append(m); print('FAIL', m)

def block(ctx):
    ctx.route(re.compile(r'.*(google-analytics|googletagmanager)\.com.*'), lambda r, q: r.fulfill(status=204, body=''))
    ctx.route(re.compile(r'.*/_vercel/.*'), lambda r, q: r.fulfill(status=200, content_type='application/javascript', body=''))
    ctx.route(re.compile(r'.*/api/(event|member/me).*'), lambda r, q: r.fulfill(status=200, content_type='application/json', body='{"member":false,"available":false}'))

with sync_playwright() as p:
    b = p.chromium.launch()
    for w in (390, 1280):
        ctx = b.new_context(viewport={'width': w, 'height': 900}, accept_downloads=True)
        block(ctx)
        # Skip the email gate; 5 earlier downloads would make the coffee card due on other pages.
        ctx.add_init_script("localStorage.setItem('tl-email-ok','1'); localStorage.setItem('tl-downloads','5');"
                           "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='astro-dev-toolbar{display:none!important}';document.head.append(s)});")
        pg = ctx.new_page()
        # 1) math page: program card, not coffee
        pg.goto(f'{BASE}/math-worksheets/ten-frames/', wait_until='networkidle')
        pg.get_by_role('button', name=re.compile('Download this worksheet')).first.click()
        card = pg.get_by_text('Get a week built around your child, free')
        card.wait_for(timeout=20000)
        ok(card.is_visible(), f'{w}: program card on math page')
        ok(pg.get_by_text('Enjoying the free printables?').count() == 0, f'{w}: no coffee card on math page')
        img = pg.locator('img[src*="find-egg-thumb"]').first
        ok(img.evaluate('i => i.complete && i.naturalWidth > 0'), f'{w}: card thumbnail loads')
        ok(pg.get_by_role('link', name='Build my free week').get_attribute('href') == '/program/', f'{w}: card button -> /program/')
        ok(pg.evaluate('document.documentElement.scrollWidth') <= w, f'{w}: no horizontal scroll')
        pg.screenshot(path=f'{OUT}/email-nudge-math-{w}.png')
        pg.get_by_role('button', name='Maybe later').click()
        ok(card.count() == 0, f'{w}: card closes')
        # 2) name tracing: coffee card stays there
        pg.goto(f'{BASE}/name-tracing/', wait_until='networkidle')
        pg.locator('input[type="text"]').first.fill('Sam')
        pg.get_by_role('button', name=re.compile('Download')).first.click()
        pg.get_by_text('Enjoying the free printables?').wait_for(timeout=20000)
        ok(pg.get_by_text('Get a week built around your child, free').count() == 0, f'{w}: no program card on name tracing')
        pg.screenshot(path=f'{OUT}/email-nudge-name-{w}.png')
        # 3) banner on the plan pages
        for path in ('/homeschool/preschool/', '/homeschool/kindergarten/', '/homeschool/christian/'):
            pg.goto(f'{BASE}{path}', wait_until='networkidle')
            ban = pg.locator('aside[aria-label="Personalized program"]').first
            ok(ban.is_visible() and 'Week 1 is free' in ban.inner_text(), f'{w}: banner on {path}')
            ok(pg.evaluate('document.documentElement.scrollWidth') <= w, f'{w}: no horizontal scroll {path}')
            ban.scroll_into_view_if_needed()
            pg.screenshot(path=f'{OUT}/email-banner-{path.strip("/").replace("/", "-")}-{w}.png')
        ctx.close()
    b.close()
print(f'{passes} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
