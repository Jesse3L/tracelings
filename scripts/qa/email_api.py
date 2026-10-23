"""Email QA over HTTP: admin API, sign-ups, imports, broadcasts, test sends, member tagging, against the Resend mock.
Start:  QA_EXTRA_ENV="$(bash scripts/qa/email-env.sh)" bash scripts/qa/up.sh
Run:    python3 scripts/qa/email_api.py            (QA_PORT, RESEND_PORT, SQ_PORT, QA_OUT as for up.sh)
Run with NO_TOKEN=1 against a server started without EMAIL_ADMIN_TOKEN to check the endpoint 404s.
Never touches the real Resend API: the site is pointed at the mock by RESEND_BASE_URL."""
import json, os, sys, time, urllib.request, urllib.error

PORT = os.environ.get('QA_PORT', '4421')
BASE = f'http://127.0.0.1:{PORT}'
MOCK = f"http://127.0.0.1:{os.environ.get('RESEND_PORT', '4112')}"
SQ = f"http://127.0.0.1:{os.environ.get('SQ_PORT', '4110')}"
TOKEN = os.environ.get('EMAIL_ADMIN_TOKEN_QA', 'qa-admin-token-0123456789abcdef0123456789')
QA_OUT = os.environ.get('QA_OUT', '/tmp/tracelings-qa')
fails, passes = [], 0

def ok(cond, msg):
    global passes
    if cond: passes += 1
    else:
        fails.append(msg); print('FAIL', msg)

def http(method, url, body=None, headers=None, raw=None, timeout=60):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = {'Content-Type': 'application/json', **(headers or {})}
    req = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = r.read().decode()
            return r.status, (json.loads(txt) if txt.startswith(('{', '[')) else txt)
    except urllib.error.HTTPError as e:
        txt = e.read().decode()
        try: return e.code, json.loads(txt)
        except Exception: return e.code, txt

def admin(body, token=TOKEN):
    return http('POST', f'{BASE}/api/admin/email/', body, {'Authorization': f'Bearer {token}'} if token else {})
def state(): return http('GET', f'{MOCK}/__state')[1]
def mock(path, raw=''): return http('POST', f'{MOCK}{path}', raw=raw.encode())
def subscribe(email, source, role=None):
    t = time.time()
    s, b = http('POST', f'{BASE}/api/subscribe/', {'email': email, 'source': source, **({'role': role} if role else {})})
    return s, b, time.time() - t
def contact(email):
    return next((c for c in state()['contacts'] if c['email'] == email), None)
def seg_names(email):
    st = state(); c = next(c for c in st['contacts'] if c['email'] == email)
    names = {s['id']: s['name'] for s in st['segments']}
    return sorted(names[i] for i in st['contactSegments'].get(c['id'], []))
def events_for(email):
    st = state(); c = next((c for c in st['contacts'] if c['email'] == email), None)
    return [e['event'] for e in st['sentEvents'] if c and e['contact_id'] == c['id']]

if os.environ.get('NO_TOKEN'):
    s, _ = admin({'action': 'stats'})
    ok(s == 404, f'no EMAIL_ADMIN_TOKEN: 404 (got {s})')
    s, _ = admin({'action': 'stats'}, token='anything')
    ok(s == 404, f'no EMAIL_ADMIN_TOKEN, any token: 404 (got {s})')
    print(f'{passes} passed, {len(fails)} failed'); sys.exit(1 if fails else 0)

mock('/__reset')

# ---------- auth ----------
s, b = admin({'action': 'stats'}, token=None); ok(s == 401, f'no auth 401 ({s})')
s, b = admin({'action': 'stats'}, token=TOKEN + 'x'); ok(s == 401, f'wrong token 401 ({s})')
s, b = admin({'action': 'stats'}, token=TOKEN[:-1]); ok(s == 401, f'prefix token 401 ({s})')
s, b = http('GET', f'{BASE}/api/admin/email/'); ok(s in (404, 405), f'GET not allowed ({s})')
s, b = admin({'action': 'nope'}); ok(s == 400 and 'actions' in b, f'unknown action 400 ({s})')
s, b = http('POST', f'{BASE}/api/admin/email/', raw=b'{bad', headers={'Authorization': f'Bearer {TOKEN}'}); ok(s == 400, f'bad json 400 ({s})')

