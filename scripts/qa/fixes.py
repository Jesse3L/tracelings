# Regression checks for the QA program fixes (C1, C2, M2, M3, M9 over the API). Prints PASS/FAIL per check.
# Run with scripts/qa/up.sh running:  python3 scripts/qa/fixes.py scripts/qa [out.txt]
import sys, json, os, urllib.request
sys.path.insert(0, sys.argv[1])
from api import *
SQ = 'http://127.0.0.1:' + os.environ.get('SQ_PORT', '4110')
out = []; fails = 0
def T(name, ok, info=''):
    global fails
    fails += 0 if ok else 1
    out.append(f"{'PASS' if ok else 'FAIL'} {name}{': ' + str(info)[:300] if info else ''}"); print(out[-1], flush=True)
def cookie_of(h, name):
    for k, v in h.items():
        if k.lower() == 'set-cookie':
            for part in v.split(', '):
                if part.startswith(name + '='): return part.split(';')[0]
    return None
def sq_pay(order_id, email, last4='7777'):
    # The buyer pays on Square (test hook). Pays the newest open order for this email when the cookie has no order id.
    r = urllib.request.Request(f'{SQ}/__pay/{order_id or "latest"}', data=json.dumps({'email': email, 'last4': last4}).encode(), method='POST')
    try: return json.loads(urllib.request.urlopen(r).read())
    except Exception as e: return {'error': str(e)}
def order_from(pending):
    import base64
    try:
        body = pending.split('=', 1)[1].split('.')[0]
        return json.loads(base64.urlsafe_b64decode(body + '=' * (-len(body) % 4))).get('orderId')
    except Exception: return None

# ---------- C1: pending cookie takeover ----------
s, b, h = req('POST', '/api/member/checkout/', {'email': 'fresh@example.com', 'plan': 'program-monthly'})
pend = cookie_of(h, 'tl_pending')
s2, b2, h2 = req('POST', '/api/member/signin/', {'email': 'fresh@example.com'}, cookie=pend)
T('C1 attacker checkout for a victim email + pending cookie gives no session', s2 != 200 and not cookie_of(h2, 'tl_member'), f'{s2} {b2}')
# Attacker even "pays" their own checkout under the victim's email: the victim already had a subscription, so no.
if pend:
    sq_pay(order_from(pend), 'fresh@example.com')
    s3, b3, h3 = req('POST', '/api/member/signin/', {'email': 'fresh@example.com'}, cookie=pend)
    T('C1 paying a new checkout under an existing member email still needs the card digits', s3 != 200 and not cookie_of(h3, 'tl_member'), f'{s3} {b3}')
# Forged/old-format pending cookie (no order id) is ignored.
s4, b4, h4 = req('POST', '/api/member/signin/', {'email': 'fresh@example.com'}, cookie=forge('fresh@example.com', []).replace('tl_member', 'tl_pending'))
T('C1 pending cookie without an order id is ignored', s4 == 401 and 'need_last4' in b4, f'{s4} {b4}')
# Real buyer: new email, checkout in this browser, pays, signs in without digits.
s, b, h = req('POST', '/api/member/checkout/', {'email': 'newbuyer@example.com', 'plan': 'program-annual'})
p2 = cookie_of(h, 'tl_pending')
s5, b5, _ = req('POST', '/api/member/signin/', {'email': 'newbuyer@example.com'}, cookie=p2)
T('C1 real buyer before paying: not signed in yet (retry hint)', s5 in (401, 404) , f'{s5} {b5}')
sq_pay(order_from(p2), 'newbuyer@example.com', '3141')
s6, b6, h6 = req('POST', '/api/member/signin/', {'email': 'newbuyer@example.com'}, cookie=p2)
T('C1 real buyer after paying signs straight in from the same browser', s6 == 200 and bool(cookie_of(h6, 'tl_member')), f'{s6} {b6}')
# Another browser (no cookie) for the same fresh buyer still needs digits.
s7, b7, _ = req('POST', '/api/member/signin/', {'email': 'newbuyer@example.com'})
T('C1 the same buyer in another browser needs the card digits', s7 == 401 and 'need_last4' in b7, f'{s7} {b7}')
# Pending cookie issued for email A used to sign in as email B.
s, b, h = req('POST', '/api/member/checkout/', {'email': 'someone@example.com', 'plan': 'program-annual'})
p3 = cookie_of(h, 'tl_pending')
s8, b8, h8 = req('POST', '/api/member/signin/', {'email': 'newbuyer@example.com'}, cookie=p3)
T('C1 pending cookie for another email does not sign in', s8 != 200, f'{s8} {b8}')

