"""Read-only account validation: invalid requests must never reach RADIUS.
Run against an isolated candidate before production; no real credentials needed.
"""
import argparse,json,urllib.request,urllib.error
p=argparse.ArgumentParser();p.add_argument('--base',default='http://127.0.0.1:8080');a=p.parse_args()
checks=0
def request(path,data=None,raw=None):
 body=raw if raw is not None else None if data is None else json.dumps(data).encode()
 req=urllib.request.Request(a.base+path,data=body,headers={} if body is None else {'Content-Type':'application/json'})
 try:
  r=urllib.request.urlopen(req,timeout=8);return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,e.read()
def check(ok,label):
 global checks
 if not ok:raise AssertionError(label)
 checks+=1;print('PASS',label,flush=True)
for label,data in [
 ('missing fields',{}),('empty values',{'username':'','password':''}),
 ('missing password',{'username':'validation-only'}),('missing username',{'password':'validation-only'}),
 ('null payload',None),('array payload',[]),
 ('non-string username',{'username':123,'password':'validation-only'}),
 ('non-string password',{'username':'validation-only','password':{'unexpected':True}}),
 ('whitespace username',{'username':'   ','password':'validation-only'}),
 ('oversized username',{'username':'u'*129,'password':'validation-only'}),
 ('oversized password',{'username':'validation-only','password':'p'*129}),
 ('multibyte password byte limit',{'username':'validation-only','password':'ก'*43}),
 ('multibyte username byte limit',{'username':'ก'*85,'password':'validation-only'})]:
 status,body=request('/api/authenticate',raw=json.dumps(data).encode())
 check(status==400,label+' returns 400')
 check(json.loads(body).get('success') is False,label+' reports failure')
status,body=request('/api/authenticate',raw=b'{"password":"sensitive-test-marker",')
check(status==400,'malformed JSON returns 400')
check(b'sensitive-test-marker' not in body,'parse errors do not echo submitted values')
status,body=request('/auth');check(status==200 and b'<html' in body.lower(),'server remains alive and serves portal after malformed JSON')
status,body=request('/api/user');check(status==401,'anonymous profile remains protected')
print('ALL',checks,'CHECKS PASSED')
