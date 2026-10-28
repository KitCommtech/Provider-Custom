<?php
// Real MariaDB integration checks; all mutable tables are empty QA copies, removed in finally.
define('PC_ADMIN',true);
require '/var/www/daloradius/app/common/includes/config_read.php';
require '/var/www/daloradius/app/operators/library/provider/core.php';
$db=new PDO('mysql:host='.$configValues['CONFIG_DB_HOST'].';port='.($configValues['CONFIG_DB_PORT']??3306).';dbname='.$configValues['CONFIG_DB_NAME'].';charset=utf8mb4',$configValues['CONFIG_DB_USER'],$configValues['CONFIG_DB_PASS'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
$made=[];$checks=0;
function expectLog($ok,$label){global $checks;if(!$ok)throw new RuntimeException('FAIL '.$label);$checks++;echo "PASS $label\n";}
function rejectLog($fn,$code,$label){try{$fn();}catch(PCError $e){expectLog($e->http===$code,$label);return;}throw new RuntimeException('FAIL expected rejection: '.$label);}
try {
 $originals=['accounting'=>$configValues['CONFIG_DB_TBL_RADACCT'],'authentication'=>$configValues['CONFIG_DB_TBL_RADPOSTAUTH'],'admin'=>'pc_admin_audit','acl'=>$configValues['CONFIG_DB_TBL_DALOOPERATORS_ACL']];$tables=[];
 foreach($originals as $kind=>$original){
  $table='pcqa_logs_'.$kind;$s=$db->prepare('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?');$s->execute([$table]);if($s->fetchColumn())throw new RuntimeException('QA table exists; refusing to overwrite');
  $db->exec("CREATE TABLE `$table` LIKE `$original`");$made[]=$table;$tables[$kind]=$table;
 }
 // Freeze NOW only on this disposable test connection for precise 7-day boundary assertions.
 $db->exec("SET timestamp=UNIX_TIMESTAMP('2026-10-28 12:00:00')");
 $store=new ProviderLogStore($db,$tables,'qa-log-test');
 $acct=function($name,$start,$stop)use($db,$tables){$s=$db->prepare('INSERT INTO `'.$tables['accounting'].'` (username,acctsessionid,acctuniqueid,nasipaddress,acctstarttime,acctupdatetime,acctstoptime) VALUES (?,?,?,\'192.0.2.1\',?,?,?)');$s->execute([$name,$name,$name,$start,$start,$stop]);return (string)$db->lastInsertId();};
 $auth=function($name,$at,$secret='QA-NEVER-RETURN')use($db,$tables){$s=$db->prepare('INSERT INTO `'.$tables['authentication'].'` (username,pass,reply,authdate) VALUES (?,?,\'Access-Accept\',?)');$s->execute([$name,$secret,$at]);return (string)$db->lastInsertId();};
 $audit=function($name,$at,$detail='Synthetic details')use($db,$tables){$s=$db->prepare('INSERT INTO `'.$tables['admin'].'` (operator_name,action,username,status,detail,created_at) VALUES (\'qa-operator\',\'qa.action\',?,\'success\',?,?)');$s->execute([$name,$detail,$at]);return (string)$db->lastInsertId();};
 $old='2026-10-18 12:00:00';$edge='2026-10-21 12:00:00';$recent='2026-10-27 12:00:00';
 $oldAcct=$acct('old-ended',$old,$old);$edgeAcct=$acct('edge-ended',$old,$edge);$recentAcct=$acct('long-session-ended-recently','2026-08-01 00:00:00',$recent);$openAcct=$acct('old-open','2026-01-01 00:00:00',null);
 $oldAuth=$auth('old-auth',$old);$auth('edge-auth',$edge);$auth('recent-auth',$recent);
 $oldAudit=$audit('old-admin',$old);$audit('edge-admin',$edge);$audit('recent-admin',$recent,str_repeat('Long text ',100));
 $status=$store->status();expectLog($status['retention_days']===7,'retention is exactly seven days');expectLog($status['protected_sessions']===1,'old open session counted as protected');
 foreach(['accounting','authentication','admin'] as $kind)expectLog($status['counts'][$kind]['expired']===1,$kind.' excludes exact boundary and recent data');
 $plan=$store->plan('all','expired');expectLog(array_sum($plan['counts'])===3,'automatic preview includes only expired records');
 $lateOldAuth=$auth('old-arrived-after-preview',$old);
 $result=$store->clear($plan,true);expectLog($result['total_deleted']===3,'retention removes exact previewed expired IDs');
 expectLog((int)$db->query('SELECT COUNT(*) FROM `'.$tables['accounting'].'` WHERE radacctid='.(int)$openAcct)->fetchColumn()===1,'active stale session preserved');
 expectLog((int)$db->query('SELECT COUNT(*) FROM `'.$tables['accounting'].'` WHERE radacctid='.(int)$recentAcct)->fetchColumn()===1,'retention uses end time rather than old session start');
 expectLog((int)$db->query('SELECT COUNT(*) FROM `'.$tables['authentication'].'` WHERE id='.(int)$lateOldAuth)->fetchColumn()===1,'records arriving after preview are not silently included');
 expectLog($store->status()['last_automatic_cleanup']!==null,'automatic run is reported using a fresh audit event');
 $result=$store->clear($store->plan('authentication','expired'),true);expectLog($result['total_deleted']===1,'later scheduled pass handles newly arrived old record');
 foreach(['accounting','authentication','admin'] as $kind){$rows=$store->entries(['kind'=>$kind]);expectLog($rows['total']>=2,$kind.' retains exact seven-day boundary');}
 $events=$store->entries(['kind'=>'authentication']);expectLog(strpos(json_encode($events),'QA-NEVER-RETURN')===false,'paginated authentication never selects password field');
 $empty=$store->entries(['kind'=>'authentication','q'=>"' OR 1=1 --"]);expectLog($empty['total']===0,'log search SQL injection is literal text');
 rejectLog(function()use($store){$store->entries(['kind'=>'bogus']);},400,'invalid log type rejected');
 rejectLog(function()use($store){$store->entries(['kind'=>'admin','from'=>'2026-02-31']);},400,'impossible date rejected');
 rejectLog(function()use($store){$store->entries(['kind'=>'admin','from'=>'2026-10-28','to'=>'2026-10-01']);},400,'reversed date range rejected');
 rejectLog(function()use($store){$store->entries(['kind'=>'admin','page'=>'0']);},400,'invalid page rejected');
 $byOperator=$store->entries(['kind'=>'admin','q'=>'qa-operator']);expectLog($byOperator['total']===2,'audit search filters operator names');
 $byAction=$store->entries(['kind'=>'admin','q'=>'logs.retention']);expectLog($byAction['total']===2,'audit search filters actions');
 $pending=$acct('reopened-before-delete',$old,$old);$p=$store->plan('accounting','all');$db->exec('UPDATE `'.$tables['accounting'].'` SET acctstoptime=NULL WHERE radacctid='.(int)$pending);$store->clear($p);
 expectLog((int)$db->query('SELECT COUNT(*) FROM `'.$tables['accounting'].'` WHERE radacctid='.(int)$pending)->fetchColumn()===1,'eligibility rechecked when previewed session reopens');
 expectLog($store->status()['protected_sessions']===2,'manual clear retains every open session');
 $p=$store->plan('admin','all');$lateAudit=$audit('after-preview',$recent);$store->clear($p);
 expectLog((int)$db->query('SELECT COUNT(*) FROM `'.$tables['admin'].'` WHERE id='.(int)$lateAudit)->fetchColumn()===1,'manual clear does not remove newer audit records');
 expectLog((int)$db->query("SELECT COUNT(*) FROM `".$tables['admin']."` WHERE action='logs.clear'")->fetchColumn()>=1,'manual cleanup result remains auditable');
 rejectLog(function()use($store){$store->clear($store->plan('all','all'),true);},400,'automatic cleanup can never clear recent logs');
 rejectLog(function()use($store){$store->plan('all',"expired' OR 1=1");},400,'invalid cleanup range rejected');
 $bad=$store->plan('all','expired');$bad['targets']['authentication']=['1 OR 1=1'];rejectLog(function()use($store,$bad){$store->clear($bad);},400,'malformed target ID rejected before writes');
 // A busy scheduler/manual cleanup must not interleave destructive passes.
 $key='pc_logs_'.substr(hash('sha256',$db->query('SELECT DATABASE()')->fetchColumn().json_encode(array_map(function($t){return '`'.$t.'`';},array_intersect_key($tables,['accounting'=>1,'authentication'=>1,'admin'=>1])))),0,56);
 $other=new PDO('mysql:host='.$configValues['CONFIG_DB_HOST'].';port='.($configValues['CONFIG_DB_PORT']??3306).';dbname='.$configValues['CONFIG_DB_NAME'],$configValues['CONFIG_DB_USER'],$configValues['CONFIG_DB_PASS']);$s=$other->prepare('SELECT GET_LOCK(?,0)');$s->execute([$key]);
 rejectLog(function()use($store){$store->clear($store->plan('all','expired'));},409,'concurrent cleanup lock enforced');$s=$other->prepare('SELECT RELEASE_LOCK(?)');$s->execute([$key]);
 // Pagination and bounded deletion with an actual backlog.
 $db->beginTransaction();for($i=0;$i<5002;$i++)$auth('backlog-'.$i,$old);$db->commit();
 $page=$store->entries(['kind'=>'authentication','q'=>'backlog-','page'=>2]);expectLog(count($page['rows'])===25&&$page['total']===5002&&$page['page']===2,'log results use bounded server pagination');
 $last=$store->entries(['kind'=>'authentication','q'=>'backlog-','page'=>9999]);expectLog($last['page']===$last['pages']&&count($last['rows'])===2,'out-of-range page clamps to last page');
 $p=$store->plan('authentication','expired');expectLog($p['counts']['authentication']===5000&&$p['eligible']['authentication']===5002,'large deletion preview is bounded and reports remaining backlog');$store->clear($p,true);
 expectLog($store->status()['counts']['authentication']['expired']===2,'bounded pass preserves outstanding backlog for another run');$store->clear($store->plan('authentication','expired'),true);expectLog($store->status()['counts']['authentication']['expired']===0,'subsequent scheduled pass drains backlog');
 // Web-facing wrappers enforce existing operator ACLs, not only menu visibility.
 $_SESSION=['operator_id'=>2147482001];$configValues['CONFIG_DB_TBL_RADACCT']=$tables['accounting'];$configValues['CONFIG_DB_TBL_RADPOSTAUTH']=$tables['authentication'];$configValues['CONFIG_DB_TBL_DALOOPERATORS_ACL']=$tables['acl'];$configValues['PC_LOG_AUDIT_TABLE']=$tables['admin'];
 $s=$db->prepare('INSERT INTO `'.$tables['acl'].'` (operator_id,file,access) VALUES (?,?,?)');foreach(['acct_all','acct_maintenance_delete'] as $acl)$s->execute([$_SESSION['operator_id'],$acl,1]);$pc=new ProviderAdmin($db,$configValues,'qa-log-web');
 expectLog($pc->logEntries(['kind'=>'accounting'])['total']===2,'web log API reads configured QA tables');expectLog($pc->permissions()['acct_maintenance_delete']===true,'clear button permission exposed');
 $db->exec("UPDATE `".$tables['acl']."` SET access=0 WHERE file='acct_maintenance_delete'");rejectLog(function()use($pc){$pc->logClearPlan(['scope'=>'all','mode'=>'expired']);},403,'preview requires cleanup permission');rejectLog(function()use($pc,$store){$pc->clearLogPlan($store->plan('all','expired'));},403,'execution rechecks cleanup permission');
 $db->exec("UPDATE `".$tables['acl']."` SET access=0 WHERE file='acct_all'");rejectLog(function()use($pc){$pc->logStatus();},403,'log counts require report permission');rejectLog(function()use($pc){$pc->logEntries([]);},403,'paginated log reads require report permission');
 echo "ALL $checks LOG CHECKS PASSED\n";
} finally {
 if($db->inTransaction())$db->rollBack();foreach(array_reverse($made) as $table)$db->exec("DROP TABLE `$table`");
}
