import json, os, re, sys, time
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:'+os.environ.get('QA_PORT','4421'); Q=os.environ.get('QA_OUT','/tmp/tracelings-qa')
S=Q+'/shots/free'; P=Q+'/pdfs'; os.makedirs(S,exist_ok=True)
NAMES=['Maximiliana Christabel']
reqs=[]; notes=[]; probs=[]
def N(x): notes.append(x); print(x)
def hs(page, tag):
    w=page.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    if w[0]>w[1]+1: probs.append(f'hscroll {tag} {w}'); print('HSCROLL',tag,w)
def watch(page):
    page.on('request', lambda r: reqs.append({'url':r.url,'method':r.method,'headers':r.headers,'body':r.post_data or ''}))
    page.on('pageerror', lambda e: probs.append(f'pageerror {e}'))
    page.on('console', lambda m: m.type=='error' and probs.append(f'console {m.text[:200]}'))
def nextb(page,label): page.get_by_role('button', name=label).click(); page.wait_for_timeout(250)
with sync_playwright() as pw:
    b=pw.chromium.launch()
    for vw,vh in [(390,844),(1280,900)]:
        ctx=b.new_context(viewport={'width':vw,'height':vh}, accept_downloads=True)
        subs=[]
        def sub(route):
            subs.append(route.request.post_data); route.fulfill(status=200, content_type='application/json', body='{"ok":true}')
        ctx.route('**/api/subscribe/', sub)
        page=ctx.new_page(); watch(page)
        page.goto(B+'/program/', wait_until='networkidle'); page.wait_for_timeout(800)
        page.screenshot(path=f'{S}/{vw}-00-landing.png', full_page=True); hs(page,f'landing {vw}')
        # try to move on without age
        nextb(page,'Next: what they can do')
        N(f'{vw} next without age -> alert: {page.locator("[role=alert]").all_inner_texts()}')
        # step pills clickable before age?
        page.get_by_role('button', name=re.compile('What they love')).click(); page.wait_for_timeout(200)
        N(f'{vw} pill "What they love" without age -> h2: {page.locator("#placement h2").first.inner_text()}')
        # ages
        for i,a in enumerate(['3','4','5','6','7+']):
            page.locator('label:has(input[name=pc-age])').nth(i).click()
        page.fill('#pc-name', NAMES[0])
        N(f'{vw} age legend: {page.locator("legend").first.inner_text()}')
        page.locator('label:has(input[name=pc-age])').nth(2).click()
        page.locator('#placement').screenshot(path=f'{S}/{vw}-01-about.png'); hs(page,'about')
        nextb(page,'Next: what they can do')
        # every skill state
        for s in ['name-writing','letter-names','letter-sounds','blending','word-families','sight-words','count-10','count-20','numerals','compare','add-5','add-10']:
            for k in [2,1,0,1]: page.locator(f'label:has(input[name=pc-{s}])').nth(k).click()
        page.locator('#placement').screenshot(path=f'{S}/{vw}-02-skills.png'); hs(page,'skills')
        # show me page download (gate first)
        page.get_by_role('button', name=re.compile('show me')).click(); page.wait_for_timeout(400)
        gate=page.locator('#gate-email').count(); N(f'{vw} show-me opens email gate: {bool(gate)}')
        if gate:
            page.screenshot(path=f'{S}/{vw}-02b-gate.png')
            page.fill('#gate-email','not-an-email'); page.locator('[role=dialog] button[type=submit]').click(); page.wait_for_timeout(300)
            N(f'{vw} gate invalid email: {page.locator("[role=dialog] [role=alert]").all_inner_texts()} (html5 validity: {page.evaluate("document.querySelector(\'#gate-email\').validity.valid")})')
            page.fill('#gate-email','parent@example.com')
            with page.expect_download(timeout=60000) as d: page.locator('[role=dialog] button[type=submit]').click()
            d.value.save_as(f'{P}/showme-{vw}.pdf'); N(f'{vw} show-me pdf {d.value.suggested_filename}')
        nextb(page,'Next: what they love')
        # interests: 4 picks -> keeps last 3?
        for t in ['Dinosaurs','Space','Trains','Bugs']:
            page.get_by_role('button', name=t, exact=True).click(); page.wait_for_timeout(100)
        N(f'{vw} after picking 4: {page.locator("#placement p[aria-live=polite]").inner_text()}')
        page.locator('#placement').screenshot(path=f'{S}/{vw}-03-interests.png'); hs(page,'interests')
        # deselect all and try next
        for t in ['Space','Trains','Bugs']: page.get_by_role('button', name=t, exact=True).click()
        nextb(page,'Next: your week'); N(f'{vw} next with 0 interests: {page.locator("[role=alert]").all_inner_texts()}')
        page.get_by_role('button', name='Dinosaurs', exact=True).click()
        nextb(page,'Next: your week')
        for d in ['3 days','4 days','5 days']: page.get_by_text(d, exact=True).click()
        for m in ['10','15','20','30']: page.locator('label:has(input[name=pc-min])', has_text=re.compile(f'^{m}$')).click()
        page.check('#pc-faith')
        page.locator('#placement').screenshot(path=f'{S}/{vw}-04-pace.png'); hs(page,'pace')
        # back button chain
        nextb(page,'Back'); h=page.locator('h2').first.inner_text(); nextb(page,'Back'); h2=page.locator('h2').first.inner_text(); nextb(page,'Back'); h3=page.locator('h2').first.inner_text()
        N(f'{vw} back chain: {h} / {h2} / {h3}; name kept={page.locator("#pc-name").input_value()!r}')
        # reload mid flow (on about step after edits)
        page.reload(wait_until='load'); page.wait_for_timeout(1500)
        N(f'{vw} reload: step h2={page.locator("#placement h2").first.inner_text()!r} name={page.locator("#pc-name").input_value()!r} age checked idx={page.evaluate("[...document.querySelectorAll(\'input[name=pc-age]\')].findIndex(x=>x.checked)")}')
        ls=page.evaluate("localStorage.getItem('tl-program')"); N(f'{vw} localStorage tl-program after reload: {ls[:300] if ls else ls}')
        nextb(page,'Next: what they can do'); nextb(page,'Next: what they love'); nextb(page,'Next: your week')
        N(f'{vw} after reload pace minutes checked: {page.evaluate("[...document.querySelectorAll(\'input[name=pc-min]\')].map(x=>x.checked)")} faith={page.is_checked("#pc-faith")}')
        page.get_by_role('button', name=re.compile('^See ')).click()
        page.wait_for_selector('text=Download week 1'); page.wait_for_timeout(2500); N(f'{vw} nudge: {page.locator("div.nudge-in").all_inner_texts()}')
        page.screenshot(path=f'{S}/{vw}-05-plan-full.png', full_page=True); hs(page,'plan')
        txt=page.locator('#placement').inner_text()
        weeks=page.locator('#placement ol').last.locator('> li').count()
        N(f'{vw} plan header: {page.locator("#pc-plan").inner_text()} | {page.locator("#placement p").nth(0).inner_text() if False else ""} weeks={weeks} free={page.locator("[aria-label=Free]").count()} locked={page.locator("[aria-label=Locked]").count()}')
        N(f'{vw} plan text sample: {txt[:500]!r}')
        btn=page.get_by_role('button', name=re.compile('Download week 1')); N(f'{vw} button: {btn.inner_text()}')
        # change answers -> goes to skills
        page.get_by_role('button', name='Change answers').click(); page.wait_for_timeout(300); N(f'{vw} change answers -> {page.locator("#placement h2").first.inner_text()}')
        page.get_by_role('button', name=re.compile('Their plan')).click(); page.wait_for_timeout(500); N(f'{vw} after change answers, Their plan pill works: {page.locator("text=Download week 1").count()>0}')
        if not page.locator('text=Download week 1').count():
            nextb(page,'Next: what they love'); nextb(page,'Next: your week'); page.get_by_role('button', name=re.compile('^See ')).click()
        page.wait_for_selector('text=Download week 1'); page.wait_for_timeout(1500)
        # download (gate already ok from show-me)
        with page.expect_download(timeout=90000) as d: page.get_by_role('button', name=re.compile('Download week 1')).click()
        d.value.save_as(f'{P}/free-week1-{vw}.pdf'); N(f'{vw} week1 pdf {d.value.suggested_filename} {os.path.getsize(P+f"/free-week1-{vw}.pdf")}')
        page.wait_for_timeout(800)
        N(f'{vw} done msg: {page.locator("#placement [role=status]").all_inner_texts()}')
        N(f'{vw} subscribe bodies: {subs}')
        N(f'{vw} localStorage keys: {page.evaluate("Object.keys(localStorage)")} values: {page.evaluate("JSON.stringify(Object.fromEntries(Object.entries(localStorage)))")[:600]}')
        ctx.close()
    b.close()
leak=[(r['method'],r['url'][:120]) for r in reqs if any(t.lower() in (r['url']+json.dumps(r['headers'])+r['body']).lower() for t in ['Maximiliana','Christabel'])]
N(f'requests {len(reqs)}; name leaks {leak}')
N('non-GET: '+str(sorted(set(r['method']+' '+r['url'].split('?')[0] for r in reqs if r['method']!='GET'))))
N('api calls: '+str(sorted(set(r['url'].split('?')[0] for r in reqs if '/api/' in r['url']))))
N('PROBLEMS '+json.dumps(probs[:40]))
json.dump(reqs, open(Q+'/logs/free-requests.json','w'))
open(Q+'/logs/free-flow.txt','w').write('\n'.join(notes))
