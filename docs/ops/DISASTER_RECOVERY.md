# Disaster Recovery Guide

## Overview

This guide covers how to recover the Vexel Health Platform from a full loss scenario (VPS destroyed, DB corrupted, or data breach requiring clean rebuild).

## Backup Locations

| Backup Type | Default Path |
|-------------|-------------|
| Full backups | `/home/munaim/srv/apps/vexel/runtime/backups/full/` |
| Tenant exports | `/home/munaim/srv/apps/vexel/runtime/backups/tenants/` |
| Restore inbox | `/home/munaim/srv/apps/vexel/runtime/backups/restore_inbox/` |
| Logs | `/home/munaim/srv/apps/vexel/runtime/data/logs/` |

Offsite copies should be configured via a Storage Target (Admin → Ops → Storage).

---

## Full Restore Procedure

### Step 1 — Provision a new VPS
1. Install Docker and Docker Compose
2. Install Caddy
3. Clone the repo:
   ```bash
   git clone git@github.com:munaimtahir/vexel.git /home/munaim/srv/apps/vexel
   ```

### Step 2 — Copy the backup artifact to the restore inbox
```bash
scp backup-file.tar.gz <user>@<new-vps>:/home/munaim/srv/apps/vexel/runtime/backups/restore_inbox/
```

### Step 3 — Run the restore script
```bash
cd /home/munaim/srv/apps/vexel
./ops/restore_full.sh runtime/backups/restore_inbox/backup-file.tar.gz
```

The script will:
1. Extract the backup
2. Restore PostgreSQL database (drop + recreate)
3. Restore MinIO data volume
4. Restore env files (you will be prompted for the decryption passphrase)
5. Restore Caddy routing config and reload Caddy

### Step 4 — Start the stack
```bash
docker compose up -d
```

### Step 5 — Verify
```bash
./ops/healthcheck.sh
```

Expected: all 19/19 checks pass.

### Step 6 — DNS
Point the domain's DNS to the new VPS IP. Caddy will obtain a new TLS certificate automatically.

---

## Restore via Admin UI

1. Go to Admin → Ops → Restore
2. Select the backup artifact from the succeeded backups list
3. Click **Dry Run** and review the restore plan
4. Enable **Pre-snapshot** (recommended)
5. Type `yes-restore` in the confirmation field
6. Click **Apply Restore**
7. Monitor progress in the logs viewer

---

## Tenant Data Recovery

To recover a single tenant's data from a tenant export:

1. Locate the tenant export archive in `runtime/backups/tenants/`
2. Extract it:
   ```bash
   tar xzf vexel-tenant-<tenantId>-<timestamp>.tar.gz -C /tmp/tenant-restore/
   ```
3. Find the CSV files for each table
4. Use `psql` or `pg_copy` to import specific tables

> ⚠️ Tenant exports are CSV-based snapshots. They do not include MinIO files (those require a full backup restore).

---

## Rollback (Caddy routing)

If Caddy routing breaks after a restore:

```bash
# Re-link the vexel Caddyfile
ln -sf /home/munaim/srv/apps/vexel/runtime/proxy/vexel.Caddyfile \
       /home/munaim/srv/proxy/caddy/overrides/vexel.Caddyfile

# Validate and reload
caddy adapt --config /etc/caddy/Caddyfile | \
  curl -sf -X POST -H 'Content-Type: application/json' -d @- http://localhost:2019/load
```

If that fails, restore the last-known-good Caddyfile:
```bash
cp /home/munaim/srv/proxy/caddy/Caddyfile.bak.before-vexel-migration \
   /home/munaim/srv/proxy/caddy/Caddyfile
```
Then reload Caddy.

---

## RPO / RTO Targets

| Metric | Target |
|--------|--------|
| RPO (Recovery Point Objective) | 24 hours (with daily scheduled backup) |
| RTO (Recovery Time Objective) | ~30 minutes for full restore |
| Tenant export RPO | On-demand (manual trigger or scheduled) |

Improve RPO by configuring daily or hourly scheduled backups in Admin → Ops → Schedules.

---

## Security Notes

- Env files in backup archives are **AES-256-CBC encrypted** — keep the passphrase safe
- The passphrase used in server-managed mode is stored in the runtime environment (never in the backup itself)
- Never email or share backup archives in plaintext channels
- Limit `ops.restore` permission to trusted senior administrators only
