<?php
if (strpos($_SERVER['PHP_SELF'], '/include/menu/') !== false) { http_response_code(404); exit; }
?>
<aside aria-label="Admin tools"><h2 class="h6">Administration</h2><p><a href="mng-list-all.php?view=users">Back to Users</a></p><p><a href="mng-list-all.php?view=settings">Settings</a></p><p class="small">Batch accounts, card printing, billing and Portal styling are outside this workspace.</p></aside>
