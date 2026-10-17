import json, os, re, sys, urllib.request
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:'+os.environ.get('QA_PORT','4421'); Q=os.environ.get('QA_OUT','/tmp/tracelings-qa')
VW=int(sys.argv[1]); EMAIL=sys.argv[2]; L4=sys.argv[3]
S=Q+f'/shots/member-{VW}'; P=Q+f'/pdfs/member-{VW}'; os.makedirs(S,exist_ok=True); os.makedirs(P,exist_ok=True)
NAME='Maximiliana Christabel'; NAMES=['Maximiliana Christabel','Bo','Zed Quill','Ann Lee','Fifth Kid']
reqs=[]; notes=[]; probs=[]
def N(x): notes.append(x); print(x, flush=True)
def mode(m): urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:'+os.environ.get('AI_PORT','4111')+'/__mode', data=m.encode(), method='POST')).read()
def hs(page, tag):
    w=page.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    if w[0]>w[1]+1: probs.append(f'hscroll {tag} {w}')
def msg(page): return page.locator('main [role=status], main [role=alert]').all_inner_texts()
def placement(page, name, age_idx, interests, letters=True):
    page.wait_for_selector('#pc-name'); page.wait_for_timeout(600)
    # Wait for the placement island to hydrate; text typed before that is lost.
    page.wait_for_function("!document.querySelector('astro-island[component-url*=ProgramPlacement]')?.hasAttribute('ssr')", timeout=30000)
    if name is not None: page.fill('#pc-name', name)
    page.locator('label:has(input[name=pc-age])').nth(age_idx).click()
    page.get_by_role('button', name='Next: what they can do').click(); page.wait_for_timeout(300)
    if not page.get_by_role('button', name='Next: what they love').count():
        page.screenshot(path=f'{S}/stuck-{name}.png', full_page=True); N(f'STUCK after Next for {name!r}: alerts={page.locator("[role=alert]").all_inner_texts()} h2={page.locator("#placement section h2").first.inner_text()!r} url={page.url}')
        page.locator('label:has(input[name=pc-age])').nth(age_idx).click(); page.get_by_role('button', name='Next: what they can do').click(); page.wait_for_timeout(300)
    if letters: page.locator('label:has(input[name=pc-letter-names])').nth(2).click()
    page.get_by_role('button', name='Next: what they love').click()
    for t in interests: page.get_by_role('button', name=t, exact=True).click()
    page.get_by_role('button', name='Next: your week').click()
    page.get_by_role('button', name=re.compile('^See ')).click()
    page.wait_for_selector('text=Save and go', timeout=20000); page.wait_for_timeout(800)
def dl(page, click, fname, timeout=120000):
    with page.expect_download(timeout=timeout) as d: click()
    p=f'{P}/{fname}'; d.value.save_as(p); N(f'download {fname} <- {d.value.suggested_filename} {os.path.getsize(p)}'); return p
