import json, os, re, sys
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:'+os.environ.get('QA_PORT','4421'); Q=os.environ.get('QA_OUT','/tmp/tracelings-qa')
S=Q+'/shots/names'; P=Q+'/pdfs/names'; os.makedirs(S,exist_ok=True); os.makedirs(P,exist_ok=True)
notes=[]; reqs=[]; probs=[]
def N(x): notes.append(x); print(x)
def child(cid, age=5, ints=('dinosaurs',), faith=False, skills=None):
    return {'id':cid,'ageYears':age,'skills':skills or {},'interests':list(ints),'daysPerWeek':5,'minutesPerDay':15,'faith':faith,'createdAt':'2026-10-16T00:00:00.000Z'}
NAMES=[('accent','Zoë-Ångström'),('jose','José Núñez'),('empty',''),('spaces','   '),('wide','WWWWWWWWWWWWWWWWWWWWWWWW'),('apos',"Mary-Kate O'Brien"),('emoji','🦖 Bo'),('html','<b>Al</b>'),('rtl','سارة'),('cjk','小明'),('one','J')]
with sync_playwright() as pw:
    b=pw.chromium.launch()
    ctx=b.new_context(viewport={'width':1280,'height':900}, accept_downloads=True)
    ctx.add_init_script("try{localStorage.setItem('tl-email-ok','1')}catch(e){}")
    page=ctx.new_page()
    page.on('request', lambda r: reqs.append({'url':r.url,'method':r.method,'headers':r.headers,'body':r.post_data or ''}))
    page.on('pageerror', lambda e: probs.append(f'pageerror {e}'))
    for tag,nm in NAMES:
        page.goto(B+'/program/', wait_until='domcontentloaded')
        # sessionStorage.clear(): a fresh visit, not a reload of the last case (a reload returns to the step it was on).
        page.evaluate("([c,n])=>{localStorage.setItem('tl-program', JSON.stringify({children:[c],names:{[c.id]:n}})); sessionStorage.clear()}", [child('c_name'+re.sub('[^a-z]','',tag)[:6]), nm])
        page.goto(B+'/program/', wait_until='networkidle'); page.wait_for_timeout(500)
        got=page.locator('#pc-name').input_value()
        page.get_by_role('button', name='Next: what they can do').click(); page.get_by_role('button', name='Next: what they love').click(); page.get_by_role('button', name='Next: your week').click()
        page.get_by_role('button', name=re.compile('^See ')).click(); page.wait_for_selector('text=Download week 1'); page.wait_for_timeout(1500)
        h=page.locator('#pc-plan').inner_text()
        try:
            with page.expect_download(timeout=90000) as d: page.get_by_role('button', name=re.compile('Download week 1')).click()
            fn=d.value.suggested_filename; d.value.save_as(f'{P}/{tag}.pdf')
        except Exception as e: fn='ERR '+str(e)[:100]
        N(f'name {tag!r} {nm!r}: input={got!r} heading={h!r} file={fn}')
    # multiple kids in localStorage: 5 kids -> only 4 kept; last restored
    kids=[child(f'c_multi{i}a', age=3+i%5, ints=[['bugs'],['pets'],['farm'],['space'],['trains']][i]) for i in range(5)]
    page.evaluate("(ks)=>{localStorage.setItem('tl-program', JSON.stringify({children:ks,names:Object.fromEntries(ks.map((k,i)=>[k.id,'Kid'+i]))})); sessionStorage.clear()}", kids)
    page.goto(B+'/program/', wait_until='networkidle'); page.wait_for_timeout(500)
    lsv=json.loads(page.evaluate("localStorage.getItem('tl-program')")); N(f"5 kids in LS -> restored name {page.locator('#pc-name').input_value()!r}; LS children now {len(lsv['children'])}")
    # free user ?return / ?edit
    for q in ['?return=/account/','?return=//evil.com','?return=https://evil.com','?return=javascript:alert(1)','?return=/\\evil.com','?return=%2F%2Fevil.com','?return=/account/%0d%0aSet-Cookie:x','?edit=c_multi1a','?edit=../../x','?edit=c_nonexist']:
        page.evaluate("sessionStorage.clear()")
        page.goto(B+'/program/'+q, wait_until='networkidle'); page.wait_for_timeout(500)
        N(f'free {q}: h2={page.locator("#placement section h2").first.inner_text()!r} name={page.locator("#pc-name").input_value()!r}')
    ctx.close()
    # member: ?return with malicious values -> where does "Save and go" send?
    st=json.load(open(Q+'/logs/member-state.json')) if os.path.exists(Q+'/logs/member-state.json') else None
    if st:
        for q in ['?return=//evil.com','?return=https://evil.com/x','?return=javascript:alert(1)','?return=/\\evil.com','?return=/account/?x=1%26sync=0','?return=/%5Cevil.com','?return=/api/member/signout/','?return=/program/?return=/program/']:
            c=b.new_context(viewport={'width':1280,'height':900}, storage_state=Q+'/logs/member-state.json'); pg=c.new_page()
            c.route('**evil.com**', lambda r: r.fulfill(status=200, body='EVIL'))
            pg.goto(B+'/program/'+q, wait_until='networkidle'); pg.wait_for_timeout(600)
            try:
                pg.locator('label:has(input[name=pc-age])').nth(2).click()
                pg.get_by_role('button', name='Next: what they can do').click(); pg.get_by_role('button', name='Next: what they love').click()
                pg.get_by_role('button', name='Dinosaurs', exact=True).click(); pg.get_by_role('button', name='Next: your week').click(); pg.get_by_role('button', name=re.compile('^See ')).click()
                pg.wait_for_selector('text=Save and go', timeout=15000); pg.get_by_role('button', name=re.compile('^Save and go')).first.click(); pg.wait_for_timeout(2500)
                N(f'member {q}: landed {pg.url}')
            except Exception as e: N(f'member {q}: ERR {str(e)[:150]}')
            c.close()
    b.close()
leak=[(r['method'],r['url'][:100]) for r in reqs if any(t in (r['url']+json.dumps(r['headers'])+r['body']) for t in ['Zo%C3%AB','Zoë','José','Brien','WWWWWWWW','Kid0','Kid1','سارة','小明'])]
N(f'name leaks {leak}'); N('PROBLEMS '+json.dumps(probs))
open(Q+'/logs/names-params.txt','w').write('\n'.join(notes))
