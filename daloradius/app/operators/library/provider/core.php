<?php
/* Provider Admin additions. Existing daloRADIUS licensing applies to integration code. */
if (!defined('PC_ADMIN')) { http_response_code(404); exit; }
class PCError extends RuntimeException {
    public $http;
    public function __construct($message, $http = 400) { parent::__construct($message); $this->http = $http; }
}
class ProviderAdmin {
    private $db; private $tables; private $operator;
    public function __construct(PDO $db, array $config, $operator) {
        $this->db = $db; $this->operator = $operator;
        $map = ['check'=>'RADCHECK','reply'=>'RADREPLY','groups'=>'RADUSERGROUP','groupreply'=>'RADGROUPREPLY','groupcheck'=>'RADGROUPCHECK','users'=>'DALOUSERINFO','acct'=>'RADACCT','auth'=>'RADPOSTAUTH','nas'=>'RADNAS','acl'=>'DALOOPERATORS_ACL'];
        foreach ($map as $key=>$suffix) {
            $name = $config['CONFIG_DB_TBL_'.$suffix] ?? '';
            if (!preg_match('/^[a-zA-Z0-9_]+$/D', $name)) { throw new PCError('Invalid database table configuration.',500); }
            $this->tables[$key] = '`'.$name.'`';
        }
    }
    private function q($sql, $params=[]) { $s=$this->db->prepare($sql); $s->execute($params); return $s; }
    public function allowed($file) {
        return (int)$this->q('SELECT MAX(access) FROM '.$this->tables['acl'].' WHERE operator_id=? AND file=?', [(int)$_SESSION['operator_id'],$file])->fetchColumn()===1;
    }
    private function requirePermission($file) { if (!$this->allowed($file)) { throw new PCError('You do not have permission for this action.',403); } }
    public function permissions() {
        $out=[]; foreach(['mng_new','mng_edit','mng_del','mng_import_users','mng_rad_profiles_new','mng_rad_profiles_edit','mng_rad_profiles_del','config_maint_disconnect_user','acct_all','config_operators_list','config_backup_managebackups','mng_rad_nas_list'] as $f) { $out[$f]=$this->allowed($f); } return $out;
    }
    private function text($in,$key,$max=128,$required=false) {
        $v=$in[$key]??''; if (!is_string($v) || strlen($v)>$max || preg_match('/[\x00-\x1f\x7f]/',$v)) { throw new PCError('Invalid '.$key.'.'); }
        $v=trim($v); if($required && $v==='')throw new PCError($key.' is required.'); return $v;
    }
    private function username($v) {
        if (!is_string($v) || !preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_.@+:-]{0,63}$/D',$v)) throw new PCError('Invalid username. Use letters, numbers, . _ @ + : or -.'); return $v;
    }
    private function exists($u) { return (bool)$this->q('SELECT 1 FROM ('.$this->userUnion().') u WHERE username=?',[$u])->fetchColumn(); }
    private function userUnion() { return 'SELECT username FROM '.$this->tables['users'].' UNION SELECT username FROM '.$this->tables['check'].' UNION SELECT username FROM '.$this->tables['groups']; }
    private function audit($action,$u,$status,$detail,$session='') {
        $this->q('INSERT INTO pc_admin_audit (operator_name,action,username,session_id,status,detail) VALUES (?,?,?,?,?,?)',[$this->operator,$action,$u,$session,$status,$detail]);
    }
    private function transaction($fn) {
        $this->db->beginTransaction(); try { $r=$fn(); $this->db->commit(); return $r; } catch(Throwable $e) { if($this->db->inTransaction())$this->db->rollBack(); throw $e; }
    }
    public function groups() {
        $g=$this->tables['groups'];$r=$this->tables['groupreply'];$c=$this->tables['groupcheck'];
        return $this->q("SELECT x.groupname,(SELECT COUNT(DISTINCT username) FROM $g ug WHERE ug.groupname=x.groupname) members,(SELECT GROUP_CONCAT(DISTINCT value SEPARATOR ', ') FROM $r gr WHERE gr.groupname=x.groupname AND attribute='Fortinet-Group-Name') fortigate_group FROM (SELECT groupname FROM $g UNION SELECT groupname FROM $r UNION SELECT groupname FROM $c) x ORDER BY x.groupname")->fetchAll();
    }
    private function baseUsers() {
        $t=$this->tables;
        return "SELECT u.username,TRIM(CONCAT(COALESCE(ui.firstname,''),' ',COALESCE(ui.lastname,''))) full_name,
          CASE WHEN ui.providerData IS NOT NULL AND ui.providerData<>'' THEN 'ProviderID' ELSE 'Local' END source,
          (SELECT GROUP_CONCAT(DISTINCT groupname ORDER BY priority SEPARATOR ', ') FROM {$t['groups']} g WHERE g.username=u.username) user_groups,
          (SELECT MAX(value) FROM {$t['check']} c WHERE c.username=u.username AND attribute='Expiration') expiration,
          (SELECT MAX(STR_TO_DATE(value,'%d %b %Y %H:%i:%s')<NOW()) FROM {$t['check']} c WHERE c.username=u.username AND attribute='Expiration') is_expired,
          EXISTS(SELECT 1 FROM {$t['check']} c WHERE c.username=u.username AND attribute='Auth-Type' AND value='Reject') OR EXISTS(SELECT 1 FROM {$t['groups']} ug JOIN {$t['groupcheck']} gc ON gc.groupname=ug.groupname WHERE ug.username=u.username AND gc.attribute='Auth-Type' AND gc.value='Reject') suspended,
          (SELECT COUNT(*) FROM {$t['acct']} a WHERE a.username=u.username AND acctstoptime IS NULL) sessions,
          (SELECT COUNT(*) FROM {$t['acct']} a WHERE a.username=u.username AND acctstoptime IS NULL AND COALESCE(acctupdatetime,acctstarttime)<DATE_SUB(NOW(),INTERVAL 10 MINUTE)) stale_sessions,
          (SELECT GROUP_CONCAT(DISTINCT framedipaddress SEPARATOR ', ') FROM {$t['acct']} a WHERE a.username=u.username AND acctstoptime IS NULL) ip_addresses,
          (SELECT MAX(acctstarttime) FROM {$t['acct']} a WHERE a.username=u.username) last_connected
          FROM (".$this->userUnion().") u LEFT JOIN {$t['users']} ui ON ui.username=u.username";
    }
    private function accountStatus($row) {
        if ((int)$row['suspended']) return 'Suspended';
        if (!empty($row['is_expired'])) return 'Expired';
        return 'Enabled';
    }
    public function users($in) {
        $q=$this->text($in,'q',128);$filter=$this->text($in,'filter',32);$group=$this->text($in,'group',128);
        $params=[];$where=['1=1'];
        if($q!=='') { $where[]='(username LIKE ? OR full_name LIKE ? OR ip_addresses LIKE ?)'; $like='%'.strtr($q,['!'=>'!!','%'=>'!%','_'=>'!_']).'%'; $where[count($where)-1]="(username LIKE ? ESCAPE '!' OR full_name LIKE ? ESCAPE '!' OR ip_addresses LIKE ? ESCAPE '!')"; $params=[$like,$like,$like]; }
        if($group!==''){$where[]='username IN (SELECT username FROM '.$this->tables['groups'].' WHERE groupname=?)';$params[]=$group;}
        if($filter==='online')$where[]='sessions>0 AND stale_sessions<sessions';
        if($filter==='offline')$where[]='sessions=0';
        if($filter==='open')$where[]='sessions>0';
        if($filter==='expiring')$where[]="STR_TO_DATE(expiration,'%d %b %Y %H:%i:%s') BETWEEN NOW() AND DATE_ADD(NOW(),INTERVAL 7 DAY)";
        if($filter==='stale')$where[]='stale_sessions>0';
        if($filter==='suspended')$where[]='suspended=1';
        if($filter==='expired')$where[]="suspended=0 AND STR_TO_DATE(expiration,'%d %b %Y %H:%i:%s')<NOW()";
        $page=max(1,min(100000,(int)($in['page']??1)));$offset=($page-1)*25;
        $base=' FROM ('.$this->baseUsers().') data WHERE '.implode(' AND ',$where);
        $total=(int)$this->q('SELECT COUNT(*)'.$base,$params)->fetchColumn();
        $rows=$this->q('SELECT *'.$base.' ORDER BY username LIMIT 25 OFFSET '.$offset,$params)->fetchAll();
        foreach($rows as &$r) { $r['account_status']=$this->accountStatus($r);$r['connection_status']=(int)$r['sessions']===0?'Offline':((int)$r['stale_sessions']===(int)$r['sessions']?'Needs verification':'Online (reported)'); }
        return ['rows'=>$rows,'total'=>$total,'page'=>$page,'updated_at'=>gmdate('c')];
    }
    public function detail($u) {
        $u=$this->username($u);if(!$this->exists($u))throw new PCError('User not found.',404);
        $row=$this->q('SELECT * FROM ('.$this->baseUsers().') data WHERE username=?',[$u])->fetch();
        $info=$this->q('SELECT firstname,lastname,email,department,company,notes,providerData,updatedate,updateby FROM '.$this->tables['users'].' WHERE username=?',[$u])->fetch()?:[];
        // Never return raw providerData, account passwords, tokens or arbitrary provider fields.
        $provider=json_decode($info['providerData']??'',true);$provider=is_array($provider)?$provider:[];
        $profile=[];foreach(['firstname','lastname','email','department','company'] as $k)$profile[$k]=$info[$k]??'';
        $providerId=$provider['provider_id']??null;
        $profile['provider_id']=is_scalar($providerId)?(string)$providerId:'';
        $profile['last_synced']=(($info['updateby']??'')==='OAuthCallback' && !empty($info['updatedate']) && substr($info['updatedate'],0,4)!=='0000')?$info['updatedate']:null;
        $attrs=$this->q('SELECT attribute,value FROM '.$this->tables['check'].' WHERE username=? AND attribute IN (\'Expiration\',\'Simultaneous-Use\') UNION ALL SELECT attribute,value FROM '.$this->tables['reply'].' WHERE username=? AND attribute IN (\'Session-Timeout\',\'Idle-Timeout\')',[$u,$u])->fetchAll();
        $access=[];foreach($attrs as $a)$access[$a['attribute']]=$a['value'];
        $groups=$this->q('SELECT groupname FROM '.$this->tables['groups'].' WHERE username=? ORDER BY priority',[$u])->fetchAll(PDO::FETCH_COLUMN);
        $row['account_status']=$this->accountStatus($row);
        return ['user'=>$row,'profile'=>$profile,'access'=>$access,'groups'=>$groups,'sessions'=>$this->sessions($u),'history'=>$this->allowed('acct_all')?$this->history(['username'=>$u]):[]];
    }
    public function sessions($u) {
        return $this->q('SELECT radacctid,acctsessionid,framedipaddress,callingstationid,nasipaddress,acctstarttime,acctupdatetime,acctsessiontime,CASE WHEN COALESCE(acctupdatetime,acctstarttime)<DATE_SUB(NOW(),INTERVAL 10 MINUTE) THEN 1 ELSE 0 END stale FROM '.$this->tables['acct'].' WHERE username=? AND acctstoptime IS NULL ORDER BY acctstarttime DESC',[$u])->fetchAll();
    }
    public function history($in) {
        $this->requirePermission('acct_all');$u=$this->text($in,'username',128);$q=$this->text($in,'q',128);$from=$this->text($in,'from',10);$to=$this->text($in,'to',10);
        $w=['1=1'];$p=[];
        if($u!==''){$w[]='username=?';$p[]=$u;}
        if($q!==''){$w[]='(username LIKE ? OR framedipaddress LIKE ?)';$p[]='%'.$q.'%';$p[]='%'.$q.'%';}
        foreach(['from'=>$from,'to'=>$to] as $key=>$v)if($v!==''){if(!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$v)||!strtotime($v))throw new PCError('Invalid date.');$w[]='acctstarttime '.($key==='from'?'>=':'<=').' ?';$p[]=$v.($key==='from'?' 00:00:00':' 23:59:59');}
        if($from!==''&&$to!==''&&$from>$to)throw new PCError('Start date must not be after end date.');
        return $this->q('SELECT username,framedipaddress,callingstationid,nasipaddress,acctstarttime,acctstoptime,acctsessiontime,acctinputoctets,acctoutputoctets,acctterminatecause FROM '.$this->tables['acct'].' WHERE '.implode(' AND ',$w).' ORDER BY radacctid DESC LIMIT 100',$p)->fetchAll();
    }
    public function authenticationEvents($in) {
        $this->requirePermission('acct_all');$u=$this->text($in,'username',128);$q=$this->text($in,'q',128);$from=$this->text($in,'from',10);$to=$this->text($in,'to',10);$w=['1=1'];$p=[];
        if($u!==''){$w[]='username=?';$p[]=$u;}if($q!==''){$w[]='username LIKE ?';$p[]='%'.$q.'%';}
        foreach(['from'=>$from,'to'=>$to] as $key=>$v)if($v!==''){if(!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$v)||!strtotime($v))throw new PCError('Invalid date.');$w[]='authdate '.($key==='from'?'>=':'<=').' ?';$p[]=$v.($key==='from'?' 00:00:00':' 23:59:59');}
        if($from!==''&&$to!==''&&$from>$to)throw new PCError('Start date must not be after end date.');
        return $this->q('SELECT username,reply,authdate FROM '.$this->tables['auth'].' WHERE '.implode(' AND ',$w).' ORDER BY id DESC LIMIT 100',$p)->fetchAll();
    }
    public function dashboard() {
        $r=$this->q('SELECT COUNT(*) users,SUM(suspended) suspended,SUM(sessions>0 AND stale_sessions<sessions) online_users,SUM(sessions) sessions,SUM(stale_sessions) stale_sessions,SUM(STR_TO_DATE(expiration,\'%d %b %Y %H:%i:%s\') BETWEEN NOW() AND DATE_ADD(NOW(),INTERVAL 7 DAY)) expiring FROM ('.$this->baseUsers().') d')->fetch();
        $r['updated_at']=gmdate('c');return $r;
    }
    private function setAttribute($table,$u,$attr,$value) {
        $this->q('DELETE FROM '.$this->tables[$table].' WHERE username=? AND attribute=?',[$u,$attr]);
        if($value!==null&&$value!=='')$this->q('INSERT INTO '.$this->tables[$table].' (username,attribute,op,value) VALUES (?,?,?,?)',[$u,$attr,':=',(string)$value]);
    }
    private function groupName($v) { if(!is_string($v)||!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_. -]{0,63}$/D',$v))throw new PCError('Invalid group name.');return $v; }
    private function validateUser($in,$create) {
        $u=$this->username($in['username']??'');$out=['username'=>$u];
        if($create&&$this->exists($u))throw new PCError('Username already exists.',409);
        if(!$create&&!$this->exists($u))throw new PCError('User not found.',404);
        foreach(['firstname','lastname','email','department','company'] as $k)$out[$k]=$this->text($in,$k,200);
        if($out['email']!==''&&!filter_var($out['email'],FILTER_VALIDATE_EMAIL))throw new PCError('Invalid email address.');
        $password=$in['password']??'';
        if(!is_string($password)||strlen($password)>128||preg_match('/[\x00-\x1f\x7f]/',$password)||($create&&strlen($password)<8)||($password!==''&&strlen($password)<8))throw new PCError('Password must contain 8–128 characters.');
        $out['password']=$password;
        $out['groups']=$in['groups']??[];
        if(!is_array($out['groups'])||count($out['groups'])>20)throw new PCError('Invalid group selection.');
        $available=array_column($this->groups(),'groupname');foreach($out['groups'] as $g)if(!in_array($g,$available,true))throw new PCError('Select an existing group.');
        foreach(['simultaneous','session_timeout','idle_timeout'] as $key){$v=$in[$key]??'';if($v!==''&&(!is_scalar($v)||!ctype_digit((string)$v)||(int)$v<1||(int)$v>31536000))throw new PCError('Invalid '.$key.'.');$out[$key]=$v;}
        $expiration=$this->text($in,'expires',19);$out['expiration']='';
        if($expiration!==''){$d=DateTime::createFromFormat('!Y-m-d\TH:i',$expiration);if(!$d||$d->format('Y-m-d\TH:i')!==$expiration)throw new PCError('Invalid expiry date.');$out['expiration']=$d->format('d M Y H:i:s');}
        return $out;
    }
    public function saveUser($in,$create) {
        $this->requirePermission($create?'mng_new':'mng_edit');$v=$this->validateUser($in,$create);$u=$v['username'];
        return $this->transaction(function() use($v,$u,$create){
            $provider=$this->q('SELECT providerData FROM '.$this->tables['users'].' WHERE username=?',[$u])->fetchColumn();
            if($provider&&$v['password']!=='')throw new PCError('ProviderID credentials are managed by the provider.');
            if($create)$this->q('INSERT INTO '.$this->tables['users'].' (username,firstname,lastname,email,department,company,creationdate,creationby) VALUES (?,?,?,?,?,?,NOW(),?)',[$u,$v['firstname'],$v['lastname'],$v['email'],$v['department'],$v['company'],$this->operator]);
            elseif(!$provider){
                $id=$this->q('SELECT id FROM '.$this->tables['users'].' WHERE username=?',[$u])->fetchColumn();
                if(!$id)$this->q('INSERT INTO '.$this->tables['users'].' (username,creationdate,creationby) VALUES (?,NOW(),?)',[$u,$this->operator]);
                $this->q('UPDATE '.$this->tables['users'].' SET firstname=?,lastname=?,email=?,department=?,company=?,updatedate=NOW(),updateby=? WHERE username=?',[$v['firstname'],$v['lastname'],$v['email'],$v['department'],$v['company'],$this->operator,$u]);
            }
            if($v['password']!==''){
                // Replacing an explicit local password clears conflicting password encodings only.
                $this->q("DELETE FROM ".$this->tables['check']." WHERE username=? AND attribute IN ('Cleartext-Password','Crypt-Password','MD5-Password','SMD5-Password','SHA-Password','SSHA-Password','NT-Password','LM-Password','User-Password')",[$u]);
                $this->setAttribute('check',$u,'Cleartext-Password',$v['password']);
            }
            $this->setAttribute('check',$u,'Expiration',$v['expiration']);$this->setAttribute('check',$u,'Simultaneous-Use',$v['simultaneous']);
            $this->setAttribute('reply',$u,'Session-Timeout',$v['session_timeout']);$this->setAttribute('reply',$u,'Idle-Timeout',$v['idle_timeout']);
            $this->q('DELETE FROM '.$this->tables['groups'].' WHERE username=?',[$u]);foreach(array_values(array_unique($v['groups'])) as $i=>$g)$this->q('INSERT INTO '.$this->tables['groups'].' (username,groupname,priority) VALUES (?,?,?)',[$u,$g,$i+1]);
            $this->audit($create?'user.create':'user.update',$u,'success','Account and access settings saved; credentials omitted.');return ['message'=>'User saved. Existing sessions are unchanged.'];
        });
    }
    public function suspend($in) {
        $this->requirePermission('mng_edit');$u=$this->username($in['username']??'');if(!$this->exists($u))throw new PCError('User not found.',404);
        $enable=($in['enable']??false)===true;
        return $this->transaction(function()use($u,$enable){
            $snapshot=$this->q('SELECT auth_snapshot FROM pc_user_access WHERE username=?',[$u])->fetchColumn();
            if($enable){
                if($snapshot===false)throw new PCError('This account was not suspended here. Review its RADIUS attributes before enabling it.');
                $this->q('DELETE FROM '.$this->tables['check'].' WHERE username=? AND attribute=\'Auth-Type\'',[$u]);
                foreach(json_decode($snapshot,true) as $a)$this->q('INSERT INTO '.$this->tables['check'].' (username,attribute,op,value) VALUES (?,\'Auth-Type\',?,?)',[$u,$a['op'],$a['value']]);
                $this->q('DELETE FROM pc_user_access WHERE username=?',[$u]);
            }else{
                if($snapshot!==false)throw new PCError('Account is already suspended.');
                $old=$this->q('SELECT op,value FROM '.$this->tables['check'].' WHERE username=? AND attribute=\'Auth-Type\'',[$u])->fetchAll();
                $this->q('INSERT INTO pc_user_access (username,auth_snapshot) VALUES (?,?)',[$u,json_encode($old)]);$this->setAttribute('check',$u,'Auth-Type','Reject');
            }
            $this->audit($enable?'user.enable':'user.suspend',$u,'success','Existing sessions are unchanged; disconnect separately.');return ['message'=>$enable?'Account enabled.':'Account suspended. Disconnect active sessions separately.'];
        });
    }
    public function deleteUser($in) {
        $this->requirePermission('mng_del');$u=$this->username($in['username']??'');if(!$this->exists($u))throw new PCError('User not found.',404);
        if($this->sessions($u))throw new PCError('Disconnect active or stale sessions before deleting this account.',409);
        return $this->transaction(function()use($u){foreach(['check','reply','groups','users'] as $t)$this->q('DELETE FROM '.$this->tables[$t].' WHERE username=?',[$u]);$this->q('DELETE FROM pc_user_access WHERE username=?',[$u]);$this->audit('user.delete',$u,'success','Account removed. Accounting history retained.');return ['message'=>'User deleted. Accounting history retained.'];});
    }
    public function saveGroup($in) {
        $g=$this->groupName($in['groupname']??'');$available=array_column($this->groups(),'groupname');$this->requirePermission(in_array($g,$available,true)?'mng_rad_profiles_edit':'mng_rad_profiles_new');
        $match=$this->groupName($in['fortigate_group']??'');
        return $this->transaction(function()use($g,$match){$this->q('DELETE FROM '.$this->tables['groupreply'].' WHERE groupname=? AND attribute=\'Fortinet-Group-Name\'',[$g]);$this->q('INSERT INTO '.$this->tables['groupreply'].' (groupname,attribute,op,value) VALUES (?,\'Fortinet-Group-Name\',\'+=\',?)',[$g,$match]);$this->audit('group.save','','success','Group '.$g.' maps to '.$match.'. FortiGate policy matching must be configured separately.');return ['message'=>'Group saved. Validate FortiGate group matching before deployment.'];});
    }
    public function deleteGroup($in) {
        $this->requirePermission('mng_rad_profiles_del');$g=$this->groupName($in['groupname']??'');
        if($this->q('SELECT COUNT(*) FROM '.$this->tables['groups'].' WHERE groupname=?',[$g])->fetchColumn())throw new PCError('Move all members out of this group before deleting it.',409);
        return $this->transaction(function()use($g){foreach(['groupreply','groupcheck'] as $t)$this->q('DELETE FROM '.$this->tables[$t].' WHERE groupname=?',[$g]);$this->audit('group.delete','','success','Removed group '.$g);return ['message'=>'Group deleted.'];});
    }
    public function auditRows($in) {
        $this->requirePermission('acct_all');$u=$this->text($in,'username',128);
        return $this->q('SELECT created_at,operator_name,action,username,session_id,status,detail FROM pc_admin_audit'.($u!==''?' WHERE username=?':'').' ORDER BY id DESC LIMIT 100',$u!==''?[$u]:[])->fetchAll();
    }
    public function nasList() { $this->requirePermission('mng_rad_nas_list');return $this->q('SELECT id,nasname,shortname,type,ports,description FROM '.$this->tables['nas'].' ORDER BY shortname')->fetchAll(); }
    public function importCsv($in) {
        $this->requirePermission('mng_import_users');$this->requirePermission('mng_new');
        if(empty($_FILES['csv'])||$_FILES['csv']['error']!==UPLOAD_ERR_OK||$_FILES['csv']['size']>1048576)throw new PCError('Upload a CSV file up to 1 MB.');
        $fh=fopen($_FILES['csv']['tmp_name'],'r');$headers=fgetcsv($fh);if(!$headers)throw new PCError('CSV is empty.');$headers[0]=preg_replace('/^\xEF\xBB\xBF/','',$headers[0]);
        $expected=['username','password','firstname','lastname','email','group'];if($headers!==$expected)throw new PCError('CSV columns must be: '.implode(',',$expected));
        $rows=[];$seen=[];$n=1;
        while(($r=fgetcsv($fh))!==false){$n++;if($r===[null])continue;if(count($r)!==6)throw new PCError('Invalid column count on row '.$n);$v=array_combine($expected,$r);$v['groups']=$v['group']!==''?[$v['group']]:[];unset($v['group']);if(isset($seen[$v['username']]))throw new PCError('Duplicate username on row '.$n);$seen[$v['username']]=true;$rows[]=$this->validateUser($v,true);if(count($rows)>500)throw new PCError('Maximum 500 users per import.');}
        fclose($fh);if(!$rows)throw new PCError('CSV contains no users.');
        // Validate the entire file before any write. Revalidate/create in one transaction.
        return $this->transaction(function()use($rows){foreach($rows as $v){$u=$v['username'];$this->q('INSERT INTO '.$this->tables['users'].' (username,firstname,lastname,email,creationdate,creationby) VALUES (?,?,?,?,NOW(),?)',[$u,$v['firstname'],$v['lastname'],$v['email'],$this->operator]);$this->setAttribute('check',$u,'Cleartext-Password',$v['password']);foreach($v['groups'] as $i=>$g)$this->q('INSERT INTO '.$this->tables['groups'].' (username,groupname,priority) VALUES (?,?,?)',[$u,$g,$i+1]);$this->audit('user.import',$u,'success','Imported from CSV; credentials omitted.');}return ['message'=>count($rows).' users imported.'];});
    }
    private function selectedUsers($in) {
        $users=$in['usernames']??null;
        if(!is_array($users)||count($users)<1||count($users)>100)throw new PCError('Select between 1 and 100 users.');
        // Validate every target before starting any mutation; never expand a search into a delete.
        $valid=[];foreach($users as $u)$valid[]=$this->username($u);
        return array_values(array_unique($valid));
    }
    public function bulkPreview($in) {
        $rows=[];foreach($this->selectedUsers($in) as $u){
            if(!$this->exists($u)){$rows[]=['username'=>$u,'exists'=>false,'groups'=>[],'sessions'=>[]];continue;}
            $groups=$this->q('SELECT DISTINCT groupname FROM '.$this->tables['groups'].' WHERE username=? ORDER BY priority',[$u])->fetchAll(PDO::FETCH_COLUMN);
            $rows[]=['username'=>$u,'exists'=>true,'groups'=>$groups,'sessions'=>$this->sessions($u)];
        }
        return ['users'=>$rows,'updated_at'=>gmdate('c')];
    }
    public function bulkUsers($in) {
        $operation=$in['operation']??'';
        if(!in_array($operation,['groups','delete'],true))throw new PCError('Unknown bulk action.');
        $this->requirePermission($operation==='groups'?'mng_edit':'mng_del');
        $users=$this->selectedUsers($in);$groups=[];$mode='';
        if($operation==='groups'){
            $mode=$in['mode']??'';if(!in_array($mode,['add','remove','replace'],true))throw new PCError('Choose Add, Remove or Replace groups.');
            $groups=$in['groups']??null;
            if(!is_array($groups)||count($groups)>20||(!$groups&&$mode!=='replace'))throw new PCError('Select one or more groups (maximum 20).');
            $available=array_column($this->groups(),'groupname');
            foreach($groups as $g)if(!is_string($g)||!in_array($g,$available,true))throw new PCError('Select existing groups.');
            $groups=array_values(array_unique($groups));
        }
        $results=[];
        foreach($users as $u){
            try {
                if(!$this->exists($u))throw new PCError('User no longer exists.',404);
                if($operation==='delete')$result=$this->deleteUser(['username'=>$u]);
                else $result=$this->transaction(function()use($u,$groups,$mode){
                    $current=$this->q('SELECT groupname FROM '.$this->tables['groups'].' WHERE username=? ORDER BY priority FOR UPDATE',[$u])->fetchAll(PDO::FETCH_COLUMN);
                    $current=array_values(array_unique($current));
                    $next=$mode==='replace'?$groups:($mode==='add'?array_values(array_unique(array_merge($current,$groups))):array_values(array_diff($current,$groups)));
                    if(count($next)>20)throw new PCError('This change would exceed 20 groups for this user.');
                    $this->q('DELETE FROM '.$this->tables['groups'].' WHERE username=?',[$u]);
                    foreach($next as $i=>$g)$this->q('INSERT INTO '.$this->tables['groups'].' (username,groupname,priority) VALUES (?,?,?)',[$u,$g,$i+1]);
                    $this->audit('user.groups.'.$mode,$u,'success','Bulk membership update: '.json_encode(['before'=>$current,'after'=>$next]));
                    return ['message'=>'Groups updated. Existing sessions are unchanged.'];
                });
                $results[]=['username'=>$u,'status'=>'success','message'=>$result['message']];
            }catch(PCError $e){$results[]=['username'=>$u,'status'=>'skipped','message'=>$e->getMessage()];}
            catch(Throwable $e){error_log('Provider Admin bulk action: '.$e->getMessage());$results[]=['username'=>$u,'status'=>'error','message'=>'This user could not be processed. Check the Admin server log.'];}
        }
        return ['results'=>$results];
    }
    private function nasFor($ip) {
        if(!filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4))throw new PCError('Session has no valid IPv4 NAS address.');
        $rows=$this->q('SELECT nasname,ports,secret FROM '.$this->tables['nas'].' ORDER BY id')->fetchAll();$candidates=[];
        foreach($rows as $n){$bits=32;$host=$n['nasname'];if(strpos($host,'/')!==false){[$host,$b]=explode('/',$host,2);if(!ctype_digit($b)||(int)$b>32)continue;$bits=(int)$b;}
            if(!filter_var($host,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4))continue;
            $mask=$bits===0?0:(0xffffffff << (32-$bits));if((ip2long($ip)&$mask)===(ip2long($host)&$mask)){$n['prefix']=$bits;$candidates[]=$n;}}
        if(!$candidates)throw new PCError('No registered NAS matches this session. Configure its RADIUS client first.');
        usort($candidates,function($a,$b){return $b['prefix']<=>$a['prefix'];});return $candidates[0];
    }
    private function sendDisconnect($row,$nas) {
        $binary=trim((string)shell_exec('command -v radclient 2>/dev/null'));if(!$binary||!is_executable($binary))throw new PCError('radclient is unavailable on the Admin server.',503);
        $secret=(string)$nas['secret'];if($secret===''||preg_match('/[\r\n\x00]/',$secret))throw new PCError('NAS secret is missing or invalid.');
        $port=(int)$nas['ports'];if($port===0)$port=3799;if($port<1||$port>65535)throw new PCError('Invalid NAS disconnect port.');
        $file=tempnam(sys_get_temp_dir(),'pc-radius-');if(!$file)throw new PCError('Cannot prepare RADIUS request.',500);chmod($file,0600);
        try {
            file_put_contents($file,$secret."\n");
            $values=['User-Name'=>$row['username'],'Acct-Session-Id'=>$row['acctsessionid'],'NAS-IP-Address'=>$row['nasipaddress']];
            if(filter_var($row['framedipaddress'],FILTER_VALIDATE_IP,FILTER_FLAG_IPV4))$values['Framed-IP-Address']=$row['framedipaddress'];
            if($row['callingstationid'])$values['Calling-Station-Id']=$row['callingstationid'];
            $payload='';foreach($values as $k=>$v){if(!is_string($v)||$v===''||preg_match('/[\x00-\x1f\x7f]/',$v))throw new PCError('Session identifiers are missing or invalid.');$payload.=$k.' = "'.addcslashes($v,"\\\"").'"'."\n";}
            $proc=proc_open([$binary,'-x','-r','1','-t','2','-S',$file,$row['nasipaddress'].':'.$port,'disconnect'],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
            if(!is_resource($proc))throw new PCError('Cannot start RADIUS request.',503);
            fwrite($pipes[0],$payload);fclose($pipes[0]);stream_set_blocking($pipes[1],false);stream_set_blocking($pipes[2],false);$output='';$start=microtime(true);
            do{$output.=stream_get_contents($pipes[1]).stream_get_contents($pipes[2]);$state=proc_get_status($proc);if(!$state['running'])break;if(microtime(true)-$start>4){proc_terminate($proc);break;}usleep(20000);}while(true);
            $output.=stream_get_contents($pipes[1]).stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);proc_close($proc);
            if(preg_match('/Received Disconnect-ACK\b/',$output))return ['status'=>'acknowledged','message'=>'NAS acknowledged. Waiting for Accounting-Stop; refresh to verify.'];
            if(preg_match('/Received Disconnect-NAK\b/',$output))return ['status'=>'rejected','message'=>'NAS rejected the disconnect request.'];
            if(stripos($output,'No reply')!==false||microtime(true)-$start>4)return ['status'=>'timeout','message'=>'No NAS response. Session state is unconfirmed.'];
            return ['status'=>'error','message'=>'RADIUS request failed. Check NAS port, network reachability and shared-secret configuration.'];
        } finally {unlink($file);}
    }
    public function disconnect($in) {
        $this->requirePermission('config_maint_disconnect_user');$u=$this->username($in['username']??'');
        $ids=$in['session_ids']??[];if(!is_array($ids)||!$ids||count($ids)>10)throw new PCError('Select between 1 and 10 sessions per request.');
        foreach($ids as $id)if(!is_scalar($id)||!ctype_digit((string)$id))throw new PCError('Invalid session identifier.');
        $results=[];
        foreach(array_unique($ids) as $id){
            $row=$this->q('SELECT username,radacctid,acctsessionid,nasipaddress,framedipaddress,callingstationid FROM '.$this->tables['acct'].' WHERE radacctid=? AND username=? AND acctstoptime IS NULL',[$id,$u])->fetch();
            if(!$row){$results[]=['id'=>$id,'status'=>'not_active','message'=>'Session has already stopped or no longer exists.'];continue;}
            // Persist intent before sending a packet. Fail closed if audit storage is unavailable.
            $this->audit('session.disconnect',$u,'pending','Disconnect requested for '.$row['framedipaddress'].' via '.$row['nasipaddress'],$row['acctsessionid']);
            try{$result=$this->sendDisconnect($row,$this->nasFor($row['nasipaddress']));}catch(PCError $e){$result=['status'=>'error','message'=>$e->getMessage()];}
            $this->audit('session.disconnect.result',$u,$result['status'],$result['message'],$row['acctsessionid']);$result['id']=$id;$results[]=$result;
        }
        return ['results'=>$results];
    }
}
