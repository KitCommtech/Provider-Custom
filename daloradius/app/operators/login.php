<?php
/*
 *********************************************************************************************************
 * daloRADIUS - RADIUS Web Platform
 * Copyright (C) 2007 - Liran Tal <liran@lirantal.com> All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 *
 *********************************************************************************************************
 *
 * Authors:    Liran Tal <liran@lirantal.com>
 *             Filippo Lauria <filippo.lauria@iit.cnr.it>
 *
 *********************************************************************************************************
 */

include_once("library/sessions.php");
dalo_session_start();

if (array_key_exists('daloradius_logged_in', $_SESSION)
    && $_SESSION['daloradius_logged_in'] !== false) {
    header('Location: index.php');
    exit;
}

// this include "exports" $langCode that can be used later in this script
include("lang/main.php");

// ~ used later for rendering location select element
$onlyDefaultLocation = !(array_key_exists('CONFIG_LOCATIONS', $configValues)
                        && is_array($configValues['CONFIG_LOCATIONS'])
                        && count($configValues['CONFIG_LOCATIONS']) > 0);

$dir = (strtolower($langCode) === 'ar') ? "rtl" : "ltr";

?>
<!DOCTYPE html>
<html lang="<?= $langCode ?>" dir="<?= $dir ?>">

<head>
    <title>Sign In · Admin Management</title>
    <meta charset="utf-8">
    <meta http-equiv="content-type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="copyright" content="Liran Tal & Filippo Lauria">
    <meta name="robots" content="noindex">

    <link rel="apple-touch-icon" sizes="180x180" href="static/images/favicon/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="static/images/favicon/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="static/images/favicon/favicon-16x16.png">
    <link rel="manifest" href="static/images/favicon/site.webmanifest">

    <link rel="stylesheet" href="static/css/bootstrap.min.css">
    
    <link rel="stylesheet" href="static/css/provider-login.css">
</head>

<body>
    <main class="login-card" aria-labelledby="login-title">
    <header class="login-header">
        <img class="login-logo" src="static/images/logo-sknhos.png" alt="SKNHOS" width="144" height="108">
        <h1 id="login-title">Admin Management</h1>
        <p>Sign in to your workspace</p>
    </header>
<?php
    if (!empty($_SESSION['operator_login_error'])) {
        echo '<div class="login-error" role="alert">Unable to sign in. Check your username and password and try again.</div>';
        unset($_SESSION['operator_login_error']);
    }
?>
    <form action="dologin.php" method="POST" class="login-form">

    <div class="form-floating">
    <input type="text" class="form-control" id="operator_user" name="operator_user" placeholder="<?= t('all','Username') ?>" autocomplete="username" required>
    <label for="operator_user"><?= t('all','Username') ?></label>
    </div>
    
    <div class="form-floating">
    <input type="password" class="form-control" id="operator_pass" name="operator_pass" placeholder="<?= t('all','Password') ?>" autocomplete="current-password" required>
    <label for="operator_pass"><?= t('all','Password') ?></label>
    </div>

    <div class="form-floating">
        <select class="form-select" id="location" name="location" <?= ($onlyDefaultLocation) ? " disabled" : "" ?>>
<?php
        $defaultLocationFormat = '<option value="%s">%s</option>' . "\n";
        if ($onlyDefaultLocation) {
            printf($defaultLocationFormat, "default", "default");
        } else {
            $locations = array_keys($configValues['CONFIG_LOCATIONS']);
            foreach ($locations as $location) {
                $location = htmlspecialchars($location, ENT_QUOTES, 'UTF-8');
                printf($defaultLocationFormat, $location, $location);
            }
        }
?>
        </select>
        <label for="location">Location</label>
    </div>
                    
    <button class="w-100 btn btn-primary login-submit" type="submit">Sign In</button>
    
    <input name="csrf_token" type="hidden" value="<?= dalo_csrf_token() ?>">
    </form>
    

    </main>

    <script src="static/js/bootstrap.bundle.min.js"></script>
</body>

</html>
