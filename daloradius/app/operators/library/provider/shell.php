<?php
// Shared presentation only; callers retain their existing authentication and ACL checks.
if (strpos($_SERVER['PHP_SELF'], '/library/provider/shell.php') !== false) { http_response_code(404); exit; }
$pcShellEscape=function($v){return htmlspecialchars($v,ENT_QUOTES,'UTF-8');};
$pcCurrentView=basename($_SERVER['SCRIPT_NAME'])==='mng-list-all.php'?($_GET['view']??'dashboard'):'settings';
if(!is_string($pcCurrentView))$pcCurrentView='dashboard';
?>
<a class="skip-link" href="#content">Skip to content</a>
<header class="app-header">
 <a class="brand" href="mng-list-all.php?view=dashboard" aria-label="Admin Management dashboard"><img class="brand-logo" src="static/images/logo-sknhos.png" alt="SKNHOS"><span>ADMIN<small>Management</small></span></a>
 <button class="mobile-menu icon-button" id="menuToggle" type="button" aria-label="Open navigation" aria-controls="appSidebar" aria-expanded="false"><i class="bi bi-list" aria-hidden="true"></i></button>
 <div class="header-context">Network access management</div>
 <div class="header-account"><span class="workspace-tag"><span></span> Admin Console</span><span class="avatar" aria-hidden="true"><?= $pcShellEscape(strtoupper(substr($_SESSION['operator_user'],0,1))) ?></span><span class="header-username"><?= $pcShellEscape($_SESSION['operator_user']) ?></span></div>
</header>
<button id="sidebarBackdrop" class="sidebar-backdrop" type="button" aria-label="Close navigation" hidden></button>
<aside class="app-sidebar" id="appSidebar">
 <div class="sidebar-profile"><span class="avatar" aria-hidden="true"><?= $pcShellEscape(strtoupper(substr($_SESSION['operator_user'],0,1))) ?></span><div><strong><?= $pcShellEscape($_SESSION['operator_user']) ?></strong><small>Workspace operator</small></div></div>
 <label class="nav-search"><i class="bi bi-search" aria-hidden="true"></i><input id="navSearch" type="search" placeholder="Search menu…" aria-label="Search navigation"></label>
 <div class="nav-section-label">WORKSPACE</div>
 <nav aria-label="Main navigation">
<?php foreach(['dashboard'=>['Dashboard','grid-1x2'], 'users'=>['Users','people'], 'groups'=>['User Groups','collection'], 'activity'=>['Activity & Logs','clock-history'], 'nas'=>['NAS Devices','router'], 'settings'=>['Settings','sliders']] as $v=>$item): ?>
 <a class="nav-item" data-view="<?= $v ?>" aria-current="<?= $pcCurrentView===$v?'page':'false' ?>" href="mng-list-all.php?view=<?= $v ?>"><i class="bi bi-<?= $item[1] ?>" aria-hidden="true"></i><span><?= $item[0] ?></span><i class="bi bi-chevron-right nav-chevron" aria-hidden="true"></i></a>
<?php endforeach; ?>
 </nav><p id="navEmpty" class="nav-empty" hidden>No matching menu items.</p>
 <div class="sidebar-footer"><a href="logout.php"><i class="bi bi-box-arrow-right" aria-hidden="true"></i>Log out</a></div>
</aside>
