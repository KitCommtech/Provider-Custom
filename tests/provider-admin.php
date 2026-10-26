<?php
// Integration tests use empty, prefixed copies of existing tables. Never copy live user rows.
define('PC_ADMIN',true);
$root='/var/www/daloradius/app/operators';
require $root.'/../common/includes/config_read.php';
require $root.'/library/provider/core.php';
$db=new PDO('mysql:host='.$configValues['CONFIG_DB_HOST'].';port='.($configValues['CONFIG_DB_PORT']??3306).';dbname='.$configValues['CONFIG_DB_NAME'].';charset=utf8mb4',$configValues['CONFIG_DB_USER'],$configValues['CONFIG_DB_PASS'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
$_SESSION=['operator_id'=>2147482000];$created=[];$checks=0;
function check($ok,$label){global $checks;if(!$ok)throw new Exception('FAIL: '.$label);$checks++;echo "PASS $label\n";}
function rejects($fn,$code,$label){try{$fn();}catch(PCError $e){check($e->http===$code,$label);return;}throw new Exception('FAIL: expected error '.$label);}
try {
 foreach(['RADCHECK','RADREPLY','RADUSERGROUP','RADGROUPREPLY','RADGROUPCHECK','DALOUSERINFO','RADACCT','RADPOSTAUTH','RADNAS','DALOOPERATORS_ACL'] as $suffix){$key='CONFIG_DB_TBL_'.$suffix;$original=$configValues[$key];$table='pcqa_'.strtolower($suffix);if($db->query("SHOW TABLES LIKE '$table'")->fetch())throw new Exception('QA table already exists; refusing to overwrite.');$db->exec("CREATE TABLE `$table` LIKE `$original`");$created[]=$table;$configValues[$key]=$table;}
 $permissions=['mng_list_all','mng_new','mng_edit','mng_del','mng_import_users','mng_rad_profiles_new','mng_rad_profiles_edit','mng_rad_profiles_del','config_maint_disconnect_user','acct_all','mng_rad_nas_list','mng_rad_nas_new','mng_rad_nas_edit'];
 $s=$db->prepare('INSERT INTO pcqa_dalooperators_acl (operator_id,file,access) VALUES (?,?,1)');foreach($permissions as $permission)$s->execute([$_SESSION['operator_id'],$permission]);
 $pc=new ProviderAdmin($db,$configValues,'pc-qa-test');
 check($pc->dashboard()['users']==0,'empty dashboard');
 $pc->saveGroup(['groupname'=>'QA Staff','fortigate_group'=>'FGT-Staff']);check($pc->groups()[0]['fortigate_group']==='FGT-Staff','group mapping');
 check($db->query("SELECT op FROM pcqa_radgroupreply WHERE groupname='QA Staff'")->fetchColumn()==='+=','multiple FortiGate group replies are additive');
 $v=['username'=>'qa-person','password'=>'TestOnly-2026','firstname'=>'QA','lastname'=>'Person','email'=>'qa@example.invalid','company'=>'TEST ONLY','groups'=>['QA Staff'],'simultaneous'=>'2','session_timeout'=>'3600','idle_timeout'=>'600','expires'=>'2030-01-01T12:00'];
 $pc->saveUser($v,true);$d=$pc->detail('qa-person');
 check($d['user']['account_status']==='Enabled'&&$d['groups']===['QA Staff'],'create account and assign group');
 check($d['access']['Simultaneous-Use']==='2'&&$d['access']['Session-Timeout']==='3600','access limits stored in correct RADIUS tables');
 check(strpos(json_encode($d),'TestOnly-2026')===false,'no password in profile response');
 rejects(function()use($pc,$v){$pc->saveUser($v,true);},409,'duplicate username rejected');
 $v['password']='';$v['firstname']='Changed';$pc->saveUser($v,false);check($pc->detail('qa-person')['profile']['firstname']==='Changed','edit local profile');
 check($db->query("SELECT value FROM pcqa_radcheck WHERE attribute='Cleartext-Password'")->fetchColumn()==='TestOnly-2026','blank password preserves original');
 $v['password']='NewOnly-2026';$pc->saveUser($v,false);check($db->query("SELECT value FROM pcqa_radcheck WHERE attribute='Cleartext-Password'")->fetchColumn()==='NewOnly-2026','explicit password update');$v['password']='';
 $pc->suspend(['username'=>'qa-person','enable'=>false]);check($pc->detail('qa-person')['user']['account_status']==='Suspended','suspend account');
 $pc->suspend(['username'=>'qa-person','enable'=>true]);check($pc->detail('qa-person')['user']['account_status']==='Enabled','restore original auth state');
 $v['expires']='2020-01-01T00:00';$pc->saveUser($v,false);check($pc->users(['filter'=>'expired'])['total']===1,'expired filter');$v['expires']='2030-01-01T12:00';$pc->saveUser($v,false);
 rejects(function()use($pc){$pc->deleteGroup(['groupname'=>'QA Staff']);},409,'cannot delete group with members');
 $s=$db->prepare('UPDATE pcqa_dalouserinfo SET providerData=?,updateby=\'OAuthCallback\',updatedate=NOW() WHERE username=\'qa-person\'');$s->execute([json_encode(['provider_id'=>'QA-123','access_token'=>'DO-NOT-EXPOSE','organization'=>['hname_th'=>'QA']])]);
 $d=$pc->detail('qa-person');check($d['profile']['provider_id']==='QA-123'&&$d['profile']['last_synced']!==null,'provider profile and sync metadata');check(strpos(json_encode($d),'DO-NOT-EXPOSE')===false,'provider token excluded');
 $v['firstname']='Do not overwrite';$pc->saveUser($v,false);check($pc->detail('qa-person')['profile']['firstname']==='Changed','provider profile read-only; access editable');
 $v['password']='Forbidden-2026';rejects(function()use($pc,$v){$pc->saveUser($v,false);},400,'provider credentials cannot be replaced');$v['password']='';
 $insert=$db->prepare("INSERT INTO pcqa_radacct (acctsessionid,acctuniqueid,username,nasipaddress,framedipaddress,callingstationid,acctstarttime,acctupdatetime) VALUES (?,?,?,?,'192.0.2.50','AA:BB:CC:DD:EE:01',NOW(),?)");
 $insert->execute(['qa-active','qa-active','qa-person','127.0.0.1',date('Y-m-d H:i:s')]);$session=(int)$db->lastInsertId();$db->exec("UPDATE pcqa_radacct SET acctupdatetime=NOW() WHERE radacctid=$session");
 check($pc->users(['q'=>'192.0.2.50','filter'=>'online'])['total']===1,'IP search and online filter');
 $insert->execute(['qa-stale','qa-stale','qa-person','127.0.0.1',date('Y-m-d H:i:s',time()-3600)]);
 $db->exec("UPDATE pcqa_radacct SET acctupdatetime=DATE_SUB(NOW(),INTERVAL 1 HOUR) WHERE acctuniqueid='qa-stale'");
 check($pc->users(['filter'=>'stale'])['total']===1,'stale accounting identified');
 check(count($pc->detail('qa-person')['sessions'])===2,'multiple devices in profile');
 rejects(function()use($pc){$pc->deleteUser(['username'=>'qa-person']);},409,'delete blocked while accounting records remain open');
 check(count($pc->history(['q'=>'192.0.2.50']))===2,'accounting history search');
 $db->exec("INSERT INTO pcqa_radpostauth (username,pass,reply,authdate) VALUES ('qa-person','NEVER-RETURN','Access-Reject',NOW())");$events=$pc->authenticationEvents(['username'=>'qa-person']);check(count($events)===1&&$events[0]['reply']==='Access-Reject','authentication failure history');check(strpos(json_encode($events),'NEVER-RETURN')===false,'authentication history excludes passwords');
 rejects(function()use($pc){$pc->history(['from'=>'2030-01-01','to'=>'2020-01-01']);},400,'invalid date range rejected');
 $r=$pc->disconnect(['username'=>'qa-person','session_ids'=>[$session]]);check($r['results'][0]['status']==='error','unregistered NAS fails safely');
 check($db->query("SELECT acctstoptime FROM pcqa_radacct WHERE radacctid=$session")->fetchColumn()===null,'disconnect never fabricates Accounting-Stop');
 $r=$pc->disconnect(['username'=>'someone-else','session_ids'=>[$session]]);check($r['results'][0]['status']==='not_active','session ownership validated');
 $db->exec("INSERT INTO pcqa_radnas (nasname,shortname,type,secret,ports) VALUES ('127.0.0.1','QA','other','QA-Test-Secret',37991)");
 check(count($pc->nasList())===1,'NAS list excludes secrets');
 check(strpos(json_encode($pc->nasList()),'QA-Test-Secret')===false,'NAS secret not returned');
 // NAS forms use the isolated NAS table; no live RADIUS shared secrets are changed.
 $nasInput=['address'=>'192.0.2.10','name'=>'QA FortiGate','type'=>'other','disconnect_port'=>'3799','secret'=>'NAS-QA-TestOnly','description'=>'Synthetic device'];
 $newNas=$pc->saveNas($nasInput);$nasInput['id']=$newNas['id'];
 $entry=array_values(array_filter($pc->nasList(),function($n)use($newNas){return (int)$n['id']===$newNas['id'];}))[0];
 check($entry['shortname']==='QA FortiGate'&&(int)$entry['secret_set']===1,'create NAS with secret configured flag');
 check(strpos(json_encode($pc->nasList()),'NAS-QA-TestOnly')===false,'NAS secrets never returned to UI');
 $nasInput['secret']='';$nasInput['name']='QA Updated';$pc->saveNas($nasInput);
 check($db->query('SELECT secret FROM pcqa_radnas WHERE id='.(int)$newNas['id'])->fetchColumn()==='NAS-QA-TestOnly','blank NAS secret preserves saved value');
 $nasInput['secret']='NAS-QA-Replacement';$pc->saveNas($nasInput);
 check($db->query('SELECT secret FROM pcqa_radnas WHERE id='.(int)$newNas['id'])->fetchColumn()==='NAS-QA-Replacement','explicit NAS secret replacement');
 check(strpos(json_encode($pc->auditRows([])),'NAS-QA-Replacement')===false,'NAS audit omits secret');
 $duplicate=$nasInput;unset($duplicate['id']);rejects(function()use($pc,$duplicate){$pc->saveNas($duplicate);},409,'duplicate NAS address rejected');
 $invalid=$nasInput;$invalid['address']='invalid-address';rejects(function()use($pc,$invalid){$pc->saveNas($invalid);},400,'invalid NAS address rejected');
 $invalid=$nasInput;$invalid['disconnect_port']='0';rejects(function()use($pc,$invalid){$pc->saveNas($invalid);},400,'invalid NAS port rejected');
 $invalid=$nasInput;$invalid['secret']='short';rejects(function()use($pc,$invalid){$pc->saveNas($invalid);},400,'invalid NAS secret rejected');
 $db->exec("UPDATE pcqa_radacct SET nasipaddress='192.0.2.10' WHERE radacctid=".$session);$changed=$nasInput;$changed['address']='192.0.2.11';rejects(function()use($pc,$changed){$pc->saveNas($changed);},409,'NAS address change blocked for open sessions');$db->exec("UPDATE pcqa_radacct SET nasipaddress='127.0.0.1' WHERE radacctid=".$session);
 $cidr=$nasInput;unset($cidr['id']);$cidr['address']='198.51.100.27/24';$cidr['name']='QA Subnet';$cidrRecord=$pc->saveNas($cidr);check($db->query('SELECT nasname FROM pcqa_radnas WHERE id='.(int)$cidrRecord['id'])->fetchColumn()==='198.51.100.0/24','CIDR normalized before duplicate checks');
 $db->exec("UPDATE pcqa_dalooperators_acl SET access=0 WHERE file='mng_rad_nas_edit'");rejects(function()use($pc,$nasInput){$pc->saveNas($nasInput);},403,'NAS edit permission enforced');$db->exec("UPDATE pcqa_dalooperators_acl SET access=1 WHERE file='mng_rad_nas_edit'");
 $db->exec("UPDATE pcqa_dalooperators_acl SET access=0 WHERE file='mng_rad_nas_new'");$newInput=$nasInput;unset($newInput['id']);rejects(function()use($pc,$newInput){$pc->saveNas($newInput);},403,'NAS create permission enforced');$db->exec("UPDATE pcqa_dalooperators_acl SET access=1 WHERE file='mng_rad_nas_new'");
 // Mock NAS child replies with a valid response authenticator. Exercise real radclient UDP packets.
 foreach(['acknowledged'=>41,'rejected'=>42,'timeout'=>0] as $expected=>$code){
   $mock=__DIR__.'/provider-mock-nas.php';$process=proc_open(['php',$mock,(string)$code],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
   check(trim(fgets($pipes[1]))==='READY','mock NAS ready for '.$expected);
   $result=$pc->disconnect(['username'=>'qa-person','session_ids'=>[$session]]);check($result['results'][0]['status']===$expected,'Disconnect '.$expected.' response');
   fclose($pipes[0]);fclose($pipes[1]);fclose($pipes[2]);proc_close($process);
 }
 $db->exec("UPDATE pcqa_radacct SET acctstoptime=NOW() WHERE username='qa-person'");check($pc->users(['filter'=>'offline'])['total']===1,'Accounting-Stop produces offline status');
 // CSV parser and all-or-nothing import.
 $file=tempnam(sys_get_temp_dir(),'pcqa-csv');file_put_contents($file,"username,password,firstname,lastname,email,group\nqa-csv,TestOnly-2026,CSV,Person,csv@example.invalid,QA Staff\n");$_FILES=['csv'=>['error'=>UPLOAD_ERR_OK,'size'=>filesize($file),'tmp_name'=>$file]];$pc->importCsv([]);check($pc->detail('qa-csv')['groups']===['QA Staff'],'CSV import');
 file_put_contents($file,"username,password,firstname,lastname,email,group\nqa-valid,TestOnly-2026,Valid,Person,valid@example.invalid,QA Staff\nqa-invalid,short,Invalid,Person,invalid@example.invalid,QA Staff\n");$_FILES['csv']['size']=filesize($file);rejects(function()use($pc){$pc->importCsv([]);},400,'CSV invalid row rejected');check($pc->users(['q'=>'qa-valid'])['total']===0,'CSV validation leaves no partial account');unlink($file);
 // Multi-user management. Targets are explicit and validated before mutation.
 $pc->saveGroup(['groupname'=>'QA Guest','fortigate_group'=>'FGT-Guest']);
 $preview=$pc->bulkPreview(['usernames'=>['qa-person','qa-csv','qa-missing','qa-person']]);check(count($preview['users'])===3&&!$preview['users'][2]['exists'],'bulk preview deduplicates explicit users and flags missing accounts');
 check(strpos(json_encode($preview),'DO-NOT-EXPOSE')===false&&strpos(json_encode($preview),'TestOnly-2026')===false,'bulk preview excludes credentials');
 $bulk=['operation'=>'groups','mode'=>'add','groups'=>['QA Guest'],'usernames'=>['qa-person','qa-csv']];
 $r=$pc->bulkUsers($bulk);check(count($r['results'])===2&&$r['results'][0]['status']==='success','bulk add groups');
 check($pc->detail('qa-person')['groups']===['QA Staff','QA Guest'],'bulk add preserves previous groups');
 check($pc->detail('qa-person')['profile']['firstname']==='Changed','bulk groups preserves Provider profile');
 $bulk['mode']='remove';$r=$pc->bulkUsers($bulk);check($pc->detail('qa-csv')['groups']===['QA Staff'],'bulk remove preserves other groups');
 $bulk['mode']='replace';$pc->bulkUsers($bulk);check($pc->detail('qa-person')['groups']===['QA Guest'],'bulk replace memberships');
 $bulk['groups']=[];$pc->bulkUsers($bulk);check(!$pc->detail('qa-person')['groups'],'explicit empty replace clears memberships');
 $bulk['mode']='add';$bulk['groups']=['QA Staff'];$pc->bulkUsers($bulk);
 $bulk['groups']=['Nonexistent'];rejects(function()use($pc,$bulk){$pc->bulkUsers($bulk);},400,'invalid bulk group rejected before writes');
 rejects(function()use($pc){$pc->bulkUsers(['operation'=>'delete','usernames'=>['qa-person',"invalid'username"]]);},400,'invalid bulk target rejected before deletion');check($pc->detail('qa-person')['user']['username']==='qa-person','bulk validation prevents partial deletion');
 rejects(function()use($pc){$pc->bulkPreview(['usernames'=>array_fill(0,101,'qa-person')]);},400,'bulk maximum enforced');
 $tmp=['username'=>'qa-bulk-offline','password'=>'TestOnly-2026'];$pc->saveUser($tmp,true);$tmp['username']='qa-bulk-active';$pc->saveUser($tmp,true);
 $insert->execute(['qa-bulk-session','qa-bulk-session','qa-bulk-active','127.0.0.1',$db->query('SELECT NOW()')->fetchColumn()]);
 $r=$pc->bulkUsers(['operation'=>'delete','usernames'=>['qa-bulk-offline','qa-bulk-active','qa-bulk-missing']]);
 check(array_column($r['results'],'status')===['success','skipped','skipped'],'bulk deletion reports success, active skip and missing skip separately');
 check(count($pc->bulkPreview(['usernames'=>['qa-bulk-active']])['users'][0]['sessions'])===1,'bulk disconnect preview includes exact open session IDs');
 $db->exec("UPDATE pcqa_radacct SET acctstoptime=NOW() WHERE username='qa-bulk-active'");$pc->bulkUsers(['operation'=>'delete','usernames'=>['qa-bulk-active']]);$pc->deleteGroup(['groupname'=>'QA Guest']);
 $db->exec("UPDATE pcqa_dalooperators_acl SET access=0 WHERE file='mng_edit'");rejects(function()use($pc,$v){$pc->saveUser($v,false);},403,'write permission enforced');
 rejects(function()use($pc){$pc->bulkUsers(['operation'=>'groups','mode'=>'replace','groups'=>[],'usernames'=>['qa-person']]);},403,'bulk membership permission enforced');
 $db->exec("UPDATE pcqa_dalooperators_acl SET access=0 WHERE file='config_maint_disconnect_user'");rejects(function()use($pc,$session){$pc->disconnect(['username'=>'qa-person','session_ids'=>[$session]]);},403,'disconnect permission enforced');
 $db->exec("UPDATE pcqa_dalooperators_acl SET access=0 WHERE file='mng_del'");rejects(function()use($pc){$pc->bulkUsers(['operation'=>'delete','usernames'=>['qa-person']]);},403,'bulk deletion permission enforced');$db->exec("UPDATE pcqa_dalooperators_acl SET access=1 WHERE file='mng_del'");
 $pc->deleteUser(['username'=>'qa-csv']);$pc->deleteUser(['username'=>'qa-person']);check(count($pc->history(['username'=>'qa-person']))===2,'delete retains accounting history');$pc->deleteGroup(['groupname'=>'QA Staff']);check(!$pc->groups(),'empty group deletion');
 check(count($pc->auditRows([]))>0,'admin actions audited');
 echo "ALL $checks CHECKS PASSED\n";
} finally {
 foreach(array_reverse($created) as $table)$db->exec("DROP TABLE `$table`");
 $db->exec("DELETE FROM pc_admin_audit WHERE operator_name='pc-qa-test'");
 $db->exec("DELETE FROM pc_user_access WHERE username IN ('qa-person','qa-csv')");
}
