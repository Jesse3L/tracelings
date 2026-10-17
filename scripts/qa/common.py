import json, re, os, time
from playwright.sync_api import sync_playwright
BASE = os.environ.get('QA_BASE', 'http://127.0.0.1:4321')
QA = os.environ.get('QA_OUT', os.path.join(os.path.dirname(__file__), 'out'))
os.makedirs(QA + '/shots', exist_ok=True)

def setup_routes(ctx, log):
    def api(route, req):
        u = req.url
        log.append({'url': u, 'method': req.method, 'post': req.post_data, 'mocked': True})
        if '/api/subscribe' in u:
            return route.fulfill(status=200, content_type='application/json', body='{"ok":true}')
        if '/api/member/me' in u:
            return route.fulfill(status=200, content_type='application/json', body='{"member":false,"available":false}')
        if '/api/event' in u:
            return route.fulfill(status=204, body='')
        return route.fulfill(status=404, body='')
    ctx.route(re.compile(r'.*/api/.*'), api)
    ctx.route(re.compile(r'.*(google-analytics|googletagmanager)\.com.*'), lambda r, q: r.fulfill(status=204, body=''))
    ctx.route(re.compile(r'.*/_vercel/.*'), lambda r, q: r.fulfill(status=200, content_type='application/javascript', body=''))

def attach(page, errs, reqs, fails):
    page.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    page.on('request', lambda r: reqs.append({'url': r.url, 'method': r.method, 'post': r.post_data}))
    page.on('requestfailed', lambda r: fails.append(r.url + ' ' + str(r.failure)))
    page.on('response', lambda r: fails.append(f'{r.status} {r.url}') if r.status >= 400 else None)
