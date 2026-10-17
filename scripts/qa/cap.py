import os
import sys, json, urllib.request
sys.path.insert(0, sys.argv[1])
from api import *
def mode(m): urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:'+os.environ.get('AI_PORT','4111')+'/__mode', data=m.encode(), method='POST')).read()
s,b,c=signin('member@example.com','4242'); print('signin',s)
p={'id':'c_capkid1','ageYears':5,'skills':{},'interests':['dinosaurs'],'daysPerWeek':5,'minutesPerDay':15,'faith':False,'createdAt':'2026-10-16T00:00:00.000Z'}
req('POST','/api/program/family/',{'children':[p]},cookie=c)
mode('garbage')
for i in range(2): print('print while AI returns garbage', i+1, json.loads(req('POST','/api/program/week/',{'childId':'c_capkid1','weekIndex':1},cookie=c)[1]).get('note'))
mode('good')
print('AI healthy again, first ever successful print ->', json.loads(req('POST','/api/program/week/',{'childId':'c_capkid1','weekIndex':1},cookie=c)[1]).get('note'), '(family cap=4; two failed clicks x 2 attempts = 4 burned)')
