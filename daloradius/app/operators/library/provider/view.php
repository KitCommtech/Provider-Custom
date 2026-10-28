<?php if (!defined('PC_ADMIN')) { http_response_code(404); exit; }
?>
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Provider Admin</title>
<link rel="stylesheet" href="static/css/bootstrap.min.css">
<link rel="stylesheet" href="static/css/icons/bootstrap-icons.min.css">
<link rel="stylesheet" href="static/css/provider-admin.css?v=20261028-log-layout">
</head><body>
<?php require __DIR__.'/shell.php'; ?>
<main class="app-main"><div class="workspace-breadcrumb"><span>Workspace</span><i class="bi bi-chevron-right" aria-hidden="true"></i><span id="currentViewName">Dashboard</span></div><div id="notice" class="alert" role="status" aria-live="polite"></div><div id="content" aria-live="polite" tabindex="-1"></div></main>
<div class="offcanvas offcanvas-end" tabindex="-1" id="userDrawer" aria-labelledby="drawerTitle"><div class="offcanvas-header"><h2 id="drawerTitle" class="h4">User details</h2><button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close details"></button></div><div class="offcanvas-body"><div id="drawerNotice" role="status" aria-live="polite"></div><div id="drawerBody"></div></div></div>
<dialog id="confirmDialog"><form method="dialog"><h2 class="h5" id="confirmTitle">Confirm action</h2><p id="confirmText"></p><div class="d-flex gap-2 justify-content-end"><button class="btn btn-secondary" value="cancel">Cancel</button><button class="btn btn-danger" id="confirmSubmit" value="confirm">Confirm</button></div></form></dialog>
<script id="pc-config" type="application/json"><?= json_encode(['csrf'=>$_SESSION['pc_csrf'],'permissions'=>$pcPermissions],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT) ?></script>
<script src="static/js/bootstrap.bundle.min.js"></script><script src="static/js/provider-shell.js?v=20261026"></script><script src="static/js/provider-format.js?v=20261028-log-layout"></script><script src="static/js/provider-admin.js?v=20261028-log-layout"></script>
</body></html>