def fam(page): return page.evaluate("async()=>{const r=await fetch('/api/program/family/'); return r.json()}")
with sync_playwright() as pw:
    b=pw.chromium.launch()
    ctx=b.new_context(viewport={'width':VW,'height':900 if VW>500 else 844}, accept_downloads=True)
    ctx.route('https://square.example/**', lambda r: r.fulfill(status=200, body='square checkout page'))
    page=ctx.new_page()
    page.on('request', lambda r: reqs.append({'url':r.url,'method':r.method,'headers':r.headers,'body':r.post_data or ''}))
    page.on('pageerror', lambda e: probs.append(f'pageerror {e}'))
    # ---- membership page
    page.goto(B+'/membership/', wait_until='load'); page.wait_for_timeout(600)
    page.screenshot(path=f'{S}/membership.png', full_page=True); hs(page,'membership')
    checked=page.evaluate("[...document.querySelectorAll('input[name=plan]')].map(x=>x.checked)"); N(f'membership plan radios checked={checked} text={page.locator("#join").inner_text()[:300]!r}')
    # invalid email
    page.fill('#checkout-email','bad@x'); page.locator('#join button[type=submit]').click(); page.wait_for_timeout(1200); N(f'checkout bad@x -> {page.locator("#join [role=alert]").all_inner_texts()}')
    # square down
    urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:'+os.environ.get('SQ_PORT','4110')+'/__mode', data=b'checkout-down', method='POST')).read()
    page.fill('#checkout-email', EMAIL); page.locator('#join button[type=submit]').click(); page.wait_for_timeout(2500); N(f'checkout square down -> {page.locator("#join [role=alert]").all_inner_texts()} url={page.url}')
    urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:'+os.environ.get('SQ_PORT','4110')+'/__mode', data=b'ok', method='POST')).read()
    page.locator('label:has(input[name=plan])').nth(1).click()
    page.locator('#join button[type=submit]').click(); page.wait_for_url('https://square.example/**', timeout=20000)
    N(f'checkout monthly redirected {page.url}; pending cookie: {[c["name"] for c in ctx.cookies() if c["name"]=="tl_pending"]}; tl-checkout-email={page.evaluate("localStorage.getItem(\'tl-checkout-email\')") if False else ""}')
    last=[json.loads(l) for l in open(Q+'/logs/mock-log.jsonl') if '/payment-links' in l][-1]; bd=json.loads(last['body'])
    N(f"square link body: plan={bd['checkout_options']['subscription_plan_id']} redirect={bd['checkout_options']['redirect_url']} price={bd['quick_pay']['price_money']} email={bd['pre_populated_data']}")
    # ---- back from Square: the welcome page signs in once Square says the order is paid. Pay a few seconds after
    # landing (Square is often slower than the redirect), so the welcome page's retry is exercised too.
    page.goto(B+'/account/?welcome=1', wait_until='load'); page.wait_for_timeout(4000)
    N(f'welcome before pay: {msg(page)} member={page.locator("text=Your program").count()}')
    pr=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:'+os.environ.get('SQ_PORT','4110')+'/__pay/latest', data=json.dumps({'email':EMAIL,'last4':L4}).encode(), method='POST')).read(); N(f'paid: {pr.decode()}')
    try: page.wait_for_selector('#signin-last4', timeout=12000); N('welcome asked for card digits (existing member email)'); page.fill('#signin-last4', L4); page.locator('main form button[type=submit]').click()
    except Exception: pass
    page.wait_for_selector('text=Your program', timeout=20000); page.wait_for_timeout(800)
    N(f'welcome signed in: banner={page.locator("text=Welcome to Tracelings at Home").count()} pending cookie left={[c["name"] for c in ctx.cookies() if c["name"]=="tl_pending"]}')
    page.screenshot(path=f'{S}/welcome.png', full_page=True)
    # ---- another browser (no pending cookie): unknown email, wrong digits, then right
    c0=b.new_context(viewport={'width':VW,'height':900}); p0=c0.new_page()
    p0.on('request', lambda r: reqs.append({'url':r.url,'method':r.method,'headers':r.headers,'body':r.post_data or ''}))
    p0.goto(B+'/account/', wait_until='load'); p0.wait_for_timeout(500)
    p0.screenshot(path=f'{S}/signin.png', full_page=True)
    p0.fill('#signin-email','unknown@example.com'); p0.locator('main form button[type=submit]').click(); p0.wait_for_timeout(1200); N(f'signin unknown -> {msg(p0)}')
    p0.fill('#signin-email', EMAIL); p0.locator('main form button[type=submit]').click(); p0.wait_for_selector('#signin-last4', timeout=5000)
    p0.fill('#signin-last4','0000'); p0.locator('main form button[type=submit]').click(); p0.wait_for_timeout(1200); N(f'signin wrong digits -> {msg(p0)}')
    p0.fill('#signin-last4', L4); p0.locator('main form button[type=submit]').click()
    p0.wait_for_selector('text=Your program', timeout=20000); N('other browser signed in with card digits'); c0.close()
    page.screenshot(path=f'{S}/account-empty.png', full_page=True); hs(page,'account empty')
    # membership page as member
    page.goto(B+'/membership/', wait_until='load'); page.wait_for_timeout(800); N(f'membership as member: {page.locator("[role=status]").first.inner_text()[:120]!r}')
    page.goto(B+'/account/', wait_until='load'); page.wait_for_selector('text=Your program'); page.wait_for_timeout(800)
    # ---- add child 1 via placement
    page.get_by_role('link', name='Add a child').first.click()
    placement(page, NAME, 2, ['Dinosaurs','Space'])
    t=page.locator('#placement').inner_text(); N(f"member plan: upsell={'Start the full program' in t} locks={page.locator('[aria-label=Locked]').count()} button={'Save and go to my account' in t}")
    page.get_by_role('button', name='Save and go to my account').first.click()
    page.wait_for_url('**/account/**'); page.wait_for_selector('text=This week', timeout=20000); page.wait_for_timeout(1500)
    N(f'back url {page.url}; msg={msg(page)}')
    page.screenshot(path=f'{S}/dashboard-1kid.png', full_page=True); hs(page,'dashboard')
    f=fam(page); N(f"server children={[ (c['id'],c['ageYears'],c['interests']) for c in f['children']]} keys={list(f['children'][0].keys())}")
    # ---- print this week
    pdf=dl(page, lambda: page.get_by_role('button', name=re.compile('Print this week')).click(), 'week-current.pdf'); page.wait_for_timeout(600); N(f'msg after print: {msg(page)}')
    page.screenshot(path=f'{S}/dashboard-after-print.png', full_page=True)
    # double click print quickly (double submit)
    with page.expect_download(timeout=120000) as d:
        page.get_by_role('button', name=re.compile('Print this week')).dblclick()
    N('double-click print produced download')
    # redo x2 then disabled
    for i in range(2):
        dl(page, lambda: page.get_by_role('button', name=re.compile('Make a new story')).click(), f'redo{i+1}.pdf'); page.wait_for_timeout(600)
    rb=page.get_by_role('button', name=re.compile('Make a new story')); N(f'redo button after 2: {rb.inner_text()} disabled={rb.is_disabled()}')
    # ---- AI garbage on another week via timeline
    mode('garbage')
    page.get_by_role('button', name=re.compile('Show all')).click(); page.wait_for_timeout(300)
    rows=page.locator('ol > li:has-text("Week 2")').first
    dl(page, lambda: rows.get_by_role('button', name='Print').click(), 'week2-ai-garbage.pdf'); page.wait_for_timeout(500); N(f'week2 with AI garbage msg: {msg(page)}')
    mode('timeout')
    import time; t0=time.time()
    try:
        dl(page, lambda: page.locator('ol > li:has-text("Week 2")').first.get_by_role('button', name=re.compile('Print|Making')).click(), 'week2-ai-timeout.pdf', timeout=150000); N(f'week2 timeout took {time.time()-t0:.0f}s msg: {msg(page)}')
    except Exception as e: N(f'week2 timeout ERR {str(e)[:120]}')
    mode('good')
    # week 3 (current+2) -> template note; week 20
    dl(page, lambda: page.locator('ol > li:has-text("Week 3")').first.get_by_role('button', name='Print').click(), 'week3-template.pdf'); page.wait_for_timeout(500); N(f'week3 msg: {msg(page)}')
    dl(page, lambda: page.locator('ol > li:has-text("Week 20")').first.get_by_role('button', name='Print').click(), 'week20-template.pdf'); page.wait_for_timeout(500); N(f'week20 msg: {msg(page)}')
    # make current week 3
    page.locator('ol > li:has-text("Week 3")').first.get_by_role('button', name='Make current').click(); page.wait_for_timeout(1500)
    N(f'after make current 3: {page.locator("text=/week \\d+ of \\d+/").first.inner_text()}')
    page.locator('ol > li:has-text("Week 1")').first.get_by_role('button', name='Make current').click(); page.wait_for_timeout(1500)
    # ---- check-in (still working all), double submit
    before=fam(page)['plans']
    sets=page.locator('main form fieldset')
    for i in range(sets.count()): sets.nth(i).locator('label').nth(1).click()
    page.screenshot(path=f'{S}/checkin.png', full_page=True)
    page.get_by_role('button', name='Save check-in').dblclick(); page.wait_for_timeout(2500)
    after=fam(page)
    cid=after['children'][0]['id']
    N(f"checkin: weeks {len(before[cid]['weeks'])}->{len(after['plans'][cid]['weeks'])} current {before[cid]['current']}->{after['plans'][cid]['current']} checkIns={len(after['checkIns'])} msg={msg(page)}")
    N(f"post-checkin first weeks: {[ (w['baseWeek'], w.get('extraReview',False)) for w in after['plans'][cid]['weeks'][:4]]}")
    page.screenshot(path=f'{S}/after-checkin.png', full_page=True)
    # ---- progress report
    dl(page, lambda: page.get_by_role('button', name='Print progress report').click(), 'report.pdf')
    # ---- children 2..5
    for i,(nm,age,ints) in enumerate([(NAMES[1],0,['Trains']),(NAMES[2],4,['Bugs','Pets']),(NAMES[3],1,['Unicorns'])]):
        page.get_by_role('link', name='+ Add a child').click()
        prefill=page.locator('#pc-name').input_value() if page.locator('#pc-name').count() else '?'
        placement(page, nm, age, ints, letters=False)
        page.get_by_role('button', name='Save and go to my account').first.click()
        page.wait_for_url('**/account/**'); page.wait_for_timeout(3000)
        N(f'added child {i+2} ({nm}); prefill was {prefill!r}; tabs={page.get_by_role("tab").all_inner_texts()} msg={msg(page)}')
    N(f'add-child link with 4 kids present: {page.get_by_role("link", name="+ Add a child").count()}')
    page.screenshot(path=f'{S}/dashboard-4kids.png', full_page=True); hs(page,'4 kids')
    # 5th via direct /program/?return
    page.goto(B+'/program/?return=%2Faccount%2F', wait_until='load')
    page.wait_for_selector('#pc-name'); page.wait_for_timeout(1500)
    N(f'5th child placement notice: {page.locator("#placement [role=alert]").all_inner_texts()}')
    # QA M7: a 5th child can't be saved; the placement says so and offers no save button.
    page.wait_for_function("!document.querySelector('astro-island[component-url*=ProgramPlacement]')?.hasAttribute('ssr')", timeout=30000)
    page.fill('#pc-name', NAMES[4]); page.locator('label:has(input[name=pc-age])').nth(3).click()
    page.get_by_role('button', name='Next: what they can do').click(); page.get_by_role('button', name='Next: what they love').click()
    page.get_by_role('button', name='Sports', exact=True).click(); page.get_by_role('button', name='Next: your week').click()
    page.get_by_role('button', name=re.compile('^See ')).click(); page.wait_for_selector('text=Download week 1', timeout=20000); page.wait_for_timeout(800)
    N(f'5th child: save buttons={page.get_by_role("button", name=re.compile("^Save and go")).count()} full notice={page.locator("text=Your account already has 4 kids").count()}')
    page.goto(B+'/account/', wait_until='load'); page.wait_for_selector('text=This week', timeout=20000); page.wait_for_timeout(2000)
    N(f'5th child: tabs={page.get_by_role("tab").all_inner_texts()} msg={msg(page)} server={len(fam(page)["children"])}')
    page.screenshot(path=f'{S}/dashboard-5th.png', full_page=True)
    ls=json.loads(page.evaluate("localStorage.getItem('tl-program')")); N(f"LS children={len(ls['children'])} names={list(ls['names'].values())}")
    # switch kids
    for tname in page.get_by_role('tab').all_inner_texts():
        page.get_by_role('tab', name=tname).click(); page.wait_for_timeout(400)
        N(f'tab {tname!r}: {page.locator("text=/plan, week \\d+ of \\d+/").first.inner_text() if page.locator("text=/plan, week \\d+ of \\d+/").count() else "no plan line"}')
    # edit child 1
    page.get_by_role('tab').first.click(); page.wait_for_timeout(400)
    page.get_by_role('link', name='Edit answers or interests').click(); page.wait_for_selector('#pc-name'); page.wait_for_timeout(1000)
    N(f'edit url {page.url} name prefill={page.locator("#pc-name").input_value()!r} h2={page.locator("#placement section h2").first.inner_text()!r}')
    page.get_by_role('button', name='Next: what they can do').click(); page.get_by_role('button', name='Next: what they love').click()
    page.get_by_role('button', name='Ocean animals', exact=True).click()
    page.get_by_role('button', name='Next: your week').click(); page.get_by_role('button', name=re.compile('^See ')).click()
    page.wait_for_selector('text=Save and go back to my account'); page.get_by_role('button', name='Save and go back to my account').first.click()
    page.wait_for_url('**/account/**'); page.wait_for_timeout(3000)
    f=fam(page); N(f"after edit interests: {[c['interests'] for c in f['children']]} checkIns={len(f['checkIns'])} cached={f['cached']}")
    # remove child 2
    page.get_by_role('tab').nth(1).click(); page.wait_for_timeout(300)
    page.get_by_role('button', name='Remove this child').click(); page.get_by_role('button', name='Yes, remove').click(); page.wait_for_timeout(2000)
    ls=json.loads(page.evaluate("localStorage.getItem('tl-program')"))
    N(f'after remove: tabs={page.get_by_role("tab").all_inner_texts()} server={len(fam(page)["children"])} LS={len(ls["children"])}')
    # name on a second device: clear names, see prompt
    c2=b.new_context(viewport={'width':VW,'height':900}, accept_downloads=True); c2.add_cookies([c for c in ctx.cookies() if c['name']=='tl_member']); p2=c2.new_page()
    p2.on('request', lambda r: reqs.append({'url':r.url,'method':r.method,'headers':r.headers,'body':r.post_data or ''}))
    p2.goto(B+'/account/', wait_until='load'); p2.wait_for_selector('text=This week', timeout=20000); p2.wait_for_timeout(800)
    N(f'second device tabs={p2.get_by_role("tab").all_inner_texts()} name prompt={p2.locator("text=Child’s first name on this device").count()}')
    p2.screenshot(path=f'{S}/second-device.png', full_page=True)
    p2.locator('form input[placeholder="First name"]').fill('Dev Two'); p2.get_by_role('button', name='Save', exact=True).click(); p2.wait_for_timeout(500)
    with p2.expect_download(timeout=120000) as d: p2.get_by_role('button', name=re.compile('Print this week')).click()
    d.value.save_as(f'{P}/second-device-week.pdf'); N(f'second device pdf {d.value.suggested_filename}')
    c2.close()
    # ---- cancel membership
    page.get_by_role('button', name='Cancel membership').click(); page.wait_for_timeout(300)
    page.screenshot(path=f'{S}/cancel-confirm.png', full_page=True)
    page.get_by_role('button', name='Yes, cancel').click(); page.wait_for_timeout(2500)
    N(f'after cancel: {page.locator("main").inner_text()[-900:]!r}')
    page.screenshot(path=f'{S}/after-cancel.png', full_page=True)
    # sign out
    page.get_by_role('button', name='Sign out of this browser').click(); page.wait_for_timeout(1500)
    N(f'after signout h2={page.locator("main h2").first.inner_text()!r}; cookies={[c["name"] for c in ctx.cookies()]}; LS names kept={json.loads(page.evaluate("localStorage.getItem(\'tl-program\')") or "{}").get("names")}')
    json.dump(ctx.storage_state(), open(Q+'/logs/member-state.json','w'))
    ctx.close(); b.close()
leak=[(r['method'],r['url'][:100]) for r in reqs if any(t in (r['url']+json.dumps(r['headers'])+r['body']) for t in ['Maximiliana','Christabel','Zed Quill','Ann Lee','Fifth Kid','Dev Two','"Bo"'])]
N(f'requests={len(reqs)} name leaks={leak}')
N('api: '+json.dumps(sorted(set(r['method']+' '+r['url'].split('?')[0].replace(B,'') for r in reqs if '/api/' in r['url']))))
N('PROBLEMS '+json.dumps(probs))
json.dump(reqs, open(Q+f'/logs/member-requests-{VW}.json','w'))
open(Q+f'/logs/member-flow-{VW}.txt','w').write('\n'.join(notes))
