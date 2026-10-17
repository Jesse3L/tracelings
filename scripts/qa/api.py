import os
import json, sys, time, base64, hmac, hashlib, urllib.request, urllib.error
B='http://127.0.0.1:'+os.environ.get('QA_PORT','4421')
SECRET=b'qa-secret-qa-secret-qa-secret-0123456789XYZ'
def req(method, path, body=None, headers=None, cookie=None, raw=None, origin=True, retry=True):
    r=_req(method,path,body,headers,cookie,raw,origin)
    if retry and r[0]==429 and 'slow_down' in r[1]:
        time.sleep(61); r=_req(method,path,body,headers,cookie,raw,origin)
    return r
def _req(method, path, body=None, headers=None, cookie=None, raw=None, origin=True):
    h={}
    if body is not None or raw is not None: h['Content-Type']='application/json'
    if origin and method=='POST': h['Origin']=B
    if cookie: h['Cookie']=cookie
    h.update(headers or {})
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    r=urllib.request.Request(B+path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=90) as res: return res.status, res.read().decode(), dict(res.headers)
    except urllib.error.HTTPError as e: return e.code, e.read().decode(), dict(e.headers)
def signin(email, last4):
    s,b,h=req('POST','/api/member/signin/',{'email':email,'last4':last4})
    sc=next((v for k,v in h.items() if k.lower()=='set-cookie'),'')
    c=sc.split(';')[0] if 'tl_member=' in sc else None
    return s,b,c
def forge(email, cids, exp_off=3600, secret=SECRET):
    body=base64.urlsafe_b64encode(json.dumps({'email':email,'cids':cids,'exp':int(time.time())+exp_off}).encode()).rstrip(b'=').decode()
    sig=base64.urlsafe_b64encode(hmac.new(secret, body.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
    return f'tl_member={body}.{sig}'