# ---------- domain ----------
s, b = admin({'action': 'domain-status'}); ok(s == 200 and b.get('found') is False, f'domain-status before create {b}')
s, b = admin({'action': 'domain-create'}); ok(s == 200 and b.get('name') == 'tracelings.com' and len(b.get('records', [])) == 3, f'domain-create {s} {b}')
ok(all(set(r) <= {'record', 'type', 'name', 'value', 'ttl', 'priority', 'status'} for r in b.get('records', [])), 'domain records have no extra fields')
ok(state()['domains'][0]['open_tracking'] is False and state()['domains'][0]['click_tracking'] is False, 'tracking off by default')
s, b = admin({'action': 'domain-create'}); ok(s == 200 and b.get('existed') is True, 'domain-create is idempotent')
s, b = admin({'action': 'domain-verify'}); ok(s == 200 and b.get('status') == 'pending', f'domain-verify {b}')

# ---------- before setup ----------
s, b = admin({'action': 'broadcast-create', 'template': 'launch-a'}); ok(s == 400 and b.get('code') == 'setup_needed', f'broadcast before setup {s} {b}')
s, b, dt = subscribe('early@example.com', 'name-tracing'); ok(s == 200, f'sign-up before setup still ok (webhook saved it) {s}')
ok(contact('early@example.com') is None, 'no contact before properties exist (mock rejects unknown properties)')

# ---------- setup ----------
s, b = admin({'action': 'setup'}); ok(s == 200, f'setup {s} {str(b)[:300]}')
st = state()
ok(sorted(p['key'] for p in st['props']) == sorted(['source', 'signup_date', 'member', 'interest', 'audience', 'welcome_status']), 'properties created')
ok(sorted(x['name'] for x in st['segments']) == sorted(['everyone', 'homeschool', 'teachers', 'members', 'prospects']), 'segments created')
ok([t['name'] for t in st['topics']] == ['Tracelings emails'] and st['topics'][0]['default_subscription'] == 'opt_in' and st['topics'][0]['visibility'] == 'public', 'topic created')
ok(len(st['events']) == 7, f"7 trigger events ({len(st['events'])})")
ok(len(st['templates']) == 16 and all(t['status'] == 'published' for t in st['templates']), f"16 published templates ({len(st['templates'])})")
ok(all('{{{RESEND_UNSUBSCRIBE_URL}}}' in t['html'] and t['from'] == 'Tracelings <hello@tracelings.com>' and t['reply_to'] == ['hello@tracelings.com'] for t in st['templates']), 'templates have unsubscribe, from, reply_to')
ok(len(st['automations']) == 7 and all(a['status'] == 'disabled' for a in st['automations']), 'automations created disabled')
s, b = admin({'action': 'setup'}); st2 = state()
ok(s == 200 and len(st2['segments']) == 5 and len(st2['templates']) == 16 and len(st2['automations']) == 7 and len(st2['props']) == 6, 'setup is idempotent')
ok(all(v == 'exists' for v in b['properties'].values()) and all(v['status'] == 'updated' for v in b['templates'].values()), 'second setup reports exists/updated')
s, b = admin({'action': 'setup', 'rebuild_automations': True}); ok(s == 200 and all(v['action'] == 'rebuilt' for v in b['automations'].values()), 'rebuild disabled automations')
s, b = admin({'action': 'automations-enable'}); ok(s == 200 and all(v == 'enabled' for v in b.values()), f'automations-enable {b}')
s, b = admin({'action': 'setup', 'rebuild_automations': True}); ok(s == 200 and all('left' in v['action'] for v in b['automations'].values()), 'enabled automations are left alone')