# ---------- C2: cross-site POSTs on /api/member/* ----------
s, b, c_cxl = signin('canceling@example.com', '4242')
for path, body in [('/api/member/cancel/', {}), ('/api/member/signout/', {}), ('/api/member/checkout/', {'email': 'victim@example.com', 'plan': 'program-annual'}), ('/api/member/signin/', {'email': 'member@example.com', 'last4': '4242'})]:
    s, b, h = req('POST', path, body, cookie=c_cxl, headers={'Origin': 'https://evil.com'})
    T(f'C2 cross-origin POST {path} refused', s == 403 and 'bad_origin' in b, f'{s} {b}')
    s, b, h = req('POST', path, cookie=c_cxl, raw=json.dumps(body).encode(), headers={'Origin': 'https://evil.com', 'Content-Type': 'text/plain'})
    T(f'C2 cross-origin text/plain POST {path} refused', s == 403, f'{s} {b}')
    s, b, h = req('POST', path, body, cookie=c_cxl, origin=False)
    T(f'C2 POST {path} with no Origin and no Sec-Fetch-Site refused', s == 403, f'{s} {b}')
s, b, h = req('GET', '/api/member/cancel/', cookie=c_cxl)
T('C2 GET cancel not allowed', s in (404, 405), s)
s, b, h = req('POST', '/api/member/signout/', {}, cookie=c_cxl, origin=False, headers={'Sec-Fetch-Site': 'same-origin'})
T('C2 same-origin sign-out (Sec-Fetch-Site) works', s == 200, f'{s} {b}')

# ---------- M3: check-in for a future week ----------
s, b, c = signin('member2@example.com', '1111')
prof = {'id': 'c_fixm3aa', 'ageYears': 5, 'skills': {}, 'interests': ['dinosaurs'], 'daysPerWeek': 5, 'minutesPerDay': 15, 'faith': False, 'createdAt': '2026-10-16T00:00:00.000Z'}
req('POST', '/api/program/family/', {'remove': ['c_fixm3aa', 'c_fixm2aa']}, cookie=c)
req('POST', '/api/program/family/', {'children': [prof]}, cookie=c)
s, b, _ = req('POST', '/api/program/checkin/', {'childId': 'c_fixm3aa', 'weekIndex': 30, 'results': {'letter-names': 'still-working'}}, cookie=c)
f = json.loads(req('GET', '/api/program/family/', cookie=c)[1]); pl = f['plans']['c_fixm3aa']
T('M3 check-in for week 30 refused and current stays 1', s == 409 and pl['current'] == 1, f'{s} {b} current={pl["current"]}')
s, b, _ = req('POST', '/api/program/checkin/', {'childId': 'c_fixm3aa', 'weekIndex': 2, 'results': {'letter-names': 'still-working'}}, cookie=c)
T('M3 check-in for next week refused', s == 409, f'{s} {b}')
s, b, _ = req('POST', '/api/program/checkin/', {'childId': 'c_fixm3aa', 'weekIndex': 1, 'results': {'name-writing': 'got-it'}}, cookie=c)
f = json.loads(req('GET', '/api/program/family/', cookie=c)[1]); pl = f['plans']['c_fixm3aa']
T('M3 check-in for the current week works and moves on', s == 200 and pl['current'] == 2, f'{s} current={pl["current"]}')
s, b, _ = req('POST', '/api/program/checkin/', {'childId': 'c_fixm3aa', 'weekIndex': 1, 'results': {'name-writing': 'got-it'}}, cookie=c)
f = json.loads(req('GET', '/api/program/family/', cookie=c)[1]); pl = f['plans']['c_fixm3aa']
T('M3 late check-in for last week allowed, current unchanged', s == 200 and pl['current'] == 2, f'{s} current={pl["current"]}')
req('POST', '/api/program/family/', {'current': {'c_fixm3aa': 6}}, cookie=c)
s, b, _ = req('POST', '/api/program/checkin/', {'childId': 'c_fixm3aa', 'weekIndex': 3, 'results': {'name-writing': 'got-it'}}, cookie=c)
T('M3 check-in three weeks back refused', s == 409, f'{s} {b}')

