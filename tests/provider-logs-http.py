"""Non-destructive HTTP checks. Requires the disposable pc-ui-qa local fixture.
Successful destructive clears are covered separately in isolated QA tables.
"""
import urllib.request,urllib.error,urllib.parse,http.cookiejar,json,re
jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(jar));base='http://127.0.0.1:8001/';checks=0

def request(path,data=None,csrf=None):
 headers={'Accept':'application/json'}
 if data is not None:headers['Content-Type']='application/json'
 if csrf:headers['X-CSRF-Token']=csrf
 try:
  r=opener.open(urllib.request.Request(base+path,data=None if data is None else json.dumps(data).encode(),headers=headers),timeout=12);return r.status,r.read().decode()
 except urllib.error.HTTPError as e:return e.code,e.read().decode()
def check(ok,label):
 global checks
 if not ok:raise AssertionError(label)
 checks+=1;print('PASS',label,flush=True)
_,html=request('login.php');token=re.search(r'name="csrf_token"[^>]+value="([^"]+)"',html).group(1)
r=opener.open(urllib.request.Request(base+'dologin.php',data=urllib.parse.urlencode(dict(operator_user='pc-ui-qa',operator_pass='LocalUiQA-2026!',csrf_token=token,location='default')).encode()),timeout=12);html=r.read().decode()
cfg=json.loads(re.search(r'<script id="pc-config" type="application/json">(.*?)</script>',html,re.S).group(1));csrf=cfg['csrf']
status,body=request('mng-list-all.php?api=log_status');check(status==200 and json.loads(body)['data']['retention_days']==7,'seven-day retention policy exposed over HTTP');before=json.loads(body)['data']['counts']
for kind in ['accounting','authentication','admin']:
 status,body=request('mng-list-all.php?api=log_entries&kind='+kind);d=json.loads(body).get('data',{});check(status==200 and 'rows' in d and d['page_size']==25,'paginated '+kind+' response');check('QA-HTTP-DO-NOT-RETURN' not in body,'secret omitted from '+kind+' response')
for action in ['preview_log_clear','clear_logs']:
 status,_=request('mng-list-all.php?api='+action);check(status==405,action+' rejects GET')
 status,_=request('mng-list-all.php?api='+action,{});check(status==403,action+' requires CSRF')
status,_=request('mng-list-all.php?api=preview_log_clear',{'scope':'invalid','mode':'expired'},csrf);check(status==400,'invalid cleanup scope rejected')
status,_=request('mng-list-all.php?api=clear_logs',{'nonce':'0'*64,'confirmation':'CLEAR'},csrf);check(status==409,'forged cleanup nonce rejected')
# An empty snapshot makes even a failure of confirmation validation non-destructive.
status,body=request('mng-list-all.php?api=preview_log_clear',{'scope':'admin','mode':'expired'},csrf);plan=json.loads(body)['data'];check(status==200 and sum(plan['counts'].values())==0,'empty admin-expiry preview available for safe nonce tests');check('targets' not in plan and len(plan['nonce'])==64,'preview returns opaque nonce instead of deletion IDs')
status,_=request('mng-list-all.php?api=clear_logs',{'nonce':plan['nonce'],'confirmation':'CANCEL'},csrf);check(status==400,'wrong typed confirmation rejected')
status,body=request('mng-list-all.php?api=log_status');check(json.loads(body)['data']['counts']==before,'HTTP security checks do not delete or create log records')
status,_=request('library/provider/maintenance.php');check(status==404,'scheduled maintenance cannot be invoked over HTTP')
status,_=request('library/provider/logs.php');check(status==404,'log implementation rejects direct HTTP access')
request('logout.php');print('ALL',checks,'LOG HTTP CHECKS PASSED')
