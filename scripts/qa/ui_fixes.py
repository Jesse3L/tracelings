# UI regression checks for the QA program fixes (N4, N5, M7, M8, N6, M2 warning, M1 fallback), with screenshots.
# Run with scripts/qa/up.sh running:  python3 scripts/qa/ui_fixes.py [390|1280] [m1]
#   m1: the server was started with storage down (QA_EXTRA_ENV=PROGRAM_STORE_DOWN=1 scripts/qa/up.sh), so only the
#       storage-down checks run.
import json, os, re, sys
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:' + os.environ.get('QA_PORT', '4421'); Q = os.environ.get('QA_OUT', '/tmp/tracelings-qa')
VW = int(sys.argv[1]) if len(sys.argv) > 1 else 1280
ONLY_M1 = len(sys.argv) > 2 and sys.argv[2] == 'm1'
S = f'{Q}/shots/fixes-{VW}'; os.makedirs(S, exist_ok=True)
out = []; fails = 0
def T(name, ok, info=''):
    global fails
    fails += 0 if ok else 1
    out.append(f"{'PASS' if ok else 'FAIL'} {name}{': ' + str(info)[:240] if info else ''}"); print(out[-1], flush=True)
def shot(page, tag): page.screenshot(path=f'{S}/{tag}.png', full_page=True)
def hscroll(page):
    w = page.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]'); return w[0] > w[1] + 1
def kid(cid, age=5, ints=('dinosaurs',), skills=None):
    return {'id': cid, 'ageYears': age, 'skills': skills or {}, 'interests': list(ints), 'daysPerWeek': 5, 'minutesPerDay': 15, 'faith': False, 'createdAt': '2026-10-16T00:00:00.000Z'}
_api_pages = {}
def api(ctx, method, path, body=None):
    # Through a page of this context: the session cookie is Secure, which the browser sends to 127.0.0.1 but
    # Playwright's request context does not.
    pg = _api_pages.get(id(ctx))
    if pg is None or pg.is_closed():
        pg = _api_pages[id(ctx)] = ctx.new_page(); pg.goto(B + '/robots.txt')
    r = pg.evaluate("""async ([m, p, b]) => { const r = await fetch(p, { method: m, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: b === null ? undefined : JSON.stringify(b) });
      let j = {}; try { j = await r.json(); } catch (e) {} return [r.status, j]; }""", [method, path, body])
    return r[0], r[1]
def ls(page): return json.loads(page.evaluate("localStorage.getItem('tl-program')") or 'null')
def h2(page): return page.locator('#placement section h2').first.inner_text() if page.locator('#placement section h2').count() else ''

