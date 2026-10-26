import urllib.request,urllib.error,http.cookiejar,re,json
base='http://127.0.0.1:8001/'
checks=[]
jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def request(path,data=None,headers={}):
 try:
  r=opener.open(urllib.request.Request(base+path,data=data,headers=headers),timeout=10)
  return r.status,r.read().decode()
 except urllib.error.HTTPError as e:return e.code,e.read().decode()
status,html=request('mng-list-all.php?api=dashboard')
assert 'Login Required' in html;checks.append('unauthenticated API redirects to login')
_,html=request('login.php');csrf=re.search(r'name="csrf_token"[^>]+value="([^"]+)"',html).group(1)
import urllib.parse
_,html=request('dologin.php',urllib.parse.urlencode({'operator_user':'pc-ui-qa','operator_pass':'LocalUiQA-2026!','csrf_token':csrf,'location':'default'}).encode())
config=json.loads(re.search(r'<script id="pc-config" type="application/json">(.*?)</script>',html,re.S).group(1))
status,_=request('mng-list-all.php?api=save_user',b'{}',{'Content-Type':'application/json'})
assert status==403;checks.append('missing CSRF rejected')
status,_=request('mng-list-all.php?api=save_user');assert status==405;checks.append('GET mutation rejected')
status,text=request('mng-list-all.php?api=detail&username=pc-ui-provider');assert status==200 and 'DO-NOT-DISPLAY' not in text and 'Cleartext-Password' not in text;checks.append('profile HTTP response excludes raw secrets')
status,text=request('mng-list-all.php?api=users&q='+urllib.parse.quote("' OR 1=1 --"));assert status==200 and json.loads(text)['data']['total']==0;checks.append('search SQL injection treated as text')
for file in ['library/provider/core.php','library/provider/controller.php','library/provider/view.php']:
 status,_=request(file);assert status==404
checks.append('internal PHP includes reject direct access')
for page in ['mng-rad-nas-list.php','config-operators-list.php','config-backup-managebackups.php']:
 status,text=request(page)
 assert status==200 and 'Fatal error' not in text and 'Login Required' not in text, page
 checks.append('settings page loads: '+page)
print(json.dumps({'passed':len(checks),'checks':checks},indent=2))