# ---------- sign-ups ----------
cases = [
    ('parent1@example.com', 'kindergarten-addition', None, 'tracelings.welcome.math', ['everyone', 'prospects'], 'math'),
    ('hs@example.com', 'homeschool-prek', None, 'tracelings.welcome.homeschool', ['everyone', 'homeschool', 'prospects'], 'homeschool'),
    ('prog@example.com', 'program-week1', None, 'tracelings.welcome.program', ['everyone', 'homeschool', 'prospects'], 'program'),
    ('color@example.com', 'coloring-pages', None, 'tracelings.welcome.coloring', ['everyone', 'prospects'], 'coloring'),
    ('Teach@AustinISD.org', 'name-tracing', None, 'tracelings.welcome.teacher', ['everyone', 'teachers'], 'letters'),
    ('wait@example.com', 'waitlist', 'classroom', 'tracelings.welcome.teacher', ['everyone', 'teachers'], 'general'),
]
for email, src, role, ev, segs, interest in cases:
    s, b, dt = subscribe(email, src, role)
    e = email.lower()
    ok(s == 200 and b.get('ok') is True, f'subscribe {e} {s}')
    c = contact(e)
    ok(c is not None, f'{e}: contact created')
    if not c: continue
    ok(c['properties'].get('source') == src and c['properties'].get('member') == 'false' and len(c['properties'].get('signup_date', '')) == 10 and c['properties'].get('interest') == interest, f'{e}: properties {c["properties"]}')
    ok(c['properties'].get('audience') == ('teacher' if 'teacher' in ev else 'family'), f'{e}: audience')
    ok(seg_names(e) == sorted(segs), f'{e}: segments {seg_names(e)}')
    ok(events_for(e) == [ev], f'{e}: welcome event {events_for(e)}')

# existing contact: no second welcome, nothing changed
s, b, _ = subscribe('parent1@example.com', 'coloring-pages')
ok(s == 200 and events_for('parent1@example.com') == ['tracelings.welcome.math'] and contact('parent1@example.com')['properties']['source'] == 'kindergarten-addition', 'repeat sign-up: no new welcome, source kept')
# unsubscribed contact signs up again: stays unsubscribed, no welcome
mock('/__unsubscribe', 'color@example.com')
s, b, _ = subscribe('color@example.com', 'coloring-pages')
ok(s == 200 and contact('color@example.com')['unsubscribed'] is True and events_for('color@example.com') == ['tracelings.welcome.coloring'], 'unsubscribed stays unsubscribed, no new welcome')
# invalid email
s, b, _ = subscribe('not-an-email', 'name-tracing'); ok(s == 400, f'invalid email 400 ({s})')
# Resend down, webhook up: still ok
mock('/__mode', 'down'); s, b, _ = subscribe('down1@example.com', 'name-tracing'); ok(s == 200, f'Resend down, webhook ok -> 200 ({s})')
# both down: 503 (the gate still lets the download go ahead client side)
mock('/__notify-mode', 'down'); s, b, _ = subscribe('down2@example.com', 'name-tracing'); ok(s == 503, f'both down -> 503 ({s})')
mock('/__notify-mode', 'ok'); mock('/__mode', 'ok')
# Resend slow: the sign-up still answers fast enough
mock('/__mode', 'slow'); s, b, dt = subscribe('slow@example.com', 'name-tracing'); mock('/__mode', 'ok')
ok(s == 200 and dt < 7, f'Resend slow: answered {s} in {dt:.1f}s')
# webhook down, Resend up: ok
mock('/__notify-mode', 'down'); s, b, _ = subscribe('webhookdown@example.com', 'prek-math'); mock('/__notify-mode', 'ok')
ok(s == 200 and contact('webhookdown@example.com') is not None, f'webhook down, Resend ok -> 200 ({s})')

# ---------- import ----------
mock('/__unsubscribe', 'hs@example.com')
emails = ['new1@example.com', 'NEW1@example.com', ' new2@example.com ', 'bad-email', 'parent1@example.com', 'hs@example.com', 'teacher2@cfisd.net',
          {'email': 'new3@example.com', 'source': 'homeschool-k', 'date': '2026-09-14'}, {'email': 'new4@example.com', 'source': 'waitlist', 'role': 'classroom'}]
