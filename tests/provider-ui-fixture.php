<?php
require '/var/www/daloradius/app/common/includes/config_read.php';
$db=new PDO('mysql:host='.$configValues['CONFIG_DB_HOST'].';port='.($configValues['CONFIG_DB_PORT']??3306).';dbname='.$configValues['CONFIG_DB_NAME'].';charset=utf8mb4',$configValues['CONFIG_DB_USER'],$configValues['CONFIG_DB_PASS'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$name='pc-ui-qa';$u='pc-ui-provider';
if(($argv[1]??'')==='clean'){
 $id=$db->query("SELECT id FROM operators WHERE username='pc-ui-qa' AND notes='Temporary UI validation'")->fetchColumn();
 if($id){$db->exec('DELETE FROM operators_acl WHERE operator_id='.(int)$id);$db->exec('DELETE FROM operators WHERE id='.(int)$id);}
 foreach(['radcheck','radreply','radusergroup','userinfo','radacct'] as $table){$s=$db->prepare("DELETE FROM `$table` WHERE username IN ('pc-ui-provider','pc-ui-local','pc-ui-csv')");$s->execute();}
 $db->exec("DELETE FROM radgroupreply WHERE groupname='PC-QA-Group'");$db->exec("DELETE FROM radgroupcheck WHERE groupname='PC-QA-Group'");$db->exec("DELETE FROM pc_user_access WHERE username LIKE 'pc-ui-%'");$db->exec("DELETE FROM pc_admin_audit WHERE operator_name='pc-ui-qa'");echo "UI fixture removed\n";exit;
}
if($db->query("SELECT COUNT(*) FROM operators WHERE username='pc-ui-qa'")->fetchColumn()||$db->query("SELECT COUNT(*) FROM userinfo WHERE username LIKE 'pc-ui-%'")->fetchColumn())throw new Exception('Fixture names already exist.');
$db->beginTransaction();
try{
 $fields=['username','password','firstname','lastname','title','department','company','phone1','phone2','email1','email2','messenger1','messenger2','notes'];$values=array_fill(0,count($fields),'');$values[0]=$name;$values[1]='LocalUiQA-2026!';$values[2]='QA';$values[3]='Admin';$values[13]='Temporary UI validation';
 $s=$db->prepare('INSERT INTO operators (`'.implode('`,`',$fields).'`,creationdate,creationby) VALUES ('.implode(',',array_fill(0,count($fields),'?')).",NOW(),'codex-local-qa')");$s->execute($values);$id=$db->lastInsertId();
 $s=$db->prepare('INSERT INTO operators_acl (operator_id,file,access) SELECT ?,file,1 FROM operators_acl_files');$s->execute([$id]);
 $profile=json_encode(['provider_id'=>'DEMO-PROVIDER-001','access_token'=>'DO-NOT-DISPLAY','organization'=>['hname_th'=>'Example Organization']]);
 $s=$db->prepare("INSERT INTO userinfo (username,firstname,lastname,email,company,department,providerData,creationby,updateby,updatedate) VALUES (?,'Provider','Example','provider@example.invalid','Example Organization','Clinical Services',?,'codex-local-qa','OAuthCallback',NOW())");$s->execute([$u,$profile]);
 $s=$db->prepare("INSERT INTO radcheck (username,attribute,op,value) VALUES (?,'Cleartext-Password',':=','LocalUiQA-2026!')");$s->execute([$u]);
 $s=$db->prepare("INSERT INTO radacct (acctsessionid,acctuniqueid,username,nasipaddress,framedipaddress,callingstationid,acctstarttime,acctupdatetime) VALUES (?,?,?,'192.0.2.1',?,?,DATE_SUB(NOW(),INTERVAL 30 MINUTE),?)");
 $now=$db->query('SELECT NOW()')->fetchColumn();$s->execute(['pc-ui-session-1','pc-ui-session-1',$u,'192.0.2.20','AA:BB:CC:00:00:01',$now]);$s->execute(['pc-ui-session-2','pc-ui-session-2',$u,'192.0.2.21','AA:BB:CC:00:00:02','2020-01-01 00:00:00']);
 $db->commit();echo "UI fixture ready\n";
}catch(Throwable $e){$db->rollBack();throw $e;}
