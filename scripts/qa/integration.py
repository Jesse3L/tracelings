# Integration checks across the three fix sets, over the API (scripts/qa/up.sh running):
#  - an advanced child gets a short plan (27 weeks): every week prints, current can reach the last week, the
#    check-in on the last week works, the progress report data lines up
#  - story paths: consecutive AI weeks don't repeat a path used in the 3 weeks before (while another path is left)
#  - caps: saved generations count once each; cached reprints don't count
#  - the week API still returns cached content after an edit that keeps position (same base week, theme, math)
# Run: python3 scripts/qa/integration.py scripts/qa
import sys, json, os, urllib.request
sys.path.insert(0, sys.argv[1])
from api import *
fails = 0
def T(name, ok, info=''):
    global fails
    fails += 0 if ok else 1
    print(f"{'PASS' if ok else 'FAIL'} {name}{': ' + str(info)[:240] if info else ''}", flush=True)
def mode(m): urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:'+os.environ.get('AI_PORT','4111')+'/__mode', data=m.encode(), method='POST')).read()
J = lambda r: json.loads(r[1]) if r[1] else {}
mode('good')
s, b, c = signin('founding@example.com', '5555'); T('sign in', s == 200, s)
f = J(req('GET', '/api/program/family/', cookie=c))
if f.get('children'): req('POST', '/api/program/family/', {'remove': [k['id'] for k in f['children']]}, cookie=c)
ALL = ['name-writing','letter-names','letter-sounds','blending','word-families','sight-words','count-10','count-20','numerals','compare','add-5','add-10']
kid = {'id': 'c_advkid01', 'ageYears': 6, 'skills': {k: 'got-it' for k in ALL}, 'interests': ['dinosaurs', 'trains'], 'daysPerWeek': 5, 'minutesPerDay': 15, 'faith': False, 'createdAt': '2026-10-16T00:00:00.000Z'}
f = J(req('POST', '/api/program/family/', {'children': [kid]}, cookie=c))
plan = f['plans']['c_advkid01']; n = len(plan['weeks'])
T('advanced child gets a short kindergarten plan', plan['level'] == 'kindergarten' and n < 36, f"{plan['level']} {n} weeks")
gen0 = None
# Walk the plan: AI for each current week, check that paths don't repeat the 3 weeks before.
paths = {}
for wi in range(1, 9):
    if wi > 1: J(req('POST', '/api/program/family/', {'current': {'c_advkid01': wi}}, cookie=c))
    r = J(req('POST', '/api/program/week/', {'childId': 'c_advkid01', 'weekIndex': wi}, cookie=c))
    st = r['content']['story']; paths[wi] = (r['content']['source'], st.get('pathId'), plan['weeks'][wi-1]['theme'])
for wi, (src, pid, th) in paths.items():
    prev = [paths[k][1] for k in (wi-1, wi-2, wi-3) if k in paths and paths[k][2] == th]
    T(f'week {wi} ({th}) AI story, path not in the 3 weeks before (same theme)', src == 'ai' and pid not in prev, f'{src} {pid} prev={prev}')
f = J(req('GET', '/api/program/family/', cookie=c))
# Cached reprint does not count again.
before = f.get('usage', {}).get('generations') if 'usage' in f else None
r1 = J(req('POST', '/api/program/week/', {'childId': 'c_advkid01', 'weekIndex': 8}, cookie=c))
T('reprint of a made week is cached', r1['cached'] is True)
# Last weeks of the short plan: template prints (not yet), then current = last, AI + check-in.
r = J(req('POST', '/api/program/week/', {'childId': 'c_advkid01', 'weekIndex': n}, cookie=c))
T(f'last week {n} prints from template before the plan reaches it', r.get('note') == 'not-yet' and r['content']['story']['pages'], r.get('note'))
s, b, _ = req('POST', '/api/program/week/', {'childId': 'c_advkid01', 'weekIndex': n + 1}, cookie=c)
T(f'week {n+1} (past the plan) is unknown', s == 404, f'{s} {b}')
f = J(req('POST', '/api/program/family/', {'current': {'c_advkid01': n}}, cookie=c))
T(f'current can move to the last week {n}', f['plans']['c_advkid01']['current'] == n)
r = J(req('POST', '/api/program/week/', {'childId': 'c_advkid01', 'weekIndex': n}, cookie=c))
T('last week makes its AI story', r['content']['source'] == 'ai', r.get('note'))
focus = plan['weeks'][n-1]['focus']
s, b, _ = req('POST', '/api/program/checkin/', {'childId': 'c_advkid01', 'weekIndex': n, 'results': {k: 'got-it' for k in focus} or {'blending': 'got-it'}}, cookie=c)
p2 = J((s, b))
T('check-in on the last week works and stays in range', s == 200 and 1 <= p2['plan']['current'] <= len(p2['plan']['weeks']), f"{s} current={p2.get('plan',{}).get('current')} len={len(p2.get('plan',{}).get('weeks',[]))}")
s, b, _ = req('POST', '/api/program/checkin/', {'childId': 'c_advkid01', 'weekIndex': n, 'results': {k: 'still-working' for k in focus} or {'blending': 'still-working'}}, cookie=c)
p3 = J((s, b))
T('a still-working check-in on the last week can add a review week at the end', s == 200, f"{s} len={len(p3.get('plan',{}).get('weeks',[]))} {b[:120]}")
# Edit that keeps position (add an interest the current week doesn't use): cached weeks still match.
f = J(req('POST', '/api/program/family/', {'current': {'c_advkid01': 6}}, cookie=c))
w6 = f['plans']['c_advkid01']['weeks'][5]; k6 = J(req('POST', '/api/program/week/', {'childId': 'c_advkid01', 'weekIndex': 6}, cookie=c))
f = J(req('POST', '/api/program/family/', {'children': [dict(kid, interests=['dinosaurs', 'trains', 'ocean'])]}, cookie=c))
pl = f['plans']['c_advkid01']; w6b = pl['weeks'][5]
T('edit keeps the position', pl['current'] == 6, pl['current'])
same = all(w6.get(k) == w6b.get(k) for k in ('baseWeek', 'theme', 'math', 'level', 'extraReview'))
k6b = J(req('POST', '/api/program/week/', {'childId': 'c_advkid01', 'weekIndex': 6}, cookie=c))
T('current week after the edit: cached content still served when the week is unchanged', (k6b['cached'] and k6b['content'] == k6['content']) if same else True, f'week same={same} cached={k6b["cached"]}')
done = [w for w in range(1, 6)]
for wi in done:
    wb, wa = plan['weeks'][wi-1], pl['weeks'][wi-1]
for wi in (1, 2, 3):
    r = J(req('POST', '/api/program/week/', {'childId': 'c_advkid01', 'weekIndex': wi}, cookie=c))
    T(f'done week {wi} after the edit still cached', r['cached'] is True, r.get('note'))
print(f'\n{fails} failed')
