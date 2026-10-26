# Provider Admin functional update

The English Admin entry point is `mng-list-all.php`. Existing Admin login and dalo operator ACLs are retained. The existing main/home/management entry points now lead to the focused workspace.

## Navigation and features

- **Dashboard**: total users, reported online users, open sessions, sessions needing verification, suspended accounts, accounts expiring within 7 days. Cards open the related Users filter.
- **Users**: paginated username/name/IP search and group/status filters. Create local users, edit local profiles, change local passwords, assign groups, set expiry/concurrency/session/idle limits, suspend/enable, delete accounts without open accounting records. Deletion retains accounting history.
- **User detail drawer**: Profile, Account & Access, Active Sessions, History. Search, filters and page remain in place when opening or saving a drawer.
- **Provider Profile**: allowlisted name, provider ID, email, organization and department fields. Provider profile/credentials are read-only. `Last Synced` is shown only when the existing `updateby=OAuthCallback` and a valid `updatedate` establish the timestamp; older ambiguous records show “Not recorded”. Raw provider JSON, passwords and tokens are never returned to the Admin browser.
- **CSV Import**: UTF-8 header `username,password,firstname,lastname,email,group`. Up to 500 rows / 1 MB. Existing usernames, invalid fields and unknown groups fail validation before any writes. The import uses one database transaction.
- **User Groups**: membership is managed in Account & Access. Groups expose the `Fortinet-Group-Name` RADIUS reply mapping, preserving other group attributes. FortiGate group matches and shaping policies must still be configured on the FortiGate. Multiple group mappings use additive reply operators.
- **Active Sessions**: per-device IP, MAC, NAS, start, last update and reported duration. Open records with no update in 10 minutes are explicitly marked “Needs verification”. The threshold is a UI heuristic; it is not proof of a live/offline device and should be reviewed against the configured interim update interval.
- **Disconnect**: confirmation for one or all sessions, server-side session ownership and ACL checks, NAS lookup and bounded radclient requests. Username, Acct-Session-Id, NAS-IP-Address and available IP/MAC are sent in Disconnect-Request packets. ACK, NAK, timeout and errors are reported separately. ACK does not set Accounting-Stop or fabricate an offline state. All-session requests run in batches of at most ten. Audit intent is persisted before sending a packet.
- **Activity & Logs**: latest 100 accounting records filtered by user/IP/date, password-free authentication results from radpostauth, and recent admin actions. User detail history retains the account's connection and admin history.
- **Settings**: links to existing NAS/FortiGate, operator ACL and backup tools. Secrets are omitted from the new NAS summary. Those legacy tools retain their existing behavior.

Batch account generation/card printing, billing, GIS and Portal appearance controls are hidden from the focused navigation. Legacy handlers remain available to existing ACLs; hiding a menu is not an authorization boundary.

## Database migration

Apply `daloradius/app/operators/library/provider/schema.sql` before deployment. It adds only `pc_admin_audit` and `pc_user_access`; it does not alter existing user records or environment files. Runtime code deliberately does not create tables automatically. `pc_user_access` preserves prior Auth-Type rows while an account is suspended through the new UI.

## Local validation setup

The local `radius-web` container mounts `source/daloradius` through the parent project's `compose.admin-dev.yml`. Its existing private `daloradius.conf.php` is mounted read-only from the original export. Existing database volumes and the original Portal container are retained. The Admin runs at http://localhost:8001; Portal remains http://localhost:8080.

No `.env` or `.env.example` keys or values were edited. All four existing environment files matched their SHA-256 baseline after validation.

## Validation — 26 October 2026

- PHP syntax checks on the actual PHP 7.4 container, and JavaScript syntax check.
- **46 integration assertions**: empty-state dashboard, local CRUD/password handling, expiry and access attributes, suspension/restore, provider read-only fields and redaction, groups and membership, CSV atomic validation, accounting search, multiple and stale sessions, authentication results without passwords, ACL enforcement, audit records and safe deletion.
- Disconnect tests exercised the actual `radclient` UDP path against a loopback NAS simulator producing authenticated Disconnect-ACK, Disconnect-NAK and timeout responses. No real NAS was contacted by those tests.
- **9 HTTP checks**: login required, CSRF enforcement, POST-only mutations, profile response redaction, SQL injection treated as search text, direct-include protection, and read-only loading of all three Settings tools.
- Browser checks: Admin login, navigation, User/IP search, Provider Profile, access form, multiple sessions, Disconnect confirmation/cancel, group creation, user creation/edit, Suspend/Enable, CSV upload, accounting/audit history, Settings and logout. Screenshots were captured with fictional QA profile/session data.
- QA tables and browser fixtures are removed after testing. Existing private user records are not used as test targets.

Not validated here: real FortiGate group matching/shaping, disconnect/Accounting-Stop on an actual FortiGate, upstream ProviderID OAuth, backup creation/restore, or operator permission edits in the legacy tools. Their existing pages load, but those state-changing legacy workflows were not exercised in this UI change.

## Running the automated checks

Run only in an isolated/local environment with the migration applied. `tests/provider-admin.php` creates empty `pcqa_*` copies of the configured tables and removes them in `finally`; it refuses to overwrite pre-existing test tables. Copy it and `tests/provider-mock-nas.php` into the PHP container's `/tmp` and run the former with PHP.

`tests/provider-ui-fixture.php` creates fictional Local UI fixtures and a temporary QA operator; `php /tmp/provider-ui-fixture.php clean` removes them. `tests/provider-admin-http.py` expects those fixtures and localhost port 8001. These fixed credentials are test-only, never deployment credentials.

## FortiGate reference

