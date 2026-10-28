<?php
// Run by the host timer, independently of browser traffic. No HTTP entry point.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('PC_ADMIN',true);
require dirname(__DIR__,3).'/common/includes/config_read.php';
require __DIR__.'/core.php';
try {
    $db=new PDO('mysql:host='.$configValues['CONFIG_DB_HOST'].';port='.($configValues['CONFIG_DB_PORT']??3306).';dbname='.$configValues['CONFIG_DB_NAME'].';charset=utf8mb4',$configValues['CONFIG_DB_USER'],$configValues['CONFIG_DB_PASS'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
    $store=new ProviderLogStore($db,['accounting'=>$configValues['CONFIG_DB_TBL_RADACCT'],'authentication'=>$configValues['CONFIG_DB_TBL_RADPOSTAUTH'],'admin'=>'pc_admin_audit'],'system.retention');
    if(!in_array('--run',$argv,true)){echo json_encode($store->status(),JSON_PRETTY_PRINT),"\n";exit;}
    $until=microtime(true)+45;$totals=['accounting'=>0,'authentication'=>0,'admin'=>0];$passes=0;
    do {
        $plan=$store->plan('all','expired');$result=$store->clear($plan,true);$passes++;
        foreach($result['deleted'] as $kind=>$count)$totals[$kind]+=$count;
        $more=false;foreach($plan['eligible'] as $kind=>$count)if($count>count($plan['targets'][$kind]))$more=true;
    } while($more&&microtime(true)<$until&&$passes<100);
    echo json_encode(['retention_days'=>7,'deleted'=>$totals,'passes'=>$passes,'more_pending'=>$more]),"\n";
} catch(Throwable $e){fwrite(STDERR,"Log retention could not complete. Check database access and retry; no credentials are printed.\n");exit(1);}
