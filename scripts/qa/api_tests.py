import sys, json, time
sys.path.insert(0, sys.argv[1])
from api import *
out=[]
def T(name, got, expect=None):
    s=got[0]; b=got[1][:220]
    ok = '' if expect is None else ('PASS' if (s in expect if isinstance(expect,(list,tuple,set)) else s==expect) else 'FAIL')
    out.append(f'{ok:4} {name}: {s} {b}'); print(out[-1])
# ---- unauthenticated
for m,p in [('GET','/api/program/family/'),('POST','/api/program/family/'),('POST','/api/program/week/'),('POST','/api/program/checkin/'),('POST','/api/member/cancel/'),('GET','/api/member/me/')]:
    T(f'no session {m} {p}', req(m,p,{} if m=='POST' else None), [401,200] if p.endswith('me/') else 401)
# ---- sign in
s,b,c1=signin('member@example.com','4242'); T('signin ok', (s,b), 200)
s,b,_=signin('member@example.com','0000'); T('signin wrong digits', (s,b), 401)
s,b,_=signin('nobody@example.com','4242'); T('signin unknown email', (s,b), 404)
s,b,_=signin('member@example.com',''); T('signin no digits', (s,b), 401)
s,b,_=signin('lapsed@example.com','4242'); T('signin lapsed member', (s,b), 404)
s,b,c_fam=signin('family@example.com','5555'); T('signin legacy family plan', (s,b), 200)
s,b,c_cls=signin('classroom@example.com','5555'); T('signin legacy classroom', (s,b), 200)
s,b,c_fnd=signin('founding@example.com','5555'); T('signin legacy founding', (s,b), 200)
s,b,c_two=signin('twocust@example.com','1234'); T('signin two customers, card on canceled customer only', (s,b))
s,b,c_two2=signin('twocust@example.com','5678'); T('signin two customers, card on active', (s,b), 200)
s,b,c_pend=signin('pending@example.com','2222'); T('signin PENDING sub', (s,b), 200)
s,b,c_cxl=signin('canceling@example.com','4242'); T('signin canceled-at-period-end', (s,b), 200)
s,b,c2=signin('member2@example.com','1111'); T('signin member2', (s,b), 200)
s,b,_=signin('  MEMBER@Example.com ','4242'); T('signin email case/space', (s,b), 200)
s,b,_=signin('founding@example.com','x5555'); T('signin last4 with junk chars', (s,b))
s,b,_=signin('founding@example.com','12345555'); T('signin long digits (slice -4)', (s,b))
# ---- me for each
for nm,c in [('member',c1),('family',c_fam),('classroom',c_cls),('founding',c_fnd),('pending',c_pend),('canceling',c_cxl)]:
    T(f'me {nm}', req('GET','/api/member/me/',cookie=c))
