from dl import *
def chart_btn(t):
    t.go('/cursive-alphabet/'); p = t.page
    b = p.locator('button', has_text='Download the chart (PDF)'); b.scroll_into_view_if_needed(); p.wait_for_timeout(1500)
    t.dl('calpha-chart', lambda: b.click(), expect_gate=True)
    p.select_option('select:has(option[value=a4])', 'a4'); t.dl('calpha-chart-a4', lambda: b.click(), expect_gate=False)
def gate_cancel(t):
    t.go('/name-tracing/'); p = t.page
    p.fill('#tracer-name', 'Zelda'); sub(p, 'Download')(); p.wait_for_timeout(300)
    opened = p.locator('#gate-email').count()
    p.keyboard.press('Escape'); p.wait_for_timeout(200)
    closed = p.locator('#gate-email').count() == 0
    sub(p, 'Download')(); p.wait_for_timeout(300)
    p.fill('#gate-email', 'not-an-email@x'); p.click('form:has(#gate-email) button[type=submit]'); p.wait_for_timeout(300)
    invalid_still_open = p.locator('#gate-email').count()
    results.append({'tag': 'gate-cancel', 'opened': opened, 'esc_closed': closed, 'invalid_still_open': invalid_still_open,
       'ls': p.evaluate('JSON.stringify(localStorage)')})
    p.fill('#gate-email', 'qa@example.com')
    with p.expect_download() as d: p.click('form:has(#gate-email) button[type=submit]')
    # cross-tool: gate should not reappear on another tool
    t.go('/math-worksheets/pre-k/'); p = t.page
    t.dl('cross-tool-math', sub(p, 'Download this worksheet'), expect_gate=False)
    t.go('/coloring-pages/dinosaur-coloring-pages/'); 
    results.append({'tag': 'ls-after', 'ls': p.evaluate('JSON.stringify(localStorage)')})
def gate_api_down(t):
    # subscribe returns 503 -> should still download
    t.ctx.unroute(re.compile(r'.*/api/.*'))
    t.ctx.route(re.compile(r'.*/api/.*'), lambda r, q: (t.log.append({'url': q.url, 'post': q.post_data}), r.fulfill(status=503, body='{}'))[1])
    t.go('/name-tracing/'); p = t.page; p.fill('#tracer-name', 'Zelda')
    t.dl('gate-503', sub(p, 'Download'), expect_gate=True)
def homepage_handoff(t):
    t.go('/'); p = t.page
    p.fill('form input[type=text]', 'Mary-Kate'); p.click('button:has-text("Make a name tracing sheet")'); p.wait_for_load_state('load'); p.wait_for_timeout(800)
    results.append({'tag': 'handoff', 'url': p.url, 'name': p.input_value('#tracer-name')})
    # name typed on homeschool pack then go to name-coloring, cursive: carry over
    t.go('/name-coloring-pages/'); p.wait_for_timeout(500)
    results.append({'tag': 'handoff-coloring', 'name': p.input_value('#coloring-text')})
run([chart_btn, gate_cancel, gate_api_down, homepage_handoff])
