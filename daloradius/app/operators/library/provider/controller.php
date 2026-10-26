<?php
if (!defined('PC_ADMIN')) { http_response_code(404); exit; }
require_once __DIR__.'/core.php';
try {
    $host=$configValues['CONFIG_DB_HOST'];$port=(int)($configValues['CONFIG_DB_PORT']??3306);
    $db=new PDO('mysql:host='.$host.';port='.$port.';dbname='.$configValues['CONFIG_DB_NAME'].';charset=utf8mb4',$configValues['CONFIG_DB_USER'],$configValues['CONFIG_DB_PASS'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
    $pc=new ProviderAdmin($db,$configValues,$_SESSION['operator_user']);
    if(!$pc->allowed('mng_list_all'))throw new PCError('You do not have access to Users.',403);
    if(empty($_SESSION['pc_csrf']))$_SESSION['pc_csrf']=bin2hex(random_bytes(32));
    if(isset($_GET['api'])){
        header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
        $action=$_GET['api'];$in=$_GET;
        $writes=['save_user','create_user','suspend','delete_user','save_group','delete_group','import','disconnect','bulk_preview','bulk_users'];
        if(in_array($action,$writes,true)){
            if($_SERVER['REQUEST_METHOD']!=='POST')throw new PCError('Use POST for this action.',405);
            if(!hash_equals($_SESSION['pc_csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??''))throw new PCError('Session verification failed. Reload and try again.',403);
            if($action==='import')$in=$_POST;
            else {$in=json_decode(file_get_contents('php://input'),true);if(!is_array($in))throw new PCError('Invalid request body.');}
        }elseif($_SERVER['REQUEST_METHOD']!=='GET')throw new PCError('Use GET for this action.',405);
        switch($action){
            case 'users':$result=$pc->users($in);break;
            case 'detail':$result=$pc->detail($in['username']??'');break;
            case 'groups':$result=$pc->groups();break;
            case 'dashboard':$result=$pc->dashboard();break;
            case 'history':$result=$pc->history($in);break;
            case 'audit':$result=$pc->auditRows($in);break;
            case 'auth_events':$result=$pc->authenticationEvents($in);break;
            case 'nas':$result=$pc->nasList();break;
            case 'create_user':$result=$pc->saveUser($in,true);break;
            case 'save_user':$result=$pc->saveUser($in,false);break;
            case 'suspend':$result=$pc->suspend($in);break;
            case 'delete_user':$result=$pc->deleteUser($in);break;
            case 'save_group':$result=$pc->saveGroup($in);break;
            case 'delete_group':$result=$pc->deleteGroup($in);break;
            case 'disconnect':$result=$pc->disconnect($in);break;
            case 'import':$result=$pc->importCsv($in);break;
            case 'bulk_preview':$result=$pc->bulkPreview($in);break;
            case 'bulk_users':$result=$pc->bulkUsers($in);break;
            default:throw new PCError('Unknown action.',404);
        }
        echo json_encode(['ok'=>true,'data'=>$result],JSON_INVALID_UTF8_SUBSTITUTE);exit;
    }
    header('Cache-Control: no-store');
    $pcPermissions=$pc->permissions();
    require __DIR__.'/view.php';
} catch(Throwable $e){
    $code=$e instanceof PCError?$e->http:500;$message=$e instanceof PCError?$e->getMessage():'Unable to complete the request. Check database access and apply the Provider Admin schema migration.';
    http_response_code($code);
    if(isset($_GET['api'])){header('Content-Type: application/json');echo json_encode(['ok'=>false,'error'=>$message]);}
    else {echo '<h1>Provider Admin</h1><p>'.htmlspecialchars($message,ENT_QUOTES,'UTF-8').'</p>';}
    if(!($e instanceof PCError))error_log('Provider Admin: '.$e->getMessage());
}