# ---- forged / expired
T('forged sig family', req('GET','/api/program/family/',cookie=forge('member@example.com',['C_M1'],secret=b'wrong-secret-wrong-secret-wrong-secret')), 401)
T('expired cookie', req('GET','/api/program/family/',cookie=forge('member@example.com',['C_M1'],exp_off=-10)), 401)
T('garbage cookie', req('GET','/api/program/family/',cookie='tl_member=abc.def'), 401)
T('cookie without sig', req('GET','/api/program/family/',cookie='tl_member=abc'), 401)
# signed with real secret but other customer ids: session for email X with cids of Y? (server trusts cids in cookie)
T('valid sig, email of member2 but cids of member1 (only possible with secret)', req('GET','/api/program/family/',cookie=forge('member2@example.com',['C_M1'])), 200)
# lapsed session (signed) non-member
T('signed session for lapsed -> program family', req('GET','/api/program/family/',cookie=forge('lapsed@example.com',['C_LAP'])), 403)
T('signed session no cids', req('GET','/api/program/family/',cookie=forge('x@example.com',[])), 403)
# ---- origin / method / content type
P={'childId':'c_abcd1','weekIndex':1}
T('week cross-origin', req('POST','/api/program/week/',P,cookie=c1,headers={'Origin':'https://evil.com'}), 403)
T('week missing origin + no sec-fetch', req('POST','/api/program/week/',P,cookie=c1,origin=False), 403)
T('week missing origin + sec-fetch same-origin', req('POST','/api/program/week/',P,cookie=c1,origin=False,headers={'Sec-Fetch-Site':'same-origin'}), [404,400])
T('week Origin null', req('POST','/api/program/week/',P,cookie=c1,headers={'Origin':'null'}), 403)
T('family GET cross-origin (reads allowed, CORS headers?)', req('GET','/api/program/family/',cookie=c1,headers={'Origin':'https://evil.com'}))
T('week GET method', req('GET','/api/program/week/',cookie=c1), [404,405])
T('family PUT', req('PUT','/api/program/family/',{},cookie=c1), [404,405])
T('family DELETE', req('DELETE','/api/program/family/',cookie=c1), [403,404,405])
T('week text/plain', req('POST','/api/program/week/',cookie=c1,raw=b'{"childId":"c_abcd1","weekIndex":1}',headers={'Content-Type':'text/plain'}), 415)
T('week bad json', req('POST','/api/program/week/',cookie=c1,raw=b'{bad'), 400)
T('family oversized body', req('POST','/api/program/family/',cookie=c1,raw=json.dumps({'children':[],'x':'a'*70000}).encode()), 413)
T('week json array body', req('POST','/api/program/week/',[1,2],cookie=c1), 400)
T('week json null body', req('POST','/api/program/week/',cookie=c1,raw=b'null'), 400)
T('week json string body', req('POST','/api/program/week/',cookie=c1,raw=b'"hi"'), 400)
T('checkin null body', req('POST','/api/program/checkin/',cookie=c1,raw=b'null'), 400)
T('family null body', req('POST','/api/program/family/',cookie=c1,raw=b'null'), 400)
# member api endpoints cross-origin
T('cancel cross-origin (CSRF)', req('POST','/api/member/cancel/',{},cookie=c_cxl,headers={'Origin':'https://evil.com'}), 403)
T('cancel text/plain cross-origin (simple request CSRF)', req('POST','/api/member/cancel/',cookie=c_cxl,raw=b'{}',headers={'Origin':'https://evil.com','Content-Type':'text/plain'}), 403)
T('signout cross-origin', req('POST','/api/member/signout/',{},headers={'Origin':'https://evil.com'}), 403)
T('checkout cross-origin text/plain', req('POST','/api/member/checkout/',raw=json.dumps({'email':'victim@example.com','plan':'program-annual'}).encode(),headers={'Origin':'https://evil.com','Content-Type':'text/plain'}), 403)
T('signin text/plain cross-origin', req('POST','/api/member/signin/',raw=json.dumps({'email':'member@example.com','last4':'4242'}).encode(),headers={'Origin':'https://evil.com','Content-Type':'text/plain'}), 403)
# ---- profiles
def prof(**k):
    p={'id':'c_qatest01','ageYears':5,'skills':{'letter-names':'learning'},'interests':['dinosaurs','space'],'daysPerWeek':5,'minutesPerDay':15,'faith':False,'createdAt':'2026-10-16T00:00:00.000Z'}; p.update(k); return p
T('family save ok', req('POST','/api/program/family/',{'children':[prof()]},cookie=c1), 200)
for key in ['name','childName','firstName','first_name','Name','kidName','nickname','label','fullName','displayName']:
    p=prof(); p[key]='Maximiliana'
    T(f'profile with {key}', req('POST','/api/program/family/',{'children':[p]},cookie=c1), 400)
for key in ['nick','alias','title','given_name','givenName','childFirstName','n','x']:
    p=prof(); p[key]='Maximiliana'
    T(f'profile with other key {key} (dropped? stored?)', req('POST','/api/program/family/',{'children':[p]},cookie=c1))
