import os
import sys, json, time, threading, urllib.request
sys.path.insert(0, sys.argv[1])
from api import *
def mode(m): urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:'+os.environ.get('AI_PORT','4111')+'/__mode', data=m.encode(), method='POST')).read()
def count(): return json.loads(urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('AI_PORT','4111')+'/__count').read())['n']
s,b,c=signin('family@example.com','5555'); print('signin', s)
prof=lambda i,**k: {'id':f'c_aimode{i}','ageYears':5,'skills':{},'interests':['dinosaurs'],'daysPerWeek':5,'minutesPerDay':15,'faith':False,'createdAt':'2026-10-16T00:00:00.000Z',**k}
print(req('POST','/api/program/family/',{'children':[prof(1),prof(2,interests=['trucks']),prof(3,interests=['ocean'],ageYears=4)]},cookie=c)[0])
def fam(): return json.loads(req('GET','/api/program/family/',cookie=c)[1])
def week(cid, wi, redo=False):
    t=time.time(); s,b,_=req('POST','/api/program/week/',{'childId':cid,'weekIndex':wi,**({'redo':True} if redo else {})},cookie=c)
    try: j=json.loads(b)
    except: return s, b[:100], round(time.time()-t,1)
    return s, {'source':j.get('content',{}).get('source'),'cached':j.get('cached'),'note':j.get('note'),'redosLeft':j.get('redosLeft'),'err':j.get('error')}, round(time.time()-t,1)
for m in ['garbage','down','500','html','refusal','name','badmath','xss','hang-close']:
    mode(m); n0=count()
    r=week('c_aimode1',1)
    f=fam(); print(f'{m:10} ->', r, 'model calls', count()-n0, '| saved:', 'c_aimode1:1' in f['cached'])
mode('timeout'); n0=count(); r=week('c_aimode2',1); print('timeout    ->', r, 'calls', count()-n0)
mode('good')
r=week('c_aimode1',1); print('good       ->', r)
print('redo1', week('c_aimode1',1,True)); print('redo2', week('c_aimode1',1,True)); print('redo3', week('c_aimode1',1,True))
mode('down'); print('redo while AI down (on a week with redos left)', week('c_aimode3',1)); 
mode('good'); print('ai back: c_aimode3 week1', week('c_aimode3',1)); print('redo while down after:', end=' '); mode('down'); print(week('c_aimode3',1,True)); mode('good')
f=fam(); print('redos', f['redos'])
# concurrency: two parallel generations same week
mode('good'); res=[]
def go(): res.append(week('c_aimode2',2))
th=[threading.Thread(target=go) for _ in range(3)]; [t.start() for t in th]; [t.join() for t in th]
print('3 parallel same week ->', res)
# parallel adds of 2 different children when family has 3 (race the 4-child cap)
res=[]
def add(i): res.append(req('POST','/api/program/family/',{'children':[prof(10+i)]},cookie=c)[0])
th=[threading.Thread(target=add,args=(i,)) for i in range(3)]; [t.start() for t in th]; [t.join() for t in th]
print('3 parallel adds when 3 exist ->', res, 'children now', len(fam()['children']))
