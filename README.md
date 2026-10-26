# Provider-Custom

Source snapshot for customizing the server-exported daloRADIUS and Provider portal stack.

## Contents

- `daloradius/`: PHP application copied from the running server image; upstream license and notices retained.
- `web-portal/`: exported Node backend and compiled frontend, plus package metadata. Original TypeScript/React sources were not present in the export; rebuilding the frontend requires the original source repository.
- `radius-app/`: exported FreeRADIUS initialization script.
- `compose.local.yml`: isolated local stack using the exact image IDs already imported on the development Mac. Admin: http://localhost:8001; portal: http://localhost:8080.
- `compose.server-reference.yml`: server Compose reference only; review ports, mounts and secrets before deployment.

## Local development

This repository is a source snapshot, not a Docker image or database backup. The image IDs in `compose.local.yml` must already be available locally. On another machine, obtain the matching images privately or replace the references after validation.

1. Copy `.env.example` to `.env` and supply local credentials. External identity-provider settings must be configured separately.
2. Create `private/database/`. If restoring a private test database, place the approved SQL file there before the first database start. No production dump or user records are included in this repository. SQL initialization runs only for a fresh database volume.
3. Supply `daloradius/app/common/includes/daloradius.conf.php` privately using the adjacent `.sample` as a reference. Set database host to `radius-mysql` and match `.env`. This runtime file is intentionally ignored.
4. Review initialization scripts and application schema before starting a fresh environment.
5. Run `docker compose -f compose.local.yml up -d`.

The existing development containers still mount the original `Provider/local-dev` directory. Editing this snapshot does not change those running containers until their bind mounts are deliberately switched. Do not start this snapshot alongside the existing stack under the same Compose project name.

## Publication exclusions

Real `.env` files, live daloRADIUS configuration, server database backups, runtime data, dependency installs and nested Git history are excluded. The SQL files under `daloradius/contrib/db` are upstream schema/dictionary/seed assets, not the server database export. Some upstream seed accounts are defaults and must be changed before deployment.

## Provenance and validation

Prepared from the local server export on 26 October 2026. The original development directory and server backup were left untouched. daloRADIUS and bundled third-party components retain their respective licenses; this repository does not relicense them. Exported portal package metadata declares MIT, but original frontend sources are not included.

Validation for this snapshot: Compose configuration syntax and publication-file checks. The existing original stack was previously verified to respond on HTTP 8001/8080; a fresh deployment from this sanitized snapshot has not been tested.

## Focused Admin UI (dev)

See [Admin features, migration and validation](docs/admin-features.md). The new Admin requires the additive schema migration and preserves the private environment configuration.
