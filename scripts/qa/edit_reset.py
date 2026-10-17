import sys, json
sys.path.insert(0, sys.argv[1])
from api import *
s,b,c=signin('classroom@example.com','5555'); print('signin',s)
p={'id':'c_editkid1','ageYears':5,'skills':{},'interests':['dinosaurs'],'daysPerWeek':5,'minutesPerDay':15,'faith':False,'createdAt':'2026-10-16T00:00:00.000Z'}
req('POST','/api/program/family/',{'children':[p]},cookie=c)
req('POST','/api/program/family/',{'current':{'c_editkid1':5}},cookie=c)
req('POST','/api/program/checkin/',{'childId':'c_editkid1','weekIndex':5,'results':{'letter-sounds':'still-working'}},cookie=c)
f=json.loads(req('GET','/api/program/family/',cookie=c)[1]); pl=f['plans']['c_editkid1']; print('before edit: current',pl['current'],'len',len(pl['weeks']),'reviews',sum(1 for w in pl['weeks'] if w.get('extraReview')))
p2=dict(p, interests=['dinosaurs','ocean'])
f=json.loads(req('POST','/api/program/family/',{'children':[p2]},cookie=c)[1]); pl=f['plans']['c_editkid1']; print('after adding an interest: current',pl['current'],'len',len(pl['weeks']),'reviews',sum(1 for w in pl['weeks'] if w.get('extraReview')),'checkIns kept',len(f['checkIns']))
