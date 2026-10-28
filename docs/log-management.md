# Log management

Activity & Logs contains Connection History, Authentication and Admin Activity with 25 records per page, date filters and search. Database wall-clock times are displayed as `28 Oct 2026 · 13:04:09`, labelled Server time. No browser timezone conversion is applied. Authentication passwords and provider tokens are excluded from responses.

Session Timeout offers minutes, hours and seconds. The UI sends whole seconds to the existing RADIUS `Session-Timeout` reply attribute. Idle Timeout is hidden and no longer configured by this Admin form. Existing database attributes are preserved.

## Retention

Keep seven days of authentication and admin events. Connection history expires seven days after **session end**, preserving open, zero-date and undated sessions, including stale sessions. Do not infer disconnects or fabricate Accounting-Stop records. User accounts, group assignments and NAS settings are outside cleanup scope.

The CLI is inaccessible over HTTP. Without `--run`, it only reports counts:

```sh
docker exec radius-web php /var/www/daloradius/app/operators/library/provider/maintenance.php
```

After backing up the database privately and deploying the tested commit, install the service and timer from this directory on the PRD host. They target the existing `radius-web` container without changing networks, secrets or environment files:

```sh
install -m 0644 docs/systemd/provider-admin-log-retention.service /etc/systemd/system/
install -m 0644 docs/systemd/provider-admin-log-retention.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now provider-admin-log-retention.timer
systemctl start provider-admin-log-retention.service
systemctl status provider-admin-log-retention.timer --no-pager
journalctl -u provider-admin-log-retention.service -n 10 --no-pager
```

The hourly job drains expired logs in bounded batches with a database lock; failures return a nonzero exit code. Each batch records a `logs.retention` event. The page reports the last cleanup. Expired entries may remain until the next hourly run; large backlogs can require subsequent runs.

Clear Logs requires existing reporting **and** accounting maintenance delete permissions. An expiring, session-bound preview freezes selected IDs, up to 5,000 per log type. Clearing requires typed `CLEAR` and confirmation. Eligibility is rechecked and newly arriving rows are excluded. Partial failures report the count already deleted and require a new preview. Cleanup intent/results remain audited.

Deleting database rows makes space reusable inside InnoDB; it does not promise to shrink data files immediately. This feature does not clear raw Docker logs, backups or unrelated system logs.

## Release workflow

Develop and test on local `source/`, branch `dev`. Commit and push `origin/dev`. On PRD, fetch the exact tested commit in a separate release checkout of `KitCommtech/Provider-Custom`, leaving the original repository and its account unchanged. Build the Admin overlay from that checkout, back up current state privately, and switch only `radius-web` using the existing compose project/container names and read-only private config. Preserve Portal/RADIUS/DB containers and all `.env` files. Keep an image/compose rollback.

## Local validation

- `node tests/provider-format.js` checks conversion and timestamp formatting, including fractional SQL timestamps and invalid/zero dates.
- `tests/provider-admin.php` and `tests/provider-logs.php` run against new empty QA table copies, never copied production rows; they drop only tables they created.
- `tests/provider-logs-http.py` is a non-destructive HTTP check intended only for the documented disposable local operator fixture. Use a real Admin session for interactive UI review. Never use an ordinary RADIUS account to access Admin.
