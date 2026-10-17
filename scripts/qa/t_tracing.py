from dl import *
def name_tracing(t):
    t.go('/name-tracing/'); p = t.page
    first = True
    for i, nm in enumerate(NAMES):
        p.fill('#tracer-name', nm); p.wait_for_timeout(150)
        t.dl(f'name-{i}', sub(p, 'Download'), expect_gate=first); first = False
    p.fill('#tracer-name', 'Zelda')
    for style in ['ALL CAPS', 'lowercase']:
        p.locator('label', has_text=style).first.click()
        t.dl(f'name-style-{style[:3]}', sub(p, 'Download'), expect_gate=False)
    for size in ['Medium', 'Small']:
        p.locator('label', has_text=size).first.click()
        t.dl(f'name-size-{size}', sub(p, 'Download'), expect_gate=False)
    p.locator('label', has_text='Trace only').first.click(); p.uncheck('#tracer-dots'); p.uncheck('#tracer-model')
    p.locator('label', has_text='A4').first.click()
    t.dl('name-a4-traceonly-nodots', sub(p, 'Download'), expect_gate=False)
    # preview check: svg updates
    p.fill('#tracer-name', 'Bob'); s1 = p.locator('figure .sheet-frame').inner_html()
    p.fill('#tracer-name', 'Bobby'); s2 = p.locator('figure .sheet-frame').inner_html()
    results.append({'tag': 'name-preview-updates', 'ok': s1 != s2})
    p.screenshot(path=f'{QA}/shots/int_name_tracing.png', full_page=True)

def letter_tracing(t):
    t.go('/letter-tracing/'); p = t.page
    p.select_option('#tracer-pick', 'q'); t.dl('letter-q-both', sub(p, 'Download PDF'), expect_gate=True)
    p.locator('label', has_text='Capital').first.click(); t.dl('letter-q-upper', sub(p, 'Download PDF'), expect_gate=False)
    p.locator('label', has_text='Lowercase').first.click(); p.locator('label', has_text='Small').first.click(); t.dl('letter-q-lower-small', sub(p, 'Download PDF'))
    # A to Z sheet
    for case in ['Both', 'Capital', 'Lowercase']:
        p.locator('fieldset:has(legend:text("Letters"))').last.locator('label', has_text=case).first.click()
        t.dl(f'az-{case}', sub(p, 'Download A to Z'))
    p.locator('label:has(input[name=abc-size])', has_text='Large').click(); t.dl('az-lower-large', sub(p, 'Download A to Z'))
    p.locator('label:has(input[name=abc-size])', has_text='Small').click(); t.dl('az-lower-small', sub(p, 'Download A to Z'))

def letter_pages(t):
    for L in 'abgjmqwyz':
        t.go(f'/letter-tracing/{L}/'); t.dl(f'letterpage-{L}', sub(t.page, 'Download PDF'))
def number_tracing(t):
    t.go('/number-tracing/'); p = t.page
    for d in ['0', '6', '9']:
        p.select_option('#tracer-pick', d); t.dl(f'num-{d}', sub(p, 'Download PDF'))
    for d in '0123456789':
        t.go(f'/number-tracing/{d}/'); t.dl(f'numpage-{d}', sub(t.page, 'Download PDF'))
def number_ranges(t):
    for r in ['1-10', '1-20']:
        t.go(f'/number-tracing/{r}/'); p = t.page
        t.dl(f'range-{r}-page', sub(p, 'Download'))
        p.locator('label', has_text='Bigger numbers').click()
        for sz in ['Large', 'Medium', 'Small']:
            p.locator('label:has(input[name=range-size])', has_text=sz).click()
            t.dl(f'range-{r}-rows-{sz}', sub(p, 'Download'))
        p.locator('label', has_text='Trace only').first.click(); p.locator('label', has_text='A4').first.click()
        t.dl(f'range-{r}-rows-trace-a4', sub(p, 'Download'))
def word_tracing(t):
    t.go('/word-tracing/'); p = t.page
    t.dl('words-default', sub(p, 'Download'))
    p.locator('button', has_text='A sentence').click(); t.dl('words-sentence', sub(p, 'Download'))
    p.locator('button', has_text='Days of the week').click(); p.locator('label', has_text='Large').first.click(); t.dl('words-days-large', sub(p, 'Download'))
    p.fill('#word-text', "Maximiliana Christabel went to the supermarket yesterday afternoon!\nJosé D'Andre Mary-Kate\nI can't stop. Can you? Yes; no: maybe.\n😀 emoji"); p.wait_for_timeout(200)
    results.append({'tag': 'words-dropped-msg', 'visible': p.locator('text=Some characters can').count() > 0})
    t.dl('words-edge', sub(p, 'Download'))
    p.fill('#word-text', '\n'.join(['word%d' % i for i in range(35)])); t.dl('words-35', sub(p, 'Download'))
    p.fill('#word-text', ''); results.append({'tag': 'words-empty-disabled', 'disabled': p.locator('button[type=submit]').filter(has_text='Download').is_disabled()})
def sight_words(t):
    for g in ['pre-k', 'kindergarten', 'first-grade', 'second-grade', 'third-grade']:
        t.go(f'/sight-words/{g}/'); p = t.page
        t.dl(f'sight-{g}', sub(p, 'Download PDF'))
        t.dl(f'flash-{g}', sub(p, 'flash card'))
    p = t.page
    p.locator('label', has_text='Choose words').click(); p.wait_for_timeout(200)
    p.screenshot(path=f'{QA}/shots/int_sight_choose.png', full_page=True)
    t.dl('flash-choose', sub(p, 'flash card'))
run([name_tracing, letter_tracing, letter_pages, number_tracing, number_ranges, word_tracing, sight_words])