# ---------- M9: repeated still-working ----------
req('POST', '/api/program/family/', {'remove': ['c_fixm3aa']}, cookie=c)
req('POST', '/api/program/family/', {'children': [dict(prof, id='c_fixm9aa', ageYears=4)]}, cookie=c)
for i in range(5):
    pl = json.loads(req('GET', '/api/program/family/', cookie=c)[1])['plans']['c_fixm9aa']
    wk = pl['weeks'][pl['current'] - 1]
    req('POST', '/api/program/checkin/', {'childId': 'c_fixm9aa', 'weekIndex': pl['current'], 'results': {s: 'still-working' for s in wk['focus']}}, cookie=c)
    req('POST', '/api/program/checkin/', {'childId': 'c_fixm9aa', 'weekIndex': pl['current'], 'results': {s: 'still-working' for s in wk['focus']}}, cookie=c)  # double submit
pl = json.loads(req('GET', '/api/program/family/', cookie=c)[1])['plans']['c_fixm9aa']
ws = pl['weeks']
stack = [i for i in range(1, len(ws)) if ws[i].get('extraReview') and ws[i - 1].get('extraReview')]
T('M9 five still-working check-ins (each sent twice) never stack review weeks', not stack, f"len={len(ws)} reviews={sum(1 for w in ws if w.get('extraReview'))} stacked at {stack[:5]}")
req('POST', '/api/program/family/', {'remove': ['c_fixm9aa']}, cookie=c)

# ---------- M2: editing a child keeps the plan ----------
p = dict(prof, id='c_fixm2aa')
req('POST', '/api/program/family/', {'children': [p]}, cookie=c)
req('POST', '/api/program/family/', {'current': {'c_fixm2aa': 5}}, cookie=c)
req('POST', '/api/program/checkin/', {'childId': 'c_fixm2aa', 'weekIndex': 5, 'results': {'letter-sounds': 'still-working'}}, cookie=c)
f = json.loads(req('GET', '/api/program/family/', cookie=c)[1]); before = f['plans']['c_fixm2aa']
s, b, _ = req('POST', '/api/program/family/', {'children': [dict(p, interests=['dinosaurs', 'ocean'])]}, cookie=c)
after = json.loads(b)['plans']['c_fixm2aa']
T('M2 adding an interest keeps current week, length and review weeks', after['current'] == before['current'] and len(after['weeks']) == len(before['weeks']) and sum(1 for w in after['weeks'] if w.get('extraReview')) == sum(1 for w in before['weeks'] if w.get('extraReview')),
  f"current {before['current']}->{after['current']} len {len(before['weeks'])}->{len(after['weeks'])}")
T('M2 weeks done are unchanged', [(w['baseWeek'], w['theme']) for w in after['weeks'][:before['current'] - 1]] == [(w['baseWeek'], w['theme']) for w in before['weeks'][:before['current'] - 1]])
# (age 5 with no letters is Pre-K; "letter names: learning" moves a 5 year old to Kindergarten)
s, b, _ = req('POST', '/api/program/family/', {'children': [dict(p, interests=['dinosaurs', 'ocean'], skills={'count-10': 'learning', 'name-writing': 'got-it'})]}, cookie=c)
a2 = json.loads(b).get('plans', {}).get('c_fixm2aa', {})
T('M2 editing skills on the same track keeps the position', s == 200 and a2.get('current') == before['current'] and a2.get('level') == before['level'], f"{s} current={a2.get('current')} {b[:120] if s != 200 else ''}")
s, b, _ = req('POST', '/api/program/family/', {'children': [dict(p, skills={'letter-names': 'learning'})]}, cookie=c)
T('M2 a track change without restart is refused with restart_needed', s == 409 and 'restart_needed' in b, f'{s} {b[:160]}')
f = json.loads(req('GET', '/api/program/family/', cookie=c)[1])
T('M2 ... and nothing changed', f['plans']['c_fixm2aa']['current'] == before['current'] and f['plans']['c_fixm2aa']['level'] == before['level'])
s, b, _ = req('POST', '/api/program/family/', {'children': [dict(p, skills={'letter-names': 'learning'})], 'restart': ['c_fixm2aa']}, cookie=c)
a3 = json.loads(b)['plans']['c_fixm2aa'] if s == 200 else {}
T('M2 with restart the plan starts over on the new track', s == 200 and a3.get('level') == 'kindergarten' and a3.get('current') == 1, f"{s} {a3.get('level')} {a3.get('current')}")
req('POST', '/api/program/family/', {'remove': ['c_fixm2aa']}, cookie=c)

print(f'\n{fails} failed')
if len(sys.argv) > 2: open(sys.argv[2], 'w').write('\n'.join(out) + f'\n\n{fails} failed\n')
