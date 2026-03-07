# Vexel Staging Restore Drill Report

Date: 2026-03-07 (UTC)
Environment: /home/munaim/srv/apps/vexel (Docker Compose staging stack)
Artifact used: `/home/munaim/srv/apps/vexel/runtime/backups/full/vexel-full-20260307_043756.tar.gz`

## 1) Artifact integrity verification

Checks performed:
- Archive listed successfully (`tar -tzf`)
- Manifest extracted successfully
- Required backup content confirmed

Observed archive entries include:
- `db/vexel.dump` (database dump)
- `minio/minio_data.tar.gz` (documents/object data volume snapshot)
- `env/.env.enc` (encrypted runtime env snapshot)
- `proxy/vexel.Caddyfile` (routing config)
- `docker-compose.yml`
- `manifest.json`

Manifest confirms:
- `backup_type: full`
- DB format `pg_custom`
- MinIO snapshot present

## 2) Controlled restore proof method

To prove rollback from artifact, a post-backup marker row was inserted before restore:
- `patients.mrn = DRILL-20260307045703`
- Presence before restore: `count = 1`

Restore executed with explicit env guard enablement:
- `VEXEL_ALLOW_RESTORE=true ./ops/restore_full.sh runtime/backups/full/vexel-full-20260307_043756.tar.gz --confirm`

## 3) Restore execution result

Result: **SUCCESS**

Restore log showed:
- Database drop/create succeeded
- `pg_restore` succeeded
- MinIO volume restore succeeded
- Caddy config restore + reload succeeded

Restore log file:
- `/home/munaim/srv/apps/vexel/runtime/data/logs/restore_full_20260307_045810.log`

## 4) Post-restore validation

### Data rollback proof
- Marker query after restore:
  - `SELECT count(*) FROM patients WHERE mrn='DRILL-20260307045703';`
  - Result: **0** (marker removed)

### Service health
- API: `GET /api/health` => `{"status":"ok"...}`
- Admin login page HTTP: `200`
- Operator worklist page HTTP: `200`

### Baseline table counts after restore
- `patients`: `401`
- `encounters`: `364`

## 5) Drill observations

1. Restore must run with DB clients stopped
- Initial restore attempt failed due active DB sessions.
- During drill, `api/worker/admin/operator` were stopped, restore executed, then services restarted.

2. Runtime tmp ownership edge
- `runtime/tmp` became root-owned due container operations and blocked host-run restore.
- Ownership corrected for staging drill.
- Recommendation: enforce writable ownership on `runtime/tmp` in ops scripts or container startup.

## Verdict

Staging restore drill outcome: **PASS**

Evidence demonstrates that Vexel can be reconstructed from full backup artifact with:
- DB restored
- object/document volume restored
- runtime config restored
- application services healthy post-restore
- post-backup marker data rolled back as expected