Fortinet documents group matching against the Fortinet-Group-Name RADIUS attribute:
https://docs.fortinet.com/document/fortigate/7.6.0/administration-guide/710485/restricting-radius-user-groups-to-match-selective-users-on-the-radius-server

## Multi-user actions

Users now has per-row checkboxes, Select All on This Page, a selection count, Clear Selection and permission-aware Change Groups / Disconnect Sessions / Delete Users actions. Up to 100 explicit usernames may be selected across pages. Search/filter changes clear the selection; no action implicitly selects every matching account.

Every action opens a fresh preview listing exact usernames, existing groups and open session counts, followed by an explicit confirmation. Membership modes are Add (preserves existing groups), Remove (preserves others), and Replace (overwrites all memberships, including explicitly clearing all). Provider profiles, credentials and access limits are untouched by membership changes. Each user is processed independently with audit records and per-user success/skip/error results.

Bulk deletion uses the same guard as individual deletion: accounts with any open accounting records, including stale ones, are skipped. Missing accounts are reported separately; accounting history is retained.

Bulk Disconnect snapshots session IDs at preview time and sends them through the existing ACL/CSRF-protected per-session endpoint in chunks of ten. Later-created sessions are not silently included. ACK/NAK/timeout outcomes remain explicit and Accounting-Stop is never fabricated. Offline users are skipped, and the Review Disconnect button is disabled if the entire preview has no open sessions.

User Groups has View Members (opens the group-filtered Users list) and Assign Users (opens Users with that target group preselected in Change Groups). No membership writes happen merely by opening either view.

Validation update: **62 integration assertions passed**, including multi-user preview, deduplication, limits, invalid targets/groups, add/remove/replace, provider-field preservation, guarded partial deletion and ACL enforcement. Browser checks exercised checkboxes, select-page, preview, confirmation/cancel, target-group handoff and selection reset, without writing to existing accounts. A separate attempt to add UI test fixtures to the working local database was rejected by automatic review because the command lacked integrated cleanup; it was not executed. Automated mutations were tested only in empty prefixed QA tables that the test removes in finally.

## Admin presentation update

The Admin uses a reference-inspired light console layout: a white left sidebar and top bar, a blue active menu item, pale gray workspace background, four colored destination cards, white table panels, status badges and a styled user drawer/confirmation dialog. All labels remain English. The dashboard includes real group counts/mappings and the latest available audit actions, with explicit empty states. No sample metrics are inserted into the database.

A shared `shell.php` / `provider-shell.js` supplies the same navigation for the operator and backup tools. Navigation search, mobile menu/backdrop/Escape, reduced-motion preferences, focus indicators and inert collapsed mobile navigation are supported. Wide tables scroll within their own wrappers. A stale optional legacy tooltip constructor is guarded on the operator listing to avoid its missing-library exception. Existing forms and ACL checks are retained.

Presentation validation: Desktop 1440px and Mobile 375px, all five main views, three legacy Settings tools, navigation search/empty state, dashboard card filters, mobile Escape, user selection and bulk preview, and an empty Add User drawer. Users, Settings, legacy NAS and the user drawer had no page-level horizontal overflow on the mobile viewport. No existing account was mutated. PHP syntax and both JavaScript syntax checks passed. Environment file hashes stayed unchanged. Backend / OAuth credential code was not changed; the existing functional integration tests were not rerun for a presentation-only change.

## SKNHOS branding, dashboard and NAS management

The supplied `logo-sknhos.png` is used in the Admin header and login page. Dashboard cards link to distinct Users, User Groups, Connection Logs and NAS Devices views, with real counts and permission-aware visibility. The verbose refreshed/accounting message and the dalo footer are removed from the Admin presentation.

NAS Devices now uses the shared console layout with Add NAS and Edit NAS drawers. Legacy NAS list/new/edit URLs redirect to this view. Forms accept a device name, IPv4 address or normalized IPv4 subnet, device type, Disconnect/CoA UDP port (default 3799), description and RADIUS shared secret. New NAS records require a secret; a blank secret during editing preserves the saved value. Secrets are not returned to the browser, displayed in the table or written into the audit log. Existing NAS credentials were not changed during validation.

Saves require the appropriate NAS create/edit ACL, authenticated POST and CSRF validation. Duplicate addresses, invalid IPs/ports and invalid new secrets are rejected. Changing an individual NAS IP with open accounting sessions is blocked. Changes are database-only: the RADIUS server must load the client configuration and FortiGate must use the matching source IP/shared secret. Actual FortiGate connectivity remains an environment validation step.

Validation: **75 integration assertions passed** in isolated `pcqa_*` tables with cleanup in `finally`, including NAS create/edit, unchanged/replaced secrets, response/audit redaction, input validation, duplicate addresses, subnet normalization, open-session guard and permissions. Browser validation opens the existing NAS list and add/edit forms without submitting changes to real devices. PHP and JavaScript syntax checks and environment baseline verification are recorded with the local validation artifacts.

## Centered Admin login

The login page now uses a centered responsive card, the SKNHOS logo, Admin Management heading, separated fields, blue Sign In button and an inline invalid-login alert. The visible daloRADIUS version label is removed. Form target, POST field names, CSRF token, location selection and authentication logic are retained; username/current-password autocomplete attributes are supplied. Login-page HTTP assertions identify the form instead of depending on the previous heading text.

Validated at 1440×1000 and 375×812: centered card, no horizontal overflow on mobile, required fields, rejected invalid credentials and readable inline error. PHP syntax and environment hashes verified. Successful authentication was validated in the preceding full functional run; it was not repeated for this presentation update.