p=prof(); p['skills']={'letter-names':'learning','Maximiliana':'got-it'}
T('profile skill key name', req('POST','/api/program/family/',{'children':[p]},cookie=c1), 400)
T('profile id = name-like', req('POST','/api/program/family/',{'children':[prof(id='c_maximiliana')]},cookie=c1))
T('profile createdAt carrying name', req('POST','/api/program/family/',{'children':[prof(createdAt='2026-10-16 Maximiliana')]},cookie=c1))
s,b,_=req('GET','/api/program/family/',cookie=c1); out.append('INFO family after name probes contains Maximiliana: '+str('Maximiliana' in b or 'maximiliana' in b)); print(out[-1])
T('top-level unknown field', req('POST','/api/program/family/',{'children':[prof()],'name':'Bo'},cookie=c1), 400)
T('bad id path traversal', req('POST','/api/program/family/',{'children':[prof(id='../../etc')]},cookie=c1), 400)
T('bad id long', req('POST','/api/program/family/',{'children':[prof(id='c_'+'a'*30)]},cookie=c1), 400)
T('age 8', req('POST','/api/program/family/',{'children':[prof(ageYears=8)]},cookie=c1), 400)
T('age "5"', req('POST','/api/program/family/',{'children':[prof(ageYears='5')]},cookie=c1), 400)
T('age 5.0', req('POST','/api/program/family/',{'children':[prof(ageYears=5.0)]},cookie=c1), 200)
T('minutes 25', req('POST','/api/program/family/',{'children':[prof(minutesPerDay=25)]},cookie=c1), 400)
T('interests 4', req('POST','/api/program/family/',{'children':[prof(interests=['bugs','pets','farm','space'])]},cookie=c1), 400)
T('interests 0', req('POST','/api/program/family/',{'children':[prof(interests=[])]},cookie=c1), 400)
T('interests dup x3', req('POST','/api/program/family/',{'children':[prof(interests=['bugs','bugs','bugs'])]},cookie=c1), 200)
T('interests unknown', req('POST','/api/program/family/',{'children':[prof(interests=['lego'])]},cookie=c1), 400)
T('faith "yes"', req('POST','/api/program/family/',{'children':[prof(faith='yes')]},cookie=c1), 400)
T('createdAt far future', req('POST','/api/program/family/',{'children':[prof(createdAt='9999-12-31T00:00:00Z')]},cookie=c1))
T('children 5 in one call', req('POST','/api/program/family/',{'children':[prof(id=f'c_kid{i}x') for i in range(5)]},cookie=c1), 400)
T('remove 5', req('POST','/api/program/family/',{'remove':[f'c_kid{i}x' for i in range(5)]},cookie=c1), 400)
T('remove bad id', req('POST','/api/program/family/',{'remove':['../x']},cookie=c1), 400)
T('current out of range', req('POST','/api/program/family/',{'current':{'c_qatest01':999}},cookie=c1), 400)
T('current 0', req('POST','/api/program/family/',{'current':{'c_qatest01':0}},cookie=c1), 400)
T('current string', req('POST','/api/program/family/',{'current':{'c_qatest01':'3'}},cookie=c1), 400)
T('current unknown child', req('POST','/api/program/family/',{'current':{'c_nokid1':3}},cookie=c1), 400)
T('current proto key', req('POST','/api/program/family/',raw=b'{"current":{"__proto__":3}}',cookie=c1), 400)
T('plans proto key', req('POST','/api/program/family/',raw=b'{"plans":{"__proto__":{"childId":"x"}}}',cookie=c1), 400)
T('children non-array', req('POST','/api/program/family/',{'children':{'a':1}},cookie=c1), 400)
# client-supplied plan
plan={'childId':'c_qatest01','level':'kindergarten','current':1,'weeks':[{'index':1,'level':'kindergarten','baseWeek':36,'theme':'dinosaurs','focus':[]}]}
T('client plan 1 week jump to last base week', req('POST','/api/program/family/',{'plans':{'c_qatest01':plan}},cookie=c1))
plan2=dict(plan); plan2['weeks']=[{'index':i+1,'level':'kindergarten','baseWeek':1,'theme':'dinosaurs','focus':[]} for i in range(61)]
T('client plan 61 weeks', req('POST','/api/program/family/',{'plans':{'c_qatest01':plan2}},cookie=c1), 400)
plan3=dict(plan); plan3['weeks']=[{'index':1,'level':'kindergarten','baseWeek':1,'theme':'unicorns','focus':[]}]
T('client plan theme not child interest', req('POST','/api/program/family/',{'plans':{'c_qatest01':plan3}},cookie=c1))
plan4=dict(plan); plan4['weeks']=[{'index':1,'level':'kindergarten','baseWeek':1,'theme':'dinosaurs','focus':[],'math':{'number':-0}}]
plan5=dict(plan); plan5['weeks']=[{'index':1,'level':'pre-k','baseWeek':1,'theme':'dinosaurs','focus':[],'math':{'number':20}}]
T('client plan math 20 pre-k', req('POST','/api/program/family/',{'plans':{'c_qatest01':plan5}},cookie=c1))
T('client plan math 0', req('POST','/api/program/family/',{'plans':{'c_qatest01':{**plan,'weeks':[{'index':1,'level':'kindergarten','baseWeek':1,'theme':'dinosaurs','focus':[],'math':{'number':0}}]}}},cookie=c1))
# restore a fresh placement
# A change of track (Kindergarten -> Pre-K) needs the parent's OK ('restart'), otherwise 409 restart_needed (QA M2).
T('re-place: track change without restart refused', req('POST','/api/program/family/',{'children':[prof(ageYears=4)]},cookie=c1), 409)
T('re-place by resaving profile with restart', req('POST','/api/program/family/',{'children':[prof(ageYears=4)],'restart':['c_qatest01']},cookie=c1), 200)
# ---- week endpoint
T('week bad childId traversal', req('POST','/api/program/week/',{'childId':'../../x','weekIndex':1},cookie=c1), 400)
T('week unknown child', req('POST','/api/program/week/',{'childId':'c_nokid1','weekIndex':1},cookie=c1), 404)
T('week 0', req('POST','/api/program/week/',{'childId':'c_qatest01','weekIndex':0},cookie=c1), 400)
T('week 61', req('POST','/api/program/week/',{'childId':'c_qatest01','weekIndex':61},cookie=c1), 400)
T('week 1.5', req('POST','/api/program/week/',{'childId':'c_qatest01','weekIndex':1.5},cookie=c1), 400)
T('week "1"', req('POST','/api/program/week/',{'childId':'c_qatest01','weekIndex':'1'},cookie=c1), 400)
T('week 50 beyond plan', req('POST','/api/program/week/',{'childId':'c_qatest01','weekIndex':50},cookie=c1), 404)
T('week unknown field name', req('POST','/api/program/week/',{'childId':'c_qatest01','weekIndex':1,'name':'Bo'},cookie=c1), 400)
T('week redo "true"', req('POST','/api/program/week/',{'childId':'c_qatest01','weekIndex':1,'redo':'true'},cookie=c1), 400)
s,b,_=req('POST','/api/program/week/',{'childId':'c_qatest01','weekIndex':1},cookie=c1); T('week 1 generate', (s,b), 200)
try:
    j=json.loads(b); out.append(f"INFO week1 source={j['content']['source']} cached={j['cached']} note={j.get('note')} redosLeft={j['redosLeft']}"); print(out[-1])
