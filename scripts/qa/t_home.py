from dl import *
def wait_pack(p):
    p.wait_for_function("() => !document.body.innerText.includes('Loading the coloring page letters')", timeout=20000)
def homeschool(t):
    t.go('/homeschool/'); p = t.page; wait_pack(p)
    p.fill('#pack-name', 'Maximiliana Christabel')
    t.dl('hs-prek-w1', sub(p, 'Download week'), expect_gate=True)
    for w in ['2', '4', '13', '36']:
        p.select_option('#pack-week', w); p.wait_for_timeout(200); t.dl(f'hs-prek-w{w}', sub(p, 'Download week'))
    p.locator('label', has_text='Kindergarten').first.click(); p.wait_for_timeout(200)
    opts = [o.get_attribute('value') for o in p.locator('#pack-week option').all()]
    results.append({'tag': 'hs-k-weeks', 'n': len(opts)})
    p.fill('#pack-name', 'José')
    for w in ['1', '2', '15', opts[-1]]:
        p.select_option('#pack-week', w); p.wait_for_timeout(200); t.dl(f'hs-k-w{w}', sub(p, 'Download week'))
    p.check('#pack-faith'); p.wait_for_timeout(200); t.dl('hs-k-faith-w2', sub(p, 'Download week'))
    p.fill('#pack-name', ''); t.dl('hs-k-faith-noname', sub(p, 'Download week'))
    # thumbnails clickable
    p.locator('button[aria-label="Preview page 3"]').click(); results.append({'tag': 'hs-thumb', 'cap': p.locator('figcaption').first.inner_text()})
def hs_reload_faith(t):
    t.go('/homeschool/'); p = t.page; wait_pack(p)
    p.check('#pack-faith'); t.go('/homeschool/'); wait_pack(p)
    results.append({'tag': 'faith-persists', 'checked': p.is_checked('#pack-faith')})
def hs_name_tab(t):
    # name typed on one tool should carry within the tab via sessionStorage (intended)
    t.go('/homeschool/preschool/'); p = t.page; wait_pack(p); p.fill('#pack-name', "D'Andre")
    t.dl('hs-preschool-w1', sub(p, 'Download week'), expect_gate=True)
    p.select_option('#pack-week', '3'); t.dl('hs-preschool-w3', sub(p, 'Download week'))
    t.go('/homeschool/kindergarten/'); wait_pack(p)
    t.dl('hs-kpage-w1', sub(p, 'Download week'))
    t.go('/homeschool/christian/'); wait_pack(p)
    results.append({'tag': 'christian-faith-default', 'checked': p.is_checked('#pack-faith')})
    t.dl('hs-christian-w1', sub(p, 'Download week'))
    p.select_option('#pack-week', '5'); t.dl('hs-christian-w5', sub(p, 'Download week'))
    t.go('/homeschool/?week=7&level=kindergarten'); wait_pack(p)
    results.append({'tag': 'hs-query', 'week': p.input_value('#pack-week')})
def lotw(t):
    t.go('/letter-of-the-week/'); p = t.page; p.locator('#pack-week').scroll_into_view_if_needed(); wait_pack(p)
    t.dl('lotw-index', sub(p, 'Download week'), expect_gate=True)
    for L in 'aqxz':
        t.go(f'/letter-of-the-week/{L}/'); wait_pack(t.page)
        results.append({'tag': f'lotw-{L}-week', 'sel': t.page.locator('#pack-week option:checked').inner_text()})
        t.dl(f'lotw-{L}', sub(t.page, 'Download week'))
def coloring(t):
    t.go('/coloring-pages/'); p = t.page
    cols = sorted(set(a.get_attribute('href') for a in p.locator('a[href^="/coloring-pages/"]').all()))
    results.append({'tag': 'coloring-links', 'cols': cols})
    pages = [l.strip() for l in open(QA + '/urls.txt') if l.startswith('/coloring-pages/') and l.count('/') == 4]
    first = True
    import random; random.seed(3)
    for u in random.sample(pages, 14):
        t.go(u); p = t.page; p.locator('button', has_text='Download PDF').scroll_into_view_if_needed(); p.wait_for_timeout(300)
        t.dl('col-' + u.split('/')[-2], lambda: p.locator('button', has_text='Download PDF').first.click(), expect_gate=first); first=False
    p.locator('label', has_text='A4').first.click(); t.dl('col-a4', lambda: p.locator('button', has_text='Download PDF').first.click())
run({'home': [homeschool, hs_reload_faith, hs_name_tab, lotw], 'col': [coloring]}[sys.argv[1]])
