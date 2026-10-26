/* Provider Admin: functional UI, using existing Bootstrap. */
'use strict';
(() => {
const cfg=JSON.parse(document.getElementById('pc-config').textContent), perms=cfg.permissions;
const content=document.getElementById('content'), body=document.getElementById('drawerBody');
const drawer=new bootstrap.Offcanvas(document.getElementById('userDrawer'));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const field=(label,name,value='',type='text',extra='')=>`<label>${esc(label)}<input class="form-control" name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const show=(text,error=false)=>{for(const id of ['notice','drawerNotice']){const el=document.getElementById(id);el.className='alert '+(error?'alert-danger':'alert-success');el.textContent=text;}};
const run=fn=>async e=>{try{await fn(e);}catch(err){show(err.message,true);}};
let view=new URLSearchParams(location.search).get('view')||'dashboard', groupRows=[], current=null, activeTab='profile', busy=false, listSequence=0;
const setMobileMenu=open=>window.ProviderShell.setMobileMenu(open);
const filters={q:'',filter:'',group:'',page:1};
const selectedUsers=new Set();let pageUsers=[],bulkGroupDefault='',bulkBusy=false;
document.getElementById('userDrawer').addEventListener('hide.bs.offcanvas',e=>{if(bulkBusy)e.preventDefault();});
async function api(action,data={},write=false){
 const url=new URL('mng-list-all.php',location.href);url.searchParams.set('api',action);
 const options={headers:{'Accept':'application/json'},cache:'no-store'};
 if(write){options.method='POST';options.headers['X-CSRF-Token']=cfg.csrf;if(data instanceof FormData)options.body=data;else{options.headers['Content-Type']='application/json';options.body=JSON.stringify(data);}}
 else Object.entries(data).forEach(([k,v])=>url.searchParams.set(k,v));
 const response=await fetch(url,options);let r;try{r=await response.json();}catch{throw new Error('Your session may have expired. Reload and sign in again.');}if(!response.ok||!r.ok)throw new Error(r.error||'Request failed.');return r.data;
}
function table(headers,rows){return `<div class="table-responsive"><table class="table table-bordered"><thead><tr>${headers.map(x=>`<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}">No matching records.</td></tr>`}</tbody></table></div>`;}
const cells=(values)=>`<tr>${values.map(v=>`<td>${esc(v??'—')}</td>`).join('')}</tr>`;
async function confirmAction(title,text,label='Confirm'){
 const dialog=document.getElementById('confirmDialog');document.getElementById('confirmTitle').textContent=title;document.getElementById('confirmText').textContent=text;document.getElementById('confirmSubmit').textContent=label;
 return new Promise(resolve=>{dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true});dialog.returnValue='cancel';dialog.showModal();});
}
function groupOptions(selected=[],all=false){return (all?'<option value="">All groups</option>':'')+groupRows.map(g=>`<option value="${esc(g.groupname)}" ${selected.includes(g.groupname)?'selected':''}>${esc(g.groupname)}</option>`).join('');}
function heading(title,description=''){return `<h1 class="h3">${esc(title)}</h1><p class="muted">${esc(description)}</p>`;}
const statusBadge=value=>{
 const v=String(value??'');let tone='neutral';
 if(['Enabled','Online (reported)','Configured','success','acknowledged','Access-Accept'].includes(v))tone='positive';
 else if(['Suspended','Expired','Missing','error','rejected','Access-Reject'].includes(v))tone='danger';
 else if(['Needs verification','skipped','timeout','pending'].includes(v))tone='warning';
 return `<span class="status-badge status-${tone}">${esc(v)}</span>`;
};
async function dashboard(){
 const d=await api('dashboard');
 const cards=[['Users',d.users,'users','people','blue'],['User Groups',d.groups,'groups','collection','purple'],...(perms.acct_all?[['Connection Logs',d.accounting_records,'activity','clock-history','orange']]:[]),...(perms.mng_rad_nas_list?[['NAS Devices',d.nas_devices,'nas','router','cyan']]:[])];
 content.innerHTML=heading('Dashboard')+`<div class="stats destination-stats">${cards.map(([label,value,target,icon,tone])=>`<a class="stat-card stat-${tone}" href="?view=${target}" data-dashboard-view="${target}"><i class="bi bi-${icon} stat-icon" aria-hidden="true"></i><span class="stat-copy"><span class="stat-label">${esc(label)}</span><strong>${esc(value||0)}</strong></span></a>`).join('')}</div><div class="dashboard-grid"><section class="panel"><div class="panel-heading"><div><h2>Group overview</h2><p>Membership and FortiGate group mapping</p></div><a href="?view=groups" data-dashboard-view="groups">View groups <i class="bi bi-arrow-right" aria-hidden="true"></i></a></div>${table(['Group','Members','FortiGate Match'],groupRows.slice(0,6).map(g=>cells([g.groupname,g.members,g.fortigate_group||'Not configured'])))}</section><section class="panel"><div class="panel-heading"><div><h2>Recent administrative activity</h2><p>Latest recorded account and session actions</p></div>${perms.acct_all?'<a href="?view=activity" data-dashboard-view="activity">View activity <i class="bi bi-arrow-right" aria-hidden="true"></i></a>':''}</div><div id="dashboardActivity">${perms.acct_all?'<p class="muted">Loading activity…</p>':'<p class="muted">Activity history is available to operators with reporting permission.</p>'}</div></section></div>`;
 content.querySelectorAll('[data-dashboard-view]').forEach(a=>a.onclick=run(async e=>{e.preventDefault();await navigate(a.dataset.dashboardView);}));
 if(perms.acct_all){try{const rows=await api('audit');const target=document.getElementById('dashboardActivity');if(target)target.innerHTML=table(['Action','Result','Time'],rows.slice(0,5).map(r=>`<tr><td>${esc(r.action.replace(/[._]/g,' '))}</td><td>${statusBadge(r.status)}</td><td>${esc(r.created_at)}</td></tr>`));}catch(e){const target=document.getElementById('dashboardActivity');if(target)target.textContent=e.message;}}
}
async function users(){
 content.innerHTML=heading('Users','Manage accounts, provider profiles and individual device sessions in one place.')+`<form id="filters" class="toolbar"><label>Search username, name or IP<input class="form-control" id="userSearch" name="q" value="${esc(filters.q)}" placeholder="Username, full name or IP address"></label><label>Connection / account status<select class="form-select" name="filter">${[['','All users'],['online','Online (reported)'],['offline','Offline'],['open','All open sessions'],['expiring','Expiring in 7 days'],['stale','Needs verification'],['suspended','Suspended'],['expired','Expired']].map(([v,t])=>`<option value="${v}" ${filters.filter===v?'selected':''}>${t}</option>`).join('')}</select></label><label>Group<select name="group" class="form-select">${groupOptions([filters.group],true)}</select></label><button class="btn btn-secondary">Search</button><button type="button" class="btn btn-outline-secondary" id="refreshUsers">Refresh</button>${perms.mng_new?'<button type="button" class="btn btn-primary" id="newUser">Add User</button>':''}${perms.mng_import_users?'<button type="button" class="btn btn-outline-primary" id="importUsers">Import CSV</button>':''}</form><div id="bulkBar" class="section toolbar" aria-label="Selected user actions"><strong id="selectionCount">0 users selected</strong>${perms.mng_edit?'<button class="btn btn-outline-primary" type="button" id="bulkGroups">Change Groups</button>':''}${perms.config_maint_disconnect_user?'<button class="btn btn-outline-danger" type="button" id="bulkDisconnect">Disconnect Sessions</button>':''}${perms.mng_del?'<button class="btn btn-outline-danger" type="button" id="bulkDelete">Delete Users</button>':''}<button class="btn btn-outline-secondary" type="button" id="clearSelection">Clear Selection</button><span class="muted">Selections carry across pages (maximum 100). Search or filter changes clear the selection.</span></div><div id="bulkResults" role="status"></div><div id="userTable"></div>`;
 document.getElementById('filters').onsubmit=run(async e=>{e.preventDefault();Object.assign(filters,Object.fromEntries(new FormData(e.target)),{page:1});selectedUsers.clear();await loadUsers();});
 document.getElementById('refreshUsers').onclick=run(loadUsers);
 if(perms.mng_new)document.getElementById('newUser').onclick=run(()=>openNew());
 if(perms.mng_import_users)document.getElementById('importUsers').onclick=run(importForm);
 document.getElementById('clearSelection').onclick=()=>{selectedUsers.clear();syncSelection();};
 for(const [id,action] of [['bulkGroups','groups'],['bulkDisconnect','disconnect'],['bulkDelete','delete']]){const b=document.getElementById(id);if(b)b.onclick=run(()=>openBulk(action));}
 await loadUsers();
}
async function loadUsers(){
 const seq=++listSequence,d=await api('users',filters);if(seq!==listSequence||view!=='users')return;
 pageUsers=d.rows.map(r=>r.username);
 const rows=d.rows.map(r=>`<tr><td><input type="checkbox" class="form-check-input" data-select-user="${esc(r.username)}" aria-label="Select ${esc(r.username)}" ${selectedUsers.has(r.username)?'checked':''}></td><td><button class="btn btn-link p-0 text-start" data-user="${esc(r.username)}">${esc(r.username)}</button><div>${esc(r.full_name)}</div><small>${esc(r.source)}</small></td><td>${esc(r.user_groups||'—')}</td><td>${statusBadge(r.account_status)}</td><td>${statusBadge(r.connection_status)}${Number(r.stale_sessions)?`<div class="muted">${esc(r.stale_sessions)} session(s) need verification</div>`:''}</td><td>${esc(r.ip_addresses||'—')}</td><td>${esc(r.sessions)}</td><td>${esc(r.expiration||'No expiry')}</td><td><button class="btn btn-outline-secondary" data-user="${esc(r.username)}">View details</button></td></tr>`);
 document.getElementById('userTable').innerHTML=table(['Select','Username / Full Name','Group','Account Status','Connection Status','IP Address','Devices','Expires On','Actions'],rows)+`<div class="toolbar"><button class="btn btn-secondary" id="prevPage" ${d.page<=1?'disabled':''}>Previous</button><span>Page ${d.page} · ${d.total} users</span><button class="btn btn-secondary" id="nextPage" ${d.page*25>=d.total?'disabled':''}>Next</button><span class="muted">Updated ${esc(new Date(d.updated_at).toLocaleTimeString())}</span></div>`;
 document.querySelector('#userTable th').innerHTML='<input type="checkbox" class="form-check-input" id="selectPage" aria-label="Select all users on this page">';
 document.getElementById('selectPage').onchange=run(e=>{const adding=pageUsers.filter(u=>!selectedUsers.has(u));if(e.target.checked&&selectedUsers.size+adding.length>100){syncSelection();throw new Error('Select at most 100 users.');}for(const u of pageUsers){if(e.target.checked)selectedUsers.add(u);else selectedUsers.delete(u);}syncSelection();});
 document.querySelectorAll('[data-select-user]').forEach(b=>b.onchange=run(()=>{if(b.checked&&selectedUsers.size>=100){b.checked=false;throw new Error('Select at most 100 users.');}if(b.checked)selectedUsers.add(b.dataset.selectUser);else selectedUsers.delete(b.dataset.selectUser);syncSelection();}));
 syncSelection();
 document.querySelectorAll('[data-user]').forEach(b=>b.onclick=run(()=>openUser(b.dataset.user)));
 document.getElementById('prevPage').onclick=run(async()=>{filters.page--;await loadUsers();});document.getElementById('nextPage').onclick=run(async()=>{filters.page++;await loadUsers();});
}
async function openUser(username,tab='profile'){current=await api('detail',{username});activeTab=tab;renderDrawer();drawer.show();}
function profileView(d){const p=d.profile;return `<h3 class="h5">User Profile</h3><p>${d.user.source==='ProviderID'?'ProviderID profile · Read-only. Provider credentials and raw payloads are never displayed.':'Local profile. Edit details in Account & Access.'}</p><dl>${[['Username',d.user.username],['Full Name',`${p.firstname||''} ${p.lastname||''}`],['Provider ID',p.provider_id||'Not provided'],['Email',p.email||'Not provided'],['Organization',p.company||'Not provided'],['Department / Position',p.department||'Not provided'],['Authentication Source',d.user.source],['Last Synced',p.last_synced?`${p.last_synced} (server time)`:'Not recorded for this profile']].map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;}
function userForm(d,create=false){
 const u=d?.user||{},p=d?.profile||{},a=d?.access||{},provider=u.source==='ProviderID';
 let expires='';if(a.Expiration){const parsed=new Date(a.Expiration);if(!isNaN(parsed))expires=`${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}T${String(parsed.getHours()).padStart(2,'0')}:${String(parsed.getMinutes()).padStart(2,'0')}`;}
 return `<form id="accountForm"><div class="form-grid">${field('Username','username',u.username||'','text',create?'required maxlength="64"':'readonly')}${provider?'':field(create?'Password':'New Password (leave blank to keep)','password','','password',`${create?'required':''} minlength="8" maxlength="128" autocomplete="new-password"`)}${provider?'<p>Provider profile fields and credentials are read-only. You can change access settings below.</p>':['firstname','lastname','email','department','company'].map((k,i)=>field(['First Name','Last Name','Email','Department','Organization'][i],k,p[k]||'',k==='email'?'email':'text','maxlength="200"')).join('')}<label>User Groups<select class="form-select" multiple name="groups" size="4">${groupOptions(d?.groups||[])}</select><small>Select one or more groups. FortiGate policy matching must be configured separately.</small></label>${field('Expires On (server local time)','expires',expires,'datetime-local')}${field('Concurrent Devices','simultaneous',a['Simultaneous-Use']||'','number','min="1" max="31536000"')}${field('Session Timeout (seconds)','session_timeout',a['Session-Timeout']||'','number','min="1" max="31536000"')}${field('Idle Timeout (seconds)','idle_timeout',a['Idle-Timeout']||'','number','min="1" max="31536000"')}</div><p class="muted">Blank limits use RADIUS group/default settings. Access changes affect future authentication; existing sessions must be disconnected separately.</p><button class="btn btn-primary" ${(!create&&!perms.mng_edit)?'disabled':''}>${create?'Create User':'Save Account & Access'}</button></form>`;
}
function bindAccount(create){document.getElementById('accountForm').onsubmit=run(async e=>{e.preventDefault();const form=e.target,button=form.querySelector('button[type="submit"],button');const values=Object.fromEntries(new FormData(form));values.groups=[...form.elements.groups.selectedOptions].map(o=>o.value);button.disabled=true;try{const r=await api(create?'create_user':'save_user',values,true);show(r.message);groupRows=await api('groups');await openUser(values.username,'access');if(view==='users')await loadUsers();}finally{button.disabled=false;}});}
function renderDrawer(){
 const d=current;document.getElementById('drawerTitle').textContent=d.user.username;
 body.innerHTML=`<p>${statusBadge(d.user.account_status)} <span class="status-badge status-info">${esc(d.user.source)}</span></p><div class="tabs" role="tablist">${[['profile','Profile'],['access','Account & Access'],['sessions','Active Sessions'],['history','History']].map(([v,t])=>`<button class="btn ${activeTab===v?'btn-secondary':'btn-outline-secondary'}" data-tab="${v}" role="tab" aria-selected="${activeTab===v}">${t}</button>`).join('')}</div><section id="tabContent"></section>`;
 body.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;renderDrawer();});const panel=document.getElementById('tabContent');
 if(activeTab==='profile')panel.innerHTML=profileView(d);
 if(activeTab==='access'){
  panel.innerHTML=userForm(d)+`<hr><div class="toolbar">${perms.mng_edit?`<button class="btn btn-outline-warning" id="suspendUser">${d.user.account_status==='Suspended'?'Enable Account':'Suspend Account'}</button>`:''}${perms.mng_del?'<button class="btn btn-outline-danger" id="deleteUser">Delete User</button>':''}</div>`;bindAccount(false);
  if(perms.mng_edit)document.getElementById('suspendUser').onclick=run(async()=>{const enable=d.user.account_status==='Suspended';if(!await confirmAction(enable?'Enable Account':'Suspend Account',`${enable?'Enable':'Suspend'} ${d.user.username}? Existing sessions will not be disconnected.`,enable?'Enable':'Suspend'))return;const r=await api('suspend',{username:d.user.username,enable},true);show(r.message);await openUser(d.user.username,'access');if(view==='users')await loadUsers();});
  if(perms.mng_del)document.getElementById('deleteUser').onclick=run(async()=>{if(!await confirmAction('Delete User',`Delete ${d.user.username}? Accounting history will be retained. This cannot be undone here.`,'Delete User'))return;const r=await api('delete_user',{username:d.user.username},true);drawer.hide();show(r.message);if(view==='users')await loadUsers();});
 }
 if(activeTab==='sessions'){
  panel.innerHTML='<p class="muted">Reported by RADIUS Accounting. No update for 10 minutes means the session needs verification; it does not prove that the device is offline.</p>'+table(['IP / MAC','NAS','Started / Last Update','Reported Duration (sec)','Status','Action'],d.sessions.map(s=>`<tr><td>${esc(s.framedipaddress||'—')}<br>${esc(s.callingstationid||'—')}</td><td>${esc(s.nasipaddress)}</td><td>${esc(s.acctstarttime)}<br>${esc(s.acctupdatetime||'No interim update')}</td><td>${esc(s.acctsessiontime??'Not reported')}</td><td>${Number(s.stale)?'Needs verification':'Online (reported)'}</td><td>${perms.config_maint_disconnect_user?`<button class="btn btn-outline-danger" data-disconnect="${esc(s.radacctid)}">Disconnect Session</button>`:'No disconnect permission'}</td></tr>`))+`<div class="toolbar"><button class="btn btn-secondary" id="refreshSessions">Refresh Sessions</button>${perms.config_maint_disconnect_user&&d.sessions.length?'<button class="btn btn-danger" id="disconnectAll">Disconnect All Sessions</button>':''}</div><div id="disconnectResults" role="status"></div>`;
  document.getElementById('refreshSessions').onclick=run(()=>openUser(d.user.username,'sessions'));
  panel.querySelectorAll('[data-disconnect]').forEach(b=>b.onclick=run(()=>disconnect([b.dataset.disconnect])));
  if(document.getElementById('disconnectAll'))document.getElementById('disconnectAll').onclick=run(()=>disconnect(d.sessions.map(s=>String(s.radacctid))));
 }
 if(activeTab==='history'){
  panel.innerHTML=historyTable(d.history);if(perms.acct_all)api('audit',{username:d.user.username}).then(rows=>{if(current?.user.username===d.user.username&&activeTab==='history')panel.insertAdjacentHTML('beforeend','<h3 class="h5">Admin Activity</h3>'+auditTable(rows));}).catch(e=>show(e.message,true));
 }
}
async function disconnect(ids){
 if(busy)return;const selected=current.sessions.filter(s=>ids.includes(String(s.radacctid)));
 if(!await confirmAction('Disconnect Sessions',`Disconnect ${selected.length} session(s) for ${current.user.username}: ${selected.map(s=>s.framedipaddress||s.acctsessionid).join(', ')}? The user may need to sign in again.`,'Send Disconnect'))return;
 busy=true;body.querySelectorAll('[data-disconnect],#disconnectAll').forEach(b=>b.disabled=true);
 try{const results=[];for(let start=0;start<ids.length;start+=10){const r=await api('disconnect',{username:current.user.username,session_ids:ids.slice(start,start+10)},true);results.push(...r.results);document.getElementById('disconnectResults').innerHTML=table(['Session','Result','Detail'],results.map(x=>cells([x.id,x.status,x.message])));}show('Disconnect requests completed. An ACK requires Accounting-Stop before a session is shown as offline.');if(view==='users')await loadUsers();}
 finally{busy=false;body.querySelectorAll('[data-disconnect],#disconnectAll').forEach(b=>b.disabled=false);}
}
async function openNew(){document.getElementById('drawerNotice').textContent='';current=null;document.getElementById('drawerTitle').textContent='Add User';body.innerHTML=userForm(null,true);bindAccount(true);drawer.show();}
async function importForm(){
 document.getElementById('drawerNotice').textContent='';
 document.getElementById('drawerTitle').textContent='Import Users';body.innerHTML=`<p>UTF-8 CSV · up to 500 accounts / 1 MB. The entire file is validated before any account is created. Existing usernames are rejected.</p><p>Required header:</p><code>username,password,firstname,lastname,email,group</code><p class="muted mt-2">Group must already exist. Quote CSV fields containing commas. Passwords require at least 8 characters.</p><form id="csvForm"><label>CSV file<input class="form-control" type="file" name="csv" accept=".csv,text/csv" required></label><button class="btn btn-primary">Validate & Import</button></form>`;drawer.show();
 document.getElementById('csvForm').onsubmit=run(async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const r=await api('import',new FormData(e.target),true);drawer.hide();show(r.message);if(view==='users')await loadUsers();}finally{b.disabled=false;}});
}
async function groups(){
 groupRows=await api('groups');content.innerHTML=heading('User Groups','Groups send Fortinet-Group-Name in RADIUS replies. Configure matching groups and shaping policies on FortiGate separately.')+table(['Group','Members','FortiGate Group Match','Actions'],groupRows.map(g=>`<tr><td>${esc(g.groupname)}</td><td>${esc(g.members)}</td><td>${esc(g.fortigate_group||'Not configured')}</td><td><button class="btn btn-outline-secondary" data-members="${esc(g.groupname)}">View Members</button> ${perms.mng_edit?`<button class="btn btn-outline-primary" data-assign="${esc(g.groupname)}">Assign Users</button>`:''} ${perms.mng_rad_profiles_edit?`<button class="btn btn-outline-secondary" data-group="${esc(g.groupname)}">Edit Mapping</button>`:''} ${perms.mng_rad_profiles_del?`<button class="btn btn-outline-danger" data-delete-group="${esc(g.groupname)}">Delete</button>`:''}</td></tr>`))+((perms.mng_rad_profiles_new||perms.mng_rad_profiles_edit)?`<section class="section"><h2 class="h5" id="groupFormTitle">Group Mapping</h2><form id="groupForm"><div class="form-grid">${field('RADIUS Group','groupname','','text','required maxlength="64"')}${field('FortiGate Group Match','fortigate_group','','text','required maxlength="64"')}</div><button class="btn btn-primary">Save Group</button><button class="btn btn-outline-secondary" type="reset">Clear</button></form><p class="muted mt-2">Use Users → Account & Access to assign members. Existing RADIUS attributes are preserved. Mapping is not a live connectivity test.</p></section>`:'');
 content.querySelectorAll('[data-members],[data-assign]').forEach(b=>b.onclick=run(async()=>{bulkGroupDefault=b.dataset.members||b.dataset.assign;filters.q='';filters.filter='';filters.group=b.dataset.members||'';filters.page=1;selectedUsers.clear();await navigate('users');show(b.dataset.members?`Showing members of ${bulkGroupDefault}. Select users and choose Change Groups to remove or move members.`:`Select users, then choose Change Groups to add them to ${bulkGroupDefault}.`);}));
 content.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{const g=groupRows.find(x=>x.groupname===b.dataset.group);document.querySelector('[name=groupname]').value=g.groupname;document.querySelector('[name=fortigate_group]').value=g.fortigate_group||g.groupname;document.querySelector('[name=fortigate_group]').focus();});
 content.querySelectorAll('[data-delete-group]').forEach(b=>b.onclick=run(async()=>{if(!await confirmAction('Delete Group',`Delete ${b.dataset.deleteGroup}? Groups with members cannot be deleted.`,'Delete Group'))return;const r=await api('delete_group',{groupname:b.dataset.deleteGroup},true);show(r.message);await groups();}));
 if(document.getElementById('groupForm'))document.getElementById('groupForm').onsubmit=run(async e=>{e.preventDefault();const r=await api('save_group',Object.fromEntries(new FormData(e.target)),true);show(r.message);await groups();});
}
function syncSelection(){
 const count=document.getElementById('selectionCount');if(!count)return;count.textContent=`${selectedUsers.size} user${selectedUsers.size===1?'':'s'} selected`;
 document.querySelectorAll('[data-select-user]').forEach(b=>b.checked=selectedUsers.has(b.dataset.selectUser));
 const page=document.getElementById('selectPage');if(page){const n=pageUsers.filter(u=>selectedUsers.has(u)).length;page.checked=pageUsers.length>0&&n===pageUsers.length;page.indeterminate=n>0&&n<pageUsers.length;page.disabled=pageUsers.length===0;}
 for(const id of ['bulkGroups','bulkDisconnect','bulkDelete','clearSelection']){const b=document.getElementById(id);if(b)b.disabled=selectedUsers.size===0||bulkBusy;}
}
async function openBulk(action){
 if(bulkBusy)return;const targets=[...selectedUsers];if(!targets.length)throw new Error('Select one or more users first.');
 const preview=await api('bulk_preview',{usernames:targets},true);const users=preview.users;
 const names=users.map(u=>u.username),sessionCount=users.reduce((n,u)=>n+u.sessions.length,0);
 document.getElementById('drawerNotice').textContent='';document.getElementById('drawerTitle').textContent={groups:'Change Groups',delete:'Delete Users',disconnect:'Disconnect User Sessions'}[action];
 body.innerHTML=`<p>${names.length} explicitly selected users. No users outside this list will be affected.</p><details><summary>Selected users (${names.length})</summary><ul>${names.map(u=>`<li>${esc(u)}</li>`).join('')}</ul></details>`+table(['Username','Current Groups','Open Sessions','Action Eligibility'],users.map(u=>cells([u.username,u.groups.join(', ')||'—',u.sessions.length,!u.exists?'User no longer exists':action==='delete'&&u.sessions.length?'Will be skipped: open sessions':action==='disconnect'&&!u.sessions.length?'No open sessions':'Ready'])))+
 (action==='groups'?`<form id="bulkGroupForm"><label>Membership change<select class="form-select" name="mode"><option value="add">Add to groups (keep existing groups)</option><option value="remove">Remove from groups (keep other groups)</option><option value="replace">Replace all group memberships</option></select></label><label>Target Groups<select class="form-select" multiple name="groups" size="5">${groupOptions(bulkGroupDefault?[bulkGroupDefault]:[])}</select></label><p class="muted">Replace overwrites all existing memberships. An empty Replace selection removes all memberships. Profiles, ProviderID fields and credentials are not changed. New memberships apply at the next authentication.</p><button class="btn btn-primary" id="applyBulk">Review & Apply</button></form>`:
 `<p>${action==='delete'?'Users with active or stale sessions will be skipped. Accounting history is retained. Account deletion cannot be undone here.':`${sessionCount} currently open session(s) in this preview. Only these session IDs will be requested; new sessions are not added silently. ACK still requires Accounting-Stop to confirm disconnection.`}</p><button class="btn btn-danger" id="applyBulk" ${action==='disconnect'&&sessionCount===0?'disabled':''}>${action==='delete'?'Review Deletion':'Review Disconnect'}</button>`)+ '<div id="bulkProgress" role="status" aria-live="polite"></div>';
 drawer.show();
 const apply=run(async e=>{
  e.preventDefault();if(bulkBusy)return;let mode='',groups=[];
  if(action==='groups'){const form=document.getElementById('bulkGroupForm');mode=form.elements.mode.value;groups=[...form.elements.groups.selectedOptions].map(o=>o.value);if(!groups.length&&mode!=='replace')throw new Error('Select at least one target group.');}
  const description=action==='groups'?`${mode.toUpperCase()} groups [${groups.join(', ')||'none'}] for ${names.length} selected users: ${names.join(', ')}? Existing sessions will not change.`:action==='delete'?`Delete ${names.length} selected accounts: ${names.join(', ')}? Users with open sessions will be skipped. Accounting history will remain.`:`Send Disconnect-Request for ${sessionCount} previewed sessions across ${names.length} selected users: ${names.join(', ')}?`;
  if(!await confirmAction(action==='groups'?'Confirm Group Changes':action==='delete'?'Confirm Bulk Deletion':'Confirm Bulk Disconnect',description,action==='delete'?'Delete Selected Users':action==='groups'?'Apply Group Changes':'Disconnect Selected Sessions'))return;
  bulkBusy=true;syncSelection();const applyButton=document.getElementById('applyBulk');applyButton.disabled=true;const progress=document.getElementById('bulkProgress');const results=[];
  const renderResults=()=>{const html=table(['Username','Result','Detail'],results.map(r=>cells([r.username,r.status,r.message])));progress.innerHTML=html;const main=document.getElementById('bulkResults');if(main)main.innerHTML='<h2 class="h5">Last Bulk Action</h2>'+html;};
  try{
   if(action!=='disconnect'){
    const response=await api('bulk_users',{operation:action,mode,groups,usernames:targets},true);results.push(...response.results);
    if(action==='delete')for(const r of results)if(r.status==='success')selectedUsers.delete(r.username);
   }else{
    for(const user of users){
     if(!user.exists||!user.sessions.length){results.push({username:user.username,status:'skipped',message:user.exists?'No open sessions in preview.':'User no longer exists.'});renderResults();continue;}
     for(let start=0;start<user.sessions.length;start+=10){
      progress.textContent=`Processing ${user.username} · ${start+1}–${Math.min(start+10,user.sessions.length)} of ${user.sessions.length} sessions…`;
      const response=await api('disconnect',{username:user.username,session_ids:user.sessions.slice(start,start+10).map(s=>String(s.radacctid))},true);
      results.push(...response.results.map(r=>({username:user.username,status:r.status,message:`Session ${r.id}: ${r.message}`})));renderResults();
     }
    }
   }
   renderResults();show('Bulk action finished. Review each result; skipped or rejected items were not reported as successful.');groupRows=await api('groups');if(view==='users')await loadUsers();
  }catch(err){renderResults();throw new Error(`${err.message} Earlier results shown below may already have completed; review before retrying.`);}
  finally{bulkBusy=false;syncSelection();applyButton.disabled=false;}
 });
 if(action==='groups')document.getElementById('bulkGroupForm').onsubmit=apply;else document.getElementById('applyBulk').onclick=apply;
}
function historyTable(rows){return table(['Username','IP / MAC','NAS','Start','Stop','Duration (sec)','Traffic In / Out (bytes)','Stop Cause'],rows.map(r=>cells([r.username,[r.framedipaddress,r.callingstationid].filter(Boolean).join(' / '),r.nasipaddress,r.acctstarttime,r.acctstoptime||'Open record',r.acctsessiontime,`${r.acctinputoctets||0} / ${r.acctoutputoctets||0}`,r.acctterminatecause||'—'])));}
function auditTable(rows){return table(['Time','Admin','Action','Username','Session','Result','Detail'],rows.map(r=>cells([r.created_at,r.operator_name,r.action,r.username,r.session_id,r.status,r.detail])));}
async function activity(){
 content.innerHTML=heading('Activity & Logs','Latest 100 matching accounting records. Admin actions are recorded separately.')+`<form id="historyFilters" class="toolbar">${field('Username or IP','q')}${field('From','from','','date')}${field('To','to','','date')}<button class="btn btn-secondary">Search</button></form><div id="historyRows"></div><h2 class="h5">Authentication Attempts</h2><p class="muted">Filters match username and date. RADIUS must log post-authentication results to populate this table. Password fields are never returned.</p><div id="authRows"></div><h2 class="h5">Recent Admin Activity</h2><div id="auditRows"></div>`;
 const load=async indata=>{document.getElementById('historyRows').innerHTML=historyTable(await api('history',indata));document.getElementById('authRows').innerHTML=table(['Username','Result','Time'],(await api('auth_events',indata)).map(r=>cells([r.username,r.reply,r.authdate])));document.getElementById('auditRows').innerHTML=auditTable(await api('audit'));};
 document.getElementById('historyFilters').onsubmit=run(async e=>{e.preventDefault();await load(Object.fromEntries(new FormData(e.target)));});await load({});
}
let nasRows=[],legacyNasIntentConsumed=false;
async function nas(){
 nasRows=await api('nas');
 content.innerHTML=heading('NAS Devices','Manage FortiGate and network access devices.')+`<div class="toolbar">${perms.mng_rad_nas_new?'<button class="btn btn-primary" id="addNas"><i class="bi bi-plus-lg" aria-hidden="true"></i> Add NAS</button>':''}<button class="btn btn-outline-secondary" id="refreshNas">Refresh</button></div>`+table(['Name','IP Address / Subnet','Type','Disconnect Port','Shared Secret','Description','Actions'],nasRows.map(n=>`<tr><td><strong>${esc(n.shortname||'Unnamed device')}</strong></td><td>${esc(n.nasname)}</td><td>${esc(n.type)}</td><td>${esc(Number(n.ports)||3799)}</td><td>${statusBadge(Number(n.secret_set)?'Configured':'Missing')}</td><td>${esc(n.description||'—')}</td><td>${perms.mng_rad_nas_edit?`<button class="btn btn-outline-primary" data-edit-nas="${esc(n.id)}">Edit NAS</button>`:'Read only'}</td></tr>`));
 if(perms.mng_rad_nas_new)document.getElementById('addNas').onclick=()=>openNas();
 document.getElementById('refreshNas').onclick=run(nas);
 content.querySelectorAll('[data-edit-nas]').forEach(b=>b.onclick=()=>openNas(nasRows.find(n=>String(n.id)===b.dataset.editNas)));
 if(!legacyNasIntentConsumed){legacyNasIntentConsumed=true;const intent=new URLSearchParams(location.search);if(intent.get('new')==='1'&&perms.mng_rad_nas_new)openNas();else if(intent.has('edit_address')&&perms.mng_rad_nas_edit){const row=nasRows.find(n=>n.nasname===intent.get('edit_address'));if(row)openNas(row);}}
}
function openNas(record=null){
 const create=!record,n=record||{};document.getElementById('drawerTitle').textContent=create?'Add NAS':'Edit NAS';document.getElementById('drawerNotice').textContent='';
 body.innerHTML=`<form id="nasForm"><div class="form-grid">${field('Device Name','name',n.shortname||'','text','required maxlength="32"')}${field('NAS IPv4 Address / Subnet','address',n.nasname||'','text','required maxlength="128" placeholder="192.168.1.1 or 192.168.1.0/24"')}<label>Device Type<select name="type" class="form-select">${[['other','FortiGate / Other'],['mikrotik','MikroTik'],['cisco','Cisco'],...(n.type==='fortinet'?[['fortinet','Fortinet (existing)']]:[])].map(([v,t])=>`<option value="${v}" ${(n.type||'other')===v?'selected':''}>${t}</option>`).join('')}</select></label>${field('Disconnect / CoA Port','disconnect_port',Number(n.ports)||3799,'number','required min="1" max="65535"')}${field(create?'RADIUS Shared Secret':'New Shared Secret (leave blank to keep)','secret','','password',`${create?'required':''} minlength="8" maxlength="60" autocomplete="new-password"`)}${field('Description','description',n.description||'','text','maxlength="200"')}</div><p class="muted">Use the same shared secret on FortiGate. Its RADIUS source IP must match this NAS address. Existing secrets are never displayed.</p>${create?'':'<p class="muted">Leave the secret blank to preserve the saved value.</p>'}<button class="btn btn-primary" id="saveNas">${create?'Create NAS':'Save NAS'}</button></form>`;
 drawer.show();
 document.getElementById('nasForm').onsubmit=run(async e=>{
  e.preventDefault();const form=e.target,data=Object.fromEntries(new FormData(form));data.id=n.id||0;
  if(!await confirmAction(create?'Create NAS':'Save NAS',`${create?'Register':'Update'} ${data.name} (${data.address})? ${!create&&data.secret?'The shared secret will be replaced.':!create?'The current shared secret will be kept.':'Use the same shared secret on FortiGate.'}`,create?'Create NAS':'Save NAS'))return;
  const button=document.getElementById('saveNas');button.disabled=true;
  try{const result=await api('save_nas',data,true);form.elements.secret.value='';drawer.hide();show(result.message);if(view==='nas')await nas();}finally{button.disabled=false;}
 });
}
async function settings(){
 content.innerHTML=heading('Settings')+`<div class="toolbar">${perms.mng_rad_nas_list?'<a class="btn btn-outline-secondary" href="mng-list-all.php?view=nas">NAS Devices</a>':''}${perms.config_operators_list?'<a class="btn btn-outline-secondary" href="config-operators-list.php">Administrators & Permissions</a>':''}${perms.config_backup_managebackups?'<a class="btn btn-outline-secondary" href="config-backup-managebackups.php">Database Backups</a>':''}</div>`;
}
async function navigate(next,update=true){if(bulkBusy)throw new Error('Wait for the bulk action to finish before changing views.');if(next!=='users')selectedUsers.clear();view=['dashboard','users','groups','activity','nas','settings'].includes(next)?next:'dashboard';if(update)history.pushState({view},'',`mng-list-all.php?view=${view}`);document.querySelectorAll('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===view);a.setAttribute('aria-current',a.dataset.view===view?'page':'false');});document.getElementById('currentViewName').textContent={dashboard:'Dashboard',users:'Users',groups:'User Groups',activity:'Activity & Logs',nas:'NAS Devices',settings:'Settings'}[view];document.title=document.getElementById('currentViewName').textContent+' · SKNHOS Admin';setMobileMenu(false);content.innerHTML='<p class="muted">Loading workspace…</p>';await ({dashboard,users,groups,activity,nas,settings}[view])();}
document.querySelectorAll('[data-view]').forEach(a=>a.onclick=run(async e=>{e.preventDefault();drawer.hide();await navigate(a.dataset.view);}));
window.addEventListener('popstate',run(()=>navigate(new URLSearchParams(location.search).get('view')||'dashboard',false)));
run(async()=>{groupRows=await api('groups');await navigate(view,false);})();
})();
