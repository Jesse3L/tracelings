from dl import *
def math_series(t, u, tag):
    t.go(u); p = t.page
    kinds = p.locator('input[name=math-kind]').count()
    first = True
    for k in range(kinds):
        p.locator('label:has(input[name=math-kind])').nth(k).click(); p.wait_for_timeout(150)
        ranges = p.locator('label:has(input[name=math-range])').count()
        variants = list(range(ranges)) or [None]
        for r in variants:
            if r is not None: p.locator('label:has(input[name=math-range])').nth(r).click()
            if p.locator('#math-number').count(): p.select_option('#math-number', '17')
            if p.locator('input[name=math-blank]').count():
                for bi in range(p.locator('label:has(input[name=math-blank])').count()):
                    p.locator('label:has(input[name=math-blank])').nth(bi).click()
                    t.dl(f'{tag}-k{k}-blank{bi}', sub(p, 'Download this worksheet'), expect_gate=first); first=False
                continue
            name = 'Maximiliana Christabel' if k == 0 else 'José'
            p.fill('#math-name', name)
            t.dl(f'{tag}-k{k}-r{r}', sub(p, 'Download this worksheet'), expect_gate=first); first=False
        if p.locator('label:has(input[name=math-compare])').count():
            p.locator('label:has(input[name=math-compare])').nth(1).click(); t.dl(f'{tag}-k{k}-fewer', sub(p, 'Download this worksheet'))
            p.locator('label:has(input[name=math-compare])').nth(0).click()
        if p.locator('button', has_text='New problems').count():
            a = p.locator('figure .sheet-frame').inner_html(); p.locator('button', has_text='New problems').click(); b = p.locator('figure .sheet-frame').inner_html()
            results.append({'tag': f'{tag}-k{k}-newproblems-changes', 'ok': a != b})
    p.locator('label', has_text='A4').first.click(); t.dl(f'{tag}-a4', sub(p, 'Download this worksheet'))
def prek(t): math_series(t, '/math-worksheets/pre-k/', 'prek')
def tenf(t): math_series(t, '/math-worksheets/ten-frames/', 'tenf')
def mol(t): math_series(t, '/math-worksheets/more-or-less/', 'mol')
def kadd(t): math_series(t, '/math-worksheets/kindergarten-addition/', 'kadd')
def sampler(t):
    t.go('/math-worksheets/kindergarten/'); p = t.page
    p.fill('#sampler-name', "D'Andre"); t.dl('sampler', sub(p, 'sampler'), expect_gate=True)
    p.locator('label', has_text='A4').first.click(); t.dl('sampler-a4', sub(p, 'sampler'), expect_gate=False)
def wf(t):
    t.go('/word-families/'); p = t.page
    fams = [o.get_attribute('value') for o in p.locator('#wf-family option').all()]
    results.append({'tag': 'wf-families', 'list': fams})
    first = True
    for f in fams:
        p.select_option('#wf-family', f); p.wait_for_timeout(100)
        kinds = p.locator('label:has(input[name=wf-kind])').count()
        for k in range(kinds):
            p.locator('label:has(input[name=wf-kind])').nth(k).click()
            if f in ('at', 'ug'): p.fill('#wf-name', 'Maximiliana Christabel' if k%2 else 'Mary-Kate')
            t.dl(f'wf-{f}-k{k}', sub(p, 'Download this worksheet'), expect_gate=first); first=False
def wf_pages(t):
    for f in ['an', 'ed', 'op']:
        t.go(f'/word-families/{f}/'); t.dl(f'wfpage-{f}', sub(t.page, 'Download this worksheet'))
run({'math': [prek, tenf, mol, kadd, sampler], 'wf': [wf, wf_pages]}[sys.argv[1]])
