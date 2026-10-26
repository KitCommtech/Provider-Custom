<?php
if (strpos($_SERVER['PHP_SELF'], '/include/menu/') !== false) { http_response_code(404); exit; }
?>
<header class="border-bottom p-3"><nav aria-label="Main navigation" class="d-flex gap-3 flex-wrap"><strong>Provider Admin</strong>
<a href="mng-list-all.php?view=dashboard">Dashboard</a><a href="mng-list-all.php?view=users">Users</a><a href="mng-list-all.php?view=groups">User Groups</a><a href="mng-list-all.php?view=activity">Activity &amp; Logs</a><a href="mng-list-all.php?view=settings">Settings</a><a href="logout.php" class="ms-auto">Log out</a>
</nav></header>
