from dl import *
def wait_font(p, sel='figure .sheet-frame svg'):
    p.wait_for_selector(sel, timeout=20000)
def cursive(t):
    t.go('/cursive/'); p = t.page; wait_font(p)
    first=True
    for i, nm in enumerate(NAMES + ["I can't stop. Can you? Yes, maybe!"]):
        p.fill('#cursive-text', nm); p.wait_for_timeout(200)
        t.dl(f'cursive-{i}', sub(p, 'Download'), expect_gate=first); first=False
    p.fill('#cursive-text', 'Zelda')
    for sz in ['Medium', 'Small']:
        p.locator('label', has_text=sz).first.click(); t.dl(f'cursive-{sz}', sub(p, 'Download'))
    p.locator('label', has_text='Trace only').first.click(); p.uncheck('#cursive-model'); p.locator('label', has_text='A4').first.click()
    t.dl('cursive-a4-trace', sub(p, 'Download'))
def cursive_name(t):
    t.go('/cursive-name-tracing/'); p = t.page; wait_font(p)
    p.fill('#cursive-text', 'Maximiliana Christabel'); t.dl('cname-long', sub(p, 'Download'), expect_gate=True)
    p.fill('#cursive-text', 'José'); t.dl('cname-jose', sub(p, 'Download'), expect_gate=False)
def cursive_alpha(t):
    t.go('/cursive-alphabet/'); p = t.page; wait_font(p)
    t.dl('calpha-AG', sub(p, 'Download A to G'), expect_gate=True)
    for lab in ['H to N', 'O to U', 'V to Z']:
        p.locator('button', has_text=lab).click(); t.dl('calpha-' + lab.replace(' ', ''), sub(p, 'Download'))
    t.dl('calpha-all', lambda: p.locator('button', has_text='Print A to Z').click())
    p.locator('label', has_text='Small').first.click(); t.dl('calpha-all-small', lambda: p.locator('button', has_text='Print A to Z').click())
    t.dl('calpha-chart', lambda: p.locator('button', has_text='Download the chart (PDF)').click())
    p.select_option('select:near(:text("Paper"))', 'a4') if False else None
    for L in 'afqxz':
        t.go(f'/cursive-alphabet/{L}/'); wait_font(t.page); t.dl(f'calpha-letter-{L}', sub(t.page, 'Download'))
def name_coloring(t):
    t.go('/name-coloring-pages/'); p = t.page; wait_font(p)
    first=True
    for i, nm in enumerate(NAMES + ['WWWWWWWWWWWWWWWW', 'Mo Li']):
        p.fill('#coloring-text', nm); p.wait_for_timeout(200)
        t.dl(f'ncolor-{i}', sub(p, 'Download'), expect_gate=first); first=False
    p.fill('#coloring-text', 'Zelda')
    for th in ['Hearts', 'Flowers', 'Bubbles']:
        p.locator('label', has_text=th).first.click(); t.dl(f'ncolor-{th}', sub(p, 'Download'))
    p.uncheck('#coloring-caps'); p.locator('label', has_text='A4').first.click(); t.dl('ncolor-lower-a4', sub(p, 'Download'))
def bubble(t):
    t.go('/bubble-letters/'); p = t.page; p.locator('#coloring-text').scroll_into_view_if_needed(); wait_font(p)
    p.fill('#coloring-text', 'Happy Birthday'); t.dl('bubble-hb', sub(p, 'Download'), expect_gate=True)
    p.locator('label', has_text='Stars').first.click(); t.dl('bubble-stars', sub(p, 'Download'))
    for L in 'agmqw':
        t.go(f'/bubble-letters/{L}/'); wait_font(t.page); t.dl(f'bubble-{L}', sub(t.page, 'Download'))
def alphabet_chart(t):
    t.go('/alphabet-chart/'); p = t.page
    t.dl('chart-print-pairs', sub(p, 'Download the chart'), expect_gate=True)
    for L in ['Capital', 'Lowercase']:
        p.locator('label:has(input[name=chart-letters])', has_text=L).click(); t.dl(f'chart-print-{L}', sub(p, 'Download the chart'))
    p.check('#chart-dots'); t.dl('chart-print-lower-dots', sub(p, 'Download the chart'))
    p.locator('label', has_text='Cursive').first.click(); wait_font(p)
    for L in ['Both', 'Capital', 'Lowercase']:
        p.locator('label:has(input[name=chart-letters])', has_text=L).click(); p.wait_for_timeout(300); t.dl(f'chart-cursive-{L}', sub(p, 'Download the chart'))
    p.locator('label', has_text='A4').first.click(); t.dl('chart-cursive-a4', sub(p, 'Download the chart'))
run([cursive, cursive_name, cursive_alpha, name_coloring, bubble, alphabet_chart])
