<?php if (!defined('PC_ADMIN')) { http_response_code(404); exit; }
$h=function($v){return htmlspecialchars($v,ENT_QUOTES,'UTF-8');};
?>
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Provider Admin</title><link rel="stylesheet" href="static/css/bootstrap.min.css">
<style>body{background:#f7f7f7}main{max-width:1600px;margin:auto;padding:24px}nav{display:flex;gap:8px;flex-wrap:wrap;padding:16px;border-bottom:1px solid #ddd;background:white}.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:16px}.table{background:white}td{vertical-align:middle}.table th,.table td{white-space:nowrap;overflow-wrap:normal}button,a,input,select{min-height:38px}.offcanvas{--bs-offcanvas-width:min(900px,100vw)}.section{background:white;border:1px solid #ddd;padding:20px;margin-bottom:16px}.muted{color:#666;font-size:.9rem}.error{color:#a00}label{display:block;margin-bottom:12px}label input,label select{margin-top:4px}.stats{display:flex;gap:12px;flex-wrap:wrap}.stats a{padding:16px;border:1px solid #ddd;background:white;min-width:150px;text-decoration:none}.stats strong{display:block;font-size:1.7rem}#notice:empty{display:none}.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:16px 0}#drawerBody{padding-bottom:40px}dialog{border:1px solid #aaa;border-radius:6px;max-width:600px;width:95vw}dialog::backdrop{background:#0006}.form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 16px}</style>
</head><body>
<nav aria-label="Main navigation"><strong class="me-3">Provider Admin</strong>
<?php foreach(['dashboard'=>'Dashboard','users'=>'Users','groups'=>'User Groups','activity'=>'Activity & Logs','settings'=>'Settings'] as $v=>$label): ?>
<a class="btn btn-outline-secondary" data-view="<?= $v ?>" href="mng-list-all.php?view=<?= $v ?>"><?= $label ?></a>
<?php endforeach; ?>
<span class="ms-auto"><?= $h($_SESSION['operator_user']) ?> · <a href="logout.php">Log out</a></span></nav>
<main><div id="notice" class="alert" role="status" aria-live="polite"></div><div id="content" aria-live="polite"></div></main>
<div class="offcanvas offcanvas-end" tabindex="-1" id="userDrawer" aria-labelledby="drawerTitle"><div class="offcanvas-header"><h2 id="drawerTitle" class="h4">User details</h2><button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close user details"></button></div><div class="offcanvas-body"><div id="drawerNotice" role="status" aria-live="polite"></div><div id="drawerBody"></div></div></div>
<dialog id="confirmDialog"><form method="dialog"><h2 class="h5" id="confirmTitle">Confirm action</h2><p id="confirmText"></p><div class="d-flex gap-2 justify-content-end"><button class="btn btn-secondary" value="cancel">Cancel</button><button class="btn btn-danger" id="confirmSubmit" value="confirm">Confirm</button></div></form></dialog>
<script id="pc-config" type="application/json"><?= json_encode(['csrf'=>$_SESSION['pc_csrf'],'permissions'=>$pcPermissions],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?></script>
<script src="static/js/bootstrap.bundle.min.js"></script><script src="static/js/provider-admin.js"></script>
</body></html>
