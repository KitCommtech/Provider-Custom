<?php
if (strpos($_SERVER['PHP_SELF'], '/include/menu/') !== false) { http_response_code(404); exit; }
?>
<link rel="stylesheet" href="static/css/provider-admin.css?v=20261026">
<div class="legacy-shell"><?php require __DIR__.'/../../library/provider/shell.php'; ?></div>
<script src="static/js/provider-shell.js?v=20261026" defer></script>
