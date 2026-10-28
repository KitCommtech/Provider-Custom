<?php
if (!defined('PC_ADMIN')) { http_response_code(404); exit; }

/** The web UI and scheduled CLI share these exact retention predicates. */
class ProviderLogStore {
    const DAYS = 7;
    const PREVIEW_LIMIT = 5000;
    private $db;
    private $tables;
    private $operator;
    private $definitions = [
        'accounting'=>['id'=>'radacctid','date'=>'acctstoptime'],
        'authentication'=>['id'=>'id','date'=>'authdate'],
        'admin'=>['id'=>'id','date'=>'created_at'],
    ];
    public function __construct(PDO $db, array $tables, $operator) {
        $this->db=$db;$this->operator=$operator;
        foreach ($this->definitions as $kind=>$unused) {
            $name=$tables[$kind]??'';
            if(!is_string($name)||!preg_match('/^[a-zA-Z0-9_]+$/D',$name))throw new PCError('Invalid log table configuration.',500);
            $this->tables[$kind]='`'.$name.'`';
        }
    }
    private function query($sql,$params=[]) {$s=$this->db->prepare($sql);$s->execute($params);return $s;}
    private function kinds($scope) {
        if($scope==='all')return array_keys($this->definitions);
        if(!is_string($scope)||!isset($this->definitions[$scope]))throw new PCError('Choose a log type.');
        return [$scope];
    }
    private function predicate($kind,$mode,$cutoff) {
        if(!in_array($mode,['expired','all'],true))throw new PCError('Choose a cleanup range.');
        $date=$this->definitions[$kind]['date'];$where=['1=1'];$params=[];
        // NULL/zero stop times cannot establish that a session has ended.
        if($kind==='accounting')$where[]="acctstoptime > '1970-01-01 00:00:00'";
        if($mode==='expired'){$where[]="$date < ?";$params[]=$cutoff;}
        return [implode(' AND ',$where),$params];
    }
    private function clock() {return $this->query('SELECT NOW() server_time,DATE_SUB(NOW(),INTERVAL 7 DAY) cutoff')->fetch(PDO::FETCH_ASSOC);}
    public function status() {
        $clock=$this->clock();$counts=[];
        foreach($this->definitions as $kind=>$d){
            list($where,$params)=$this->predicate($kind,'expired',$clock['cutoff']);
            $counts[$kind]=['total'=>(int)$this->query('SELECT COUNT(*) FROM '.$this->tables[$kind])->fetchColumn(),'expired'=>(int)$this->query('SELECT COUNT(*) FROM '.$this->tables[$kind].' WHERE '.$where,$params)->fetchColumn()];
        }
        $protected=(int)$this->query("SELECT COUNT(*) FROM ".$this->tables['accounting']." WHERE acctstoptime IS NULL OR acctstoptime <= '1970-01-01 00:00:00'")->fetchColumn();
        $last=$this->query("SELECT created_at,detail FROM ".$this->tables['admin']." WHERE action='logs.retention' ORDER BY id DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
        return ['retention_days'=>self::DAYS,'server_time'=>$clock['server_time'],'cutoff'=>$clock['cutoff'],'counts'=>$counts,'protected_sessions'=>$protected,'last_automatic_cleanup'=>$last?:null];
    }
    public function entries($in) {
        $kind=$in['kind']??'accounting';$this->kinds($kind);if($kind==='all')throw new PCError('Choose one log type.');
        $page=$in['page']??1;if(!is_scalar($page)||!ctype_digit((string)$page)||(int)$page<1||(int)$page>1000000)throw new PCError('Invalid page.');
        $page=(int)$page;$size=25;$where=['1=1'];$params=[];
        $search=$in['q']??'';if(!is_string($search)||strlen($search)>128||preg_match('/[\x00-\x1f\x7f]/',$search))throw new PCError('Invalid search.');
        $search=trim($search);
        if($search!==''){
            $fields=$kind==='accounting'?['username','framedipaddress','callingstationid','nasipaddress']:($kind==='admin'?['username','operator_name','action']:['username']);
            $where[]='('.implode(' OR ',array_map(function($f){return "$f LIKE ?";},$fields)).')';foreach($fields as $unused)$params[]='%'.$search.'%';
        }
        $date=$kind==='accounting'?'acctstarttime':$this->definitions[$kind]['date'];$dates=[];
        foreach(['from','to'] as $key){
            $v=$in[$key]??'';if(!is_string($v))throw new PCError('Invalid date.');$dates[$key]=$v;
            if($v!==''){$d=preg_match('/^\d{4}-\d{2}-\d{2}$/D',$v)?DateTime::createFromFormat('!Y-m-d',$v):false;if(!$d||$d->format('Y-m-d')!==$v)throw new PCError('Invalid date.');$where[]=$date.($key==='from'?' >= ?':' < DATE_ADD(?,INTERVAL 1 DAY)');$params[]=$v;}
        }
        if($dates['from']!==''&&$dates['to']!==''&&$dates['from']>$dates['to'])throw new PCError('Start date must not be after end date.');
        $sqlWhere=implode(' AND ',$where);$total=(int)$this->query('SELECT COUNT(*) FROM '.$this->tables[$kind].' WHERE '.$sqlWhere,$params)->fetchColumn();
        $pages=max(1,(int)ceil($total/$size));$page=min($page,$pages);$offset=($page-1)*$size;
        $columns=$kind==='accounting'?'username,framedipaddress,callingstationid,nasipaddress,acctstarttime,acctstoptime,acctsessiontime,acctinputoctets,acctoutputoctets,acctterminatecause':($kind==='authentication'?'username,reply,authdate':'created_at,operator_name,action,username,session_id,status,detail');
        $rows=$this->query('SELECT '.$columns.' FROM '.$this->tables[$kind].' WHERE '.$sqlWhere.' ORDER BY '.$this->definitions[$kind]['id']." DESC LIMIT $size OFFSET $offset",$params)->fetchAll(PDO::FETCH_ASSOC);
        return ['kind'=>$kind,'rows'=>$rows,'total'=>$total,'page'=>$page,'pages'=>$pages,'page_size'=>$size];
    }
    public function plan($scope,$mode) {
        $kinds=$this->kinds($scope);$clock=$this->clock();$targets=[];$counts=[];$eligible=[];
        foreach($kinds as $kind){
            list($where,$params)=$this->predicate($kind,$mode,$clock['cutoff']);$id=$this->definitions[$kind]['id'];
            $eligible[$kind]=(int)$this->query('SELECT COUNT(*) FROM '.$this->tables[$kind].' WHERE '.$where,$params)->fetchColumn();
            $targets[$kind]=$this->query('SELECT '.$id.' FROM '.$this->tables[$kind].' WHERE '.$where.' ORDER BY '.$id.' LIMIT '.self::PREVIEW_LIMIT,$params)->fetchAll(PDO::FETCH_COLUMN);
            $counts[$kind]=count($targets[$kind]);
        }
        return ['version'=>1,'scope'=>$scope,'mode'=>$mode,'cutoff'=>$clock['cutoff'],'created_at'=>$clock['server_time'],'targets'=>$targets,'counts'=>$counts,'eligible'=>$eligible];
    }
    private function record($action,$status,$detail) {
        $this->query('INSERT INTO '.$this->tables['admin'].' (operator_name,action,status,detail) VALUES (?,?,?,?)',[$this->operator,$action,$status,$detail]);
    }
    public function clear(array $plan,$automatic=false) {
        if(($plan['version']??null)!==1)throw new PCError('Refresh the cleanup preview.');
        $kinds=$this->kinds($plan['scope']??null);$mode=$plan['mode']??null;
        if($automatic&&$mode!=='expired')throw new PCError('Automatic cleanup may only remove expired logs.');
        if(!is_string($plan['cutoff']??null)||!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/D',$plan['cutoff']))throw new PCError('Invalid cleanup cutoff.');
        foreach($kinds as $kind){
            list($unused,$unusedParams)=$this->predicate($kind,$mode,$plan['cutoff']);
            $ids=$plan['targets'][$kind]??null;if(!is_array($ids)||count($ids)>self::PREVIEW_LIMIT)throw new PCError('Invalid cleanup preview.');
            foreach($ids as $id)if(!is_scalar($id)||!ctype_digit((string)$id)||strlen((string)$id)>20)throw new PCError('Invalid cleanup target.');
        }
        $key='pc_logs_'.substr(hash('sha256',$this->query('SELECT DATABASE()')->fetchColumn().json_encode($this->tables)),0,56);
        if((int)$this->query('SELECT GET_LOCK(?,0)',[$key])->fetchColumn()!==1)throw new PCError('Log cleanup is already running. Try again shortly.',409);
        $deleted=array_fill_keys($kinds,0);$action=$automatic?'logs.retention':'logs.clear';
        try {
            if(!$automatic)$this->record('logs.clear.request','pending',json_encode(['scope'=>$plan['scope'],'range'=>$mode,'counts'=>$plan['counts']]));
            foreach($kinds as $kind){
                list($where,$params)=$this->predicate($kind,$mode,$plan['cutoff']);$id=$this->definitions[$kind]['id'];
                foreach(array_chunk($plan['targets'][$kind],500) as $chunk){
                    $statement=$this->query('DELETE FROM '.$this->tables[$kind].' WHERE '.$where.' AND '.$id.' IN ('.implode(',',array_fill(0,count($chunk),'?')).')',array_merge($params,$chunk));
                    $deleted[$kind]+=$statement->rowCount();
                }
            }
            $this->record($action,'success',json_encode(['range'=>$mode,'cutoff'=>$plan['cutoff'],'deleted'=>$deleted,'open_sessions'=>'preserved']));
            return ['deleted'=>$deleted,'total_deleted'=>array_sum($deleted),'message'=>array_sum($deleted).' log record(s) cleared. Open and undated sessions were preserved.'];
        } catch(Throwable $e) {
            try{$this->record($action,'error',json_encode(['deleted_before_error'=>$deleted,'retry'=>'preview again']));}catch(Throwable $ignored){}
            throw new PCError('Cleanup stopped after '.array_sum($deleted).' deletion(s). Preview again before retrying.',500);
        } finally {$this->query('SELECT RELEASE_LOCK(?)',[$key]);}
    }
}
