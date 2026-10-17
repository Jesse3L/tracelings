import sys, json, os, re, subprocess
sys.path.insert(0, os.path.dirname(__file__))
from common import *
OUT = QA + '/pdfs'; os.makedirs(OUT, exist_ok=True)
NAMES = json.loads(os.environ['QA_NAMES']) if os.environ.get('QA_NAMES') else ['Maximiliana Christabel', 'José', "D'Andre", 'Mary-Kate', '', '😀Mia', 'A']
results = []

class T:
    def __init__(s, b):
        s.b = b; s.new()
    def new(s):
        s.ctx = s.b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
        s.log = []; setup_routes(s.ctx, s.log)
        s.page = s.ctx.new_page(); s.errs=[]; s.reqs=[]; s.fails=[]
        attach(s.page, s.errs, s.reqs, s.fails)
        s.gates = 0
    def go(s, u):
        s.page.goto(BASE + u, wait_until='load', timeout=60000)
        try: s.page.wait_for_load_state('networkidle', timeout=8000)
        except Exception: pass
        s.page.evaluate('window.scrollTo(0, document.body.scrollHeight)'); s.page.wait_for_timeout(700); s.page.evaluate('window.scrollTo(0,0)'); s.page.wait_for_timeout(300)
    def dl(s, tag, click, expect_gate=None, timeout=30000):
        p = s.page
        gate_seen = False
        try:
            with p.expect_download(timeout=timeout) as d:
                click()
                p.wait_for_timeout(300)
                if p.locator('#gate-email').count():
                    gate_seen = True; s.gates += 1
                    p.fill('#gate-email', 'qa@example.com')
                    p.click('form:has(#gate-email) button[type=submit]')
            path = f'{OUT}/{tag}.pdf'
            d.value.save_as(path)
            fn = d.value.suggested_filename
        except Exception as e:
            results.append({'tag': tag, 'error': str(e)[:300], 'gate': gate_seen}); print('FAIL', tag, str(e)[:200], flush=True); return None
        n = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', path], capture_output=True, text=True).stdout).group(1))
        r = {'tag': tag, 'file': fn, 'pages': n, 'gate': gate_seen, 'path': path}
        if expect_gate is not None and expect_gate != gate_seen: r['gate_problem'] = f'expected gate={expect_gate}'
        results.append(r); print('OK', tag, fn, n, 'gate' if gate_seen else '', r.get('gate_problem', ''), flush=True)
        return path
    def finish(s, label):
        txt = json.dumps(s.reqs) + json.dumps(s.log)
        leaks = [n for n in ['Maximiliana', 'Christabel', 'Jos', 'Andre', 'Mary-Kate', 'Mia', 'Zelda'] if n in txt]
        results.append({'tag': label + '-net', 'errs': s.errs, 'fails': [f for f in s.fails if '_vercel' not in f], 'leaks': leaks,
                        'api': [ (q['url'], q['post']) for q in s.log ]})
        print('NET', label, 'errs', len(s.errs), 'leaks', leaks, flush=True)
        s.ctx.close()

def sub(p, text):  # click submit button containing text
    def f():
        l = p.locator('button[type=submit]').filter(has_text=text).first
        l.scroll_into_view_if_needed(); p.wait_for_timeout(400); l.click()
    return f

def run(which):
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        t = T(b)
        for fn in which: 
            try: fn(t)
            except Exception as e: print('CRASH', fn.__name__, e, flush=True); results.append({'tag': fn.__name__, 'crash': str(e)[:400]})
            t.finish(fn.__name__); t.new()
        b.close()
    json.dump(results, open(f'{QA}/dl-{sys.argv[1] if len(sys.argv)>1 else "all"}.json', 'w'), indent=1)