s, b = admin({'action': 'import', 'emails': emails}); ok(s == 200, f'import {s} {b}')
ok(b.get('created') == 5 and b.get('existing') == 1 and b.get('unsubscribed') == 1 and b.get('invalid') == 1 and b.get('failed') == 0 and b.get('valid') == 7, f'import counts {b}')
ok(contact('hs@example.com')['unsubscribed'] is True, 'import never re-subscribes')
ok(contact('new1@example.com')['properties']['source'] == 'import-oct-2026' and events_for('new1@example.com') == [], 'import: source import-oct-2026, no welcome')
ok(contact('new3@example.com')['properties']['signup_date'] == '2026-09-14' and 'homeschool' in seg_names('new3@example.com'), 'import: keeps date, segments from original source')
ok('teachers' in seg_names('teacher2@cfisd.net') and 'prospects' not in seg_names('teacher2@cfisd.net'), 'import: school domain -> teachers')
ok('teachers' in seg_names('new4@example.com'), 'import: classroom role -> teachers')
s, b = admin({'action': 'import', 'emails': emails}); ok(b.get('created') == 0, 'import again creates nothing')
s, b = admin({'action': 'import'}); ok(s == 400, 'import needs emails')
s, b = admin({'action': 'import', 'emails': ['x@example.com'] * 301}); ok(s == 400, 'import caps at 300')

# ---------- broadcasts ----------
s, b = admin({'action': 'broadcast-create', 'template': 'launch-a'}); ok(s == 200 and b.get('status') == 'draft' and b.get('segment') == 'prospects', f'broadcast-create launch-a {b}')
bid = b.get('id')
st = state(); bc = next(x for x in st['broadcasts'] if x['id'] == bid)
seg_id = {x['name']: x['id'] for x in st['segments']}
ok(bc['status'] == 'draft' and not bc.get('send') and bc['segment_id'] == seg_id['prospects'] and bc['topic_id'] == st['topics'][0]['id'], 'draft on prospects with topic')
ok('{{{RESEND_UNSUBSCRIBE_URL}}}' in bc['html'] and bc['preview_text'] and bc['reply_to'] == ['hello@tracelings.com'] and bc['from'] == 'Tracelings <hello@tracelings.com>', 'broadcast content fields')
s, b = admin({'action': 'broadcast-create', 'template': 'launch-a-teacher'}); ok(s == 200 and b.get('segment') == 'teachers', 'teacher variant -> teachers')
for k in ('launch-b', 'launch-c'):
    s, b = admin({'action': 'broadcast-create', 'template': k}); ok(s == 200 and b.get('segment') == 'prospects', f'{k} draft')
s, b = admin({'action': 'broadcast-create', 'template': 'welcome-5'}); ok(s == 400, 'only launch templates can be broadcast')
s, b = admin({'action': 'broadcast-create', 'template': 'launch-a', 'segment': 'nope'}); ok(s == 400, 'bad segment 400')
ok(all(x['status'] == 'draft' for x in state()['broadcasts']), 'nothing sent by broadcast-create')
s, b = admin({'action': 'broadcast-send', 'id': bid}); ok(s == 400 and b.get('error') == 'confirm_required', 'send needs confirm')
s, b = admin({'action': 'broadcast-send', 'id': bid, 'confirm': 'yes'}); ok(s == 400, 'confirm must be SEND')
s, b = admin({'action': 'broadcast-send', 'id': bid, 'confirm': 'SEND', 'scheduled_at': '2020-01-01T00:00:00Z'}); ok(s == 400, 'past schedule rejected')
s, b = admin({'action': 'broadcast-send', 'id': bid, 'confirm': 'SEND', 'scheduled_at': '2030-01-01T15:00:00Z'}); ok(s == 200 and b.get('scheduled_at'), f'scheduled {b}')
ok(next(x for x in state()['broadcasts'] if x['id'] == bid)['status'] == 'scheduled', 'mock shows scheduled')
s, b = admin({'action': 'broadcast-send', 'id': bid, 'confirm': 'SEND'}); ok(s == 409, f'cannot send a non-draft ({s})')
bid_c = [x for x in state()['broadcasts'] if x['name'].startswith('Launch C')][0]['id']
s, b = admin({'action': 'broadcast-send', 'id': bid_c, 'confirm': 'SEND'}); ok(s == 200 and b.get('sent') is True, 'send now (mock only)')