except Exception as e: print(e)
s,b,_=req('POST','/api/program/week/',{'childId':'c_qatest01','weekIndex':1},cookie=c1); j=json.loads(b); out.append(f"INFO week1 again cached={j['cached']}"); print(out[-1])
s,b,_=req('POST','/api/program/week/',{'childId':'c_qatest01','weekIndex':2},cookie=c1); j=json.loads(b); out.append(f"INFO week2 (current+1) source={j['content']['source']} note={j.get('note')}"); print(out[-1])
s,b,_=req('POST','/api/program/week/',{'childId':'c_qatest01','weekIndex':3},cookie=c1); j=json.loads(b); out.append(f"INFO week3 (current+2) source={j['content']['source']} note={j.get('note')}"); print(out[-1])
# ---- checkin
T('checkin unknown skill', req('POST','/api/program/checkin/',{'childId':'c_qatest01','weekIndex':1,'results':{'flying':'got-it'}},cookie=c1), 400)
T('checkin empty', req('POST','/api/program/checkin/',{'childId':'c_qatest01','weekIndex':1,'results':{}},cookie=c1), 400)
T('checkin bad value', req('POST','/api/program/checkin/',{'childId':'c_qatest01','weekIndex':1,'results':{'name-writing':'learning'}},cookie=c1), 400)
T('checkin week 99', req('POST','/api/program/checkin/',{'childId':'c_qatest01','weekIndex':99,'results':{'name-writing':'got-it'}},cookie=c1), 400)
T('checkin extra field', req('POST','/api/program/checkin/',{'childId':'c_qatest01','weekIndex':1,'results':{'name-writing':'got-it'},'name':'Maximiliana','note':'Maximiliana did great'},cookie=c1))
T('checkin skill not in week focus', req('POST','/api/program/checkin/',{'childId':'c_qatest01','weekIndex':1,'results':{'add-10':'got-it'}},cookie=c1))
T('checkin future week 30 refused (QA M3)', req('POST','/api/program/checkin/',{'childId':'c_qatest01','weekIndex':30,'results':{'letter-names':'still-working'}},cookie=c1), 409)
s,b,_=req('GET','/api/program/family/',cookie=c1); j=json.loads(b); pl=j['plans']['c_qatest01']; out.append(f"INFO after checkin wk30: current={pl['current']} len={len(pl['weeks'])}  (a checkin on a future week jumps current?)"); print(out[-1])
out.append('INFO family keys: '+','.join(j.keys())+f" checkIns={len(j['checkIns'])}; 'Maximiliana' in response: {'Maximiliana' in b}"); print(out[-1])
# ---- cross family
s,b,_=req('GET','/api/program/family/',cookie=c2); j2=json.loads(b); out.append(f"INFO member2 sees children: {[c['id'] for c in j2['children']]}"); print(out[-1])
T('member2 week for member1 child', req('POST','/api/program/week/',{'childId':'c_qatest01','weekIndex':1},cookie=c2), 404)
T('member2 checkin member1 child', req('POST','/api/program/checkin/',{'childId':'c_qatest01','weekIndex':1,'results':{'name-writing':'got-it'}},cookie=c2), 404)
T('member2 remove member1 child', req('POST','/api/program/family/',{'remove':['c_qatest01']},cookie=c2), 200)
s,b,_=req('GET','/api/program/family/',cookie=c1); out.append(f"INFO member1 child still present after member2 remove: {'c_qatest01' in b}"); print(out[-1])
# same child id in two families
T('member2 save same child id', req('POST','/api/program/family/',{'children':[prof()]},cookie=c2), 200)
s,b,_=req('GET','/api/program/family/',cookie=c1); out.append(f"INFO member1 child unchanged? ageYears={json.loads(b)['children'][0]['ageYears']}"); print(out[-1])
# secrets in responses
s,b,h=req('GET','/api/member/status/'); out.append(f"INFO status: {b}"); print(out[-1])
leaks=[]
for p in ['/api/member/me/','/api/program/family/','/api/member/status/']:
    s,b,h=req('GET',p,cookie=c1)
    for sec in ['sk-ant','SECRETSQ','sq-qa-token','qa-secret','C_M1','S_M1','LOC1']:
        if sec in b or sec in json.dumps(h): leaks.append((p,sec))
out.append(f'INFO secret/id leaks in responses: {leaks}'); print(out[-1])
# rate limit: 5 wrong then right
for i in range(5): signin('pending@example.com','0000')
s,b,_=signin('pending@example.com','2222'); T('signin after 5 wrong -> rate limited (correct digits)', (s,b), 429)
# enumeration: unknown email errors differ from known? (already seen: 404 vs 401)
# brute force across emails is not limited per IP:
t=[signin('classroom@example.com',f'{i:04d}')[0] for i in range(6)]
out.append(f'INFO wrong-digit statuses member: {t}'); print(out[-1])

open(sys.argv[2],'w').write('\n'.join(out))