with sync_playwright() as pw:
    b = pw.chromium.launch()
    def new_ctx():
        c = b.new_context(viewport={'width': VW, 'height': 900 if VW > 500 else 844}, accept_downloads=True)
        c.add_init_script("try{localStorage.setItem('tl-email-ok','1')}catch(e){}")
        return c

    if ONLY_M1:
        # ---------- M1: storage down ----------
        ctx = new_ctx(); page = ctx.new_page()
        s, j = api(ctx, 'POST', '/api/member/signin/', {'email': 'member@example.com', 'last4': '4242'})
        st, j = api(ctx, 'GET', '/api/program/family/')
        ra = _api_pages[id(ctx)].evaluate("fetch('/api/program/family/').then(r => r.headers.get('retry-after'))")
        T('M1 family GET with storage down is a friendly 503 with a retry hint', st == 503 and ra and 'temporarily unavailable' in json.dumps(j), f'{st} retry-after={ra} {json.dumps(j)[:160]}')
        page.goto(B + '/robots.txt', wait_until='load')
        page.evaluate("([c,n])=>localStorage.setItem('tl-program', JSON.stringify({children:[c],names:{[c.id]:n}}))", [kid('c_offline1', ints=('space',)), 'Maya'])
        page.goto(B + '/account/', wait_until='networkidle'); page.wait_for_timeout(1500)
        txt = page.locator('main').inner_text()
        T('M1 dashboard says saved plans are unavailable and offers a standard week', 'Your saved plans are temporarily unavailable; here’s this week from the standard plan.' in txt and page.get_by_role('button', name=re.compile('^Print week')).count() == 1, txt[:300])
        shot(page, 'm1-storage-down'); T('M1 no horizontal scroll', not hscroll(page))
        try:
            with page.expect_download(timeout=120000) as d: page.get_by_role('button', name=re.compile('^Print week')).click()
            T('M1 prints a week from the local profile', d.value.suggested_filename.startswith('maya-week-1'), d.value.suggested_filename)
        except Exception as e: T('M1 prints a week from the local profile', False, str(e)[:160])
        page.wait_for_timeout(500); shot(page, 'm1-after-print')
        ctx.close(); b.close()
        print(f'\n{fails} failed'); open(f'{Q}/logs/ui-fixes-m1-{VW}.txt', 'w').write('\n'.join(out) + f'\n\n{fails} failed\n'); sys.exit(0)

    # ---------- N4 / N5: placement step pills and reload ----------
    ctx = new_ctx(); page = ctx.new_page()
    page.goto(B + '/program/', wait_until='networkidle'); page.wait_for_timeout(500)
    page.fill('#pc-name', 'Maya'); page.locator('label:has(input[name=pc-age])').nth(1).click()
    page.get_by_role('button', name='Next: what they can do').click(); page.wait_for_timeout(200)
    page.reload(wait_until='networkidle'); page.wait_for_timeout(600)
    T('N5 reload on "what they can do" stays on that step', 'What can' in h2(page), h2(page))
    page.get_by_role('button', name='Next: what they love').click(); page.wait_for_timeout(200)
    page.get_by_role('button', name='Space', exact=True).click()
    page.reload(wait_until='networkidle'); page.wait_for_timeout(600)
    T('N5 reload on "what they love" stays there with the pick kept', 'What does Maya love' in h2(page) and page.get_by_role('button', name='Space', exact=True).get_attribute('aria-pressed') == 'true', h2(page))
    page.get_by_role('button', name='Next: your week').click(); page.wait_for_timeout(200)
    page.reload(wait_until='networkidle'); page.wait_for_timeout(600)
    T('N5 reload on "your week" stays there', 'week look like' in h2(page), h2(page))
    page.get_by_role('button', name=re.compile('^See ')).click(); page.wait_for_selector('text=Download week 1', timeout=20000); page.wait_for_timeout(500)
    page.reload(wait_until='networkidle'); page.wait_for_timeout(1500)
    T('N5 reload on the plan stays on the plan', page.locator('text=Download week 1').count() > 0)
    page.get_by_role('button', name='Change answers').click(); page.wait_for_timeout(300)
    page.get_by_role('button', name=re.compile('Their plan')).click(); page.wait_for_timeout(800)
    T('N4 after "Change answers" the "Their plan" pill goes back to the plan', page.locator('text=Download week 1').count() > 0, h2(page))
    shot(page, 'n4-plan-after-pill')
    ctx.close()

    # ---------- N6: legacy plan account page ----------
    ctx = new_ctx(); page = ctx.new_page()
    api(ctx, 'POST', '/api/member/signin/', {'email': 'classroom@example.com', 'last4': '5555'})
    page.goto(B + '/account/', wait_until='networkidle'); page.wait_for_selector('text=Your membership', timeout=20000); page.wait_for_timeout(800)
    txt = page.locator('main').inner_text()
    T('N6 legacy member sees the program, not "Names per PDF"', 'Names per PDF' not in txt and 'Tracelings at Home, Personalized' in txt, txt[txt.find('Your membership'):][:240])
    T('N6 class pack link kept under "Your old plan also includes"', 'Your old plan also includes' in txt and page.locator('a[href="/class-pack/"]').count() >= 1)
    shot(page, 'n6-legacy-account'); T('N6 no horizontal scroll', not hscroll(page))
    ctx.close()

    # ---------- M7: a 5th child via placement; names keyed by id ----------
    ctx = new_ctx(); page = ctx.new_page()
    api(ctx, 'POST', '/api/member/signin/', {'email': 'member@example.com', 'last4': '4242'})
    st, fam = api(ctx, 'GET', '/api/program/family/')
    api(ctx, 'POST', '/api/program/family/', {'remove': [c['id'] for c in fam.get('children', [])][:4]})
    kids = [kid(f'c_ui{n}kid', ints=(t,)) for n, t in zip('abcd', ['dinosaurs', 'trains', 'bugs', 'pets'])]
    s, j = api(ctx, 'POST', '/api/program/family/', {'children': kids})
    names = {'c_uiakid': 'Ava', 'c_uibkid': 'Ben', 'c_uickid': 'Cal', 'c_uidkid': 'Dee'}
    page.goto(B + '/program/', wait_until='domcontentloaded')
    page.evaluate("([k,n])=>{localStorage.setItem('tl-program', JSON.stringify({children:k,names:n})); sessionStorage.clear()}", [kids, names])
    page.goto(B + '/program/?return=%2Faccount%2F', wait_until='networkidle'); page.wait_for_timeout(1200)
    T('M7 placement for a full family shows the 4-kid limit up front', page.locator('text=Your plan covers up to 4 kids').count() > 0)
    shot(page, 'm7-full-family-top')
    page.fill('#pc-name', 'Fifth'); page.locator('label:has(input[name=pc-age])').nth(2).click()
    page.get_by_role('button', name='Next: what they can do').click(); page.get_by_role('button', name='Next: what they love').click()
    page.get_by_role('button', name='Sports', exact=True).click(); page.get_by_role('button', name='Next: your week').click()
    page.get_by_role('button', name=re.compile('^See ')).click(); page.wait_for_selector('text=Download week 1', timeout=20000); page.wait_for_timeout(800)
    T('M7 no "Save and go to my account" for a 5th child', page.get_by_role('button', name=re.compile('^Save and go')).count() == 0 and page.locator('text=Your account already has 4 kids').count() > 0)
    shot(page, 'm7-full-family-plan')
    l = ls(page)
    T('M7 every saved child keeps their name on this device', all(l['names'].get(k) == v for k, v in names.items()) and 'Fifth' not in json.dumps(l), json.dumps(l['names']))
    page.goto(B + '/account/', wait_until='networkidle'); page.wait_for_selector('text=This week', timeout=20000); page.wait_for_timeout(800)
    tabs = page.get_by_role('tab').all_inner_texts()
    T('M7 dashboard tabs show all four names', tabs[:4] == ['Ava', 'Ben', 'Cal', 'Dee'], tabs)

    # ---------- M8: remove deletes the local entry ----------
    page.get_by_role('tab', name='Ben').click(); page.wait_for_timeout(300)
    page.get_by_role('button', name='Remove this child').click(); page.get_by_role('button', name='Yes, remove').click(); page.wait_for_timeout(1500)
    l = ls(page)
    T('M8 removing a child deletes its profile and name on this device (no blank stub)', 'c_uibkid' not in json.dumps(l) and len(l['children']) == 3, json.dumps(l)[:200])

    # ---------- M2: edit warns before a track change; normal edit keeps the week ----------
    api(ctx, 'POST', '/api/program/family/', {'current': {'c_uiakid': 4}})
    st, fam = api(ctx, 'GET', '/api/program/family/'); lvl = fam['plans']['c_uiakid']['level']
    page.goto(B + '/account/?child=c_uiakid', wait_until='networkidle'); page.wait_for_selector('text=This week', timeout=20000); page.wait_for_timeout(600)
    page.get_by_role('link', name='Edit answers or interests').click(); page.wait_for_selector('#pc-name'); page.wait_for_timeout(1200)
    page.get_by_role('button', name='Next: what they can do').click(); page.get_by_role('button', name='Next: what they love').click()
    page.get_by_role('button', name='Ocean animals', exact=True).click(); page.get_by_role('button', name='Next: your week').click()
    page.get_by_role('button', name=re.compile('^See ')).click(); page.wait_for_selector('text=Save and go back to my account', timeout=20000)
    T('M2 a same-track edit says the child keeps their place', page.locator('text=keeps their place in the plan').count() > 0)
    page.get_by_role('button', name='Save and go back to my account').first.click(); page.wait_for_url('**/account/**'); page.wait_for_timeout(2500)
    st, fam = api(ctx, 'GET', '/api/program/family/'); pl = fam['plans']['c_uiakid']
    T('M2 after adding an interest the plan is still on week 4', pl['current'] == 4 and pl['level'] == lvl, f"current={pl['current']}")
    T('M2 the dashboard says so', page.locator('text=/still on week 4/').count() > 0, page.locator('main [role=status]').all_inner_texts())
    shot(page, 'm2-after-edit')
    page.get_by_role('link', name='Edit answers or interests').click(); page.wait_for_selector('#pc-name'); page.wait_for_timeout(1200)
    page.get_by_role('button', name='Next: what they can do').click()
    page.locator('label:has(input[name=pc-letter-names])').nth(1).click()  # "Learning" moves a 5 year old to Kindergarten
    page.get_by_role('button', name='Next: what they love').click(); page.get_by_role('button', name='Next: your week').click()
    page.get_by_role('button', name=re.compile('^See ')).click(); page.wait_for_selector('text=Save and go back to my account', timeout=20000)
    page.get_by_role('button', name='Save and go back to my account').first.click(); page.wait_for_timeout(500)
    T('M2 a track change asks first: "This moves Ava to the Kindergarten track and starts the plan over. Continue?"', page.locator('text=This moves Ava to the Kindergarten track and starts the plan over. Continue?').count() > 0)
    shot(page, 'm2-restart-confirm')
    page.get_by_role('button', name='Keep the current plan').click(); page.wait_for_timeout(300)
    st, fam = api(ctx, 'GET', '/api/program/family/')
    T('M2 "Keep the current plan" saves nothing', fam['plans']['c_uiakid']['current'] == 4 and fam['plans']['c_uiakid']['level'] == lvl)
    page.get_by_role('button', name='Save and go back to my account').first.click(); page.wait_for_timeout(300)
    page.get_by_role('button', name='Yes, start the new plan').click(); page.wait_for_url('**/account/**'); page.wait_for_timeout(2500)
    st, fam = api(ctx, 'GET', '/api/program/family/'); pl = fam['plans']['c_uiakid']
    T('M2 "Yes" starts the Kindergarten plan at week 1', pl['level'] == 'kindergarten' and pl['current'] == 1, f"{pl['level']} {pl['current']}")
    shot(page, 'm2-after-restart')

    # ---------- M8: sign-out removes names (checkbox on by default) ----------
    page.goto(B + '/account/', wait_until='networkidle'); page.wait_for_selector('text=Sign out of this browser', timeout=20000); page.wait_for_timeout(600)
    T('M8 sign-out offers "Also remove kids’ names from this device", ticked', page.locator('#signout-forget').is_checked())
    page.locator('#signout-forget').scroll_into_view_if_needed(); shot(page, 'm8-signout')
    page.get_by_role('button', name='Sign out of this browser').click(); page.wait_for_timeout(1500)
    T('M8 signing out with the box ticked removes the names from this device', ls(page) is None and page.locator('text=Member sign in').count() > 0, json.dumps(ls(page))[:120])
    # Unticked keeps them.
    api(ctx, 'POST', '/api/member/signin/', {'email': 'member@example.com', 'last4': '4242'})
    page.evaluate("([k,n])=>localStorage.setItem('tl-program', JSON.stringify({children:k,names:n}))", [kids[:1], {'c_uiakid': 'Ava'}])
    page.goto(B + '/account/', wait_until='networkidle'); page.wait_for_selector('text=Sign out of this browser', timeout=20000); page.wait_for_timeout(600)
    page.locator('#signout-forget').uncheck(); page.get_by_role('button', name='Sign out of this browser').click(); page.wait_for_timeout(1500)
    T('M8 unticked keeps the names', (ls(page) or {}).get('names', {}).get('c_uiakid') == 'Ava')
    ctx.close()
    b.close()
print(f'\n{fails} failed')
open(f'{Q}/logs/ui-fixes-{VW}.txt', 'w').write('\n'.join(out) + f'\n\n{fails} failed\n')