# ---------- test send ----------
s, b = admin({'action': 'test-send', 'template': 'welcome-5', 'to': 'someone@example.com'}); ok(s == 403, f'test-send to non-owner refused ({s})')
s, b = admin({'action': 'test-send', 'template': 'nope', 'to': 'owner@example.com'}); ok(s == 400, 'unknown template 400')
s, b = admin({'action': 'test-send', 'template': 'welcome-5', 'to': 'Owner@Example.com'}); ok(s == 200, f'test-send to owner ({s} {b})')
em = state()['emails']
ok(len(em) == 1 and em[0]['to'] == ['owner@example.com'] and em[0]['subject'].startswith('[Test] ') and 'RESEND_UNSUBSCRIBE_URL' not in em[0]['html'], 'one test email to owner, placeholder replaced')

# ---------- stats ----------
s, b = admin({'action': 'stats'}); ok(s == 200 and b['segments']['everyone']['contacts'] >= 10 and b['segments']['teachers']['contacts'] == 4, f'stats segments {b.get("segments")}')
ok(any(x.get('delivered') is not None for x in b['broadcasts']) and all(v == 'enabled' for v in b['automations'].values()), 'stats broadcasts and automations')
s, b = admin({'action': 'templates'}); ok(s == 200 and len(b['templates']) == 20, 'templates list')

# ---------- member tagging ----------
subscribe('member@example.com', 'homeschool-k')
ok('prospects' in seg_names('member@example.com'), 'member starts in prospects')
s, b = http('POST', f'{BASE}/api/member/signin/', {'email': 'member@example.com', 'last4': '4242'}, {'Origin': BASE})
ok(s == 200, f'member sign-in ({s} {b})')
c = contact('member@example.com')
ok(c['properties'].get('member') == 'true', f'member=true after sign-in {c["properties"]}')
ok('members' in seg_names('member@example.com') and 'prospects' not in seg_names('member@example.com'), f'member segments {seg_names("member@example.com")}')
# A paying member who never joined the list is not added to it
s, b = http('POST', f'{BASE}/api/member/signin/', {'email': 'member2@example.com', 'last4': '1111'}, {'Origin': BASE})
ok(s == 200 and contact('member2@example.com') is None, 'member not on the list stays off it')
# Resend down: sign-in still works
mock('/__mode', 'down')
s, b = http('POST', f'{BASE}/api/member/signin/', {'email': 'family@example.com', 'last4': '5555'}, {'Origin': BASE})
mock('/__mode', 'ok')
ok(s == 200, f'sign-in works with Resend down ({s})')

# ---------- secrets and addresses stay out of logs ----------
# Astro 7 runs the dev server in the background; its request and console log comes from `astro dev logs`.
import subprocess
REPO = os.environ.get('REPO', os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
log = subprocess.run(['npx', 'astro', 'dev', 'logs'], cwd=REPO, capture_output=True, text=True, timeout=60).stdout
log += open(os.path.join(QA_OUT, 'logs', 'astro.out')).read()
ok('POST /api/subscribe/' in log, 'server log was read')
for secret in ('re_qa_mock_key', TOKEN, 'parent1@example.com', 'teach@austinisd.org', 'owner@example.com', 'member@example.com'):
    ok(secret not in log, f'server log does not contain {secret[:12]}...')
rlog = [json.loads(l) for l in open(os.path.join(QA_OUT, 'logs', 'resend-log.jsonl'))]
ok(all(r['auth'] == 'ok' for r in rlog if not r['path'].startswith('/__')), 'every Resend call carried the key')
ok(not any(r['path'] == '/broadcasts' and '"send": true' in r['body'].replace('":true', '": true') for r in rlog), 'no broadcast was created with send=true')

# ---------- rate limit on bad tokens (last: it locks this IP out for a while) ----------
codes = [admin({'action': 'stats'}, token='wrong-token-123456')[0] for _ in range(7)]
ok(codes[-1] == 429, f'bad tokens get rate limited {codes}')

print(f'{passes} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
