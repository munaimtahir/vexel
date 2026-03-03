# Vexel Stack — Ops README

## Stack Layout

```
/home/munaim/srv/apps/vexel/          ← git repo root (repo stays at this level)
  apps/                                  NestJS API, Next.js Admin, Operator, PDF
  packages/                              Shared SDK, contracts
  docker-compose.yml                     Primary compose file (all services)
  .env                                   Runtime secrets (NOT committed)

  runtime/                             ← runtime state (gitignored for data/)
    proxy/
      vexel.Caddyfile                    Caddy virtual host rules for all vexel.* domains
    backups/
      full/                              timestamped full backup packages
      tenants/                           per-tenant CSV exports
      restore_inbox/                     drop a backup package here to restore
    data/
      logs/                              ops script logs
    env/                                 encrypted env snapshots (see backup_full.sh)
    _evidence/                           pre/post-change snapshots

  docker/
    docker-compose.yml                   → symlink to ../docker-compose.yml

  ops/                                 ← this directory
    backup_full.sh                       Full stack backup
    backup_tenant.sh                     Single-tenant export
    restore_full.sh                      Full restore from backup package
    healthcheck.sh                       Verify all services healthy
    README.md                            This file
```

## Caddy Architecture

- **Source of truth**: `/home/munaim/srv/proxy/caddy/Caddyfile`
- **System path**: `/etc/caddy/Caddyfile` (symlink → source of truth)
- **Import mechanism**: `import /home/munaim/srv/proxy/caddy/overrides/*.Caddyfile`
- **Vexel rules**: `/home/munaim/srv/apps/vexel/runtime/proxy/vexel.Caddyfile`
- **Symlink**: `/home/munaim/srv/proxy/caddy/overrides/vexel.Caddyfile → runtime/proxy/vexel.Caddyfile`

### To add a new tenant subdomain
1. Edit only: `/home/munaim/srv/apps/vexel/runtime/proxy/vexel.Caddyfile`
2. Add a new host block pointing to `127.0.0.1:9024` (or appropriate port)
3. Reload: `caddy adapt --config /etc/caddy/Caddyfile | curl -sf -X POST -H 'Content-Type: application/json' -d @- http://localhost:2019/load`

### Rollback Caddy
If the new config breaks routing:
```bash
# Option A: Restore vexel block to main Caddyfile and remove symlink
cp /home/munaim/srv/proxy/caddy/Caddyfile.bak.before-vexel-migration /home/munaim/srv/proxy/caddy/Caddyfile
rm /home/munaim/srv/proxy/caddy/overrides/vexel.Caddyfile
caddy adapt --config /etc/caddy/Caddyfile | curl -sf -X POST -H 'Content-Type: application/json' -d @- http://localhost:2019/load

# Option B: Remove just the symlink (vexel routing lost, other apps safe)
rm /home/munaim/srv/proxy/caddy/overrides/vexel.Caddyfile
# ... reload caddy, then restore inline block
```

## Service Ports (all bind to 127.0.0.1 only)

| Service     | Port  | Notes                          |
|-------------|-------|--------------------------------|
| API (NestJS)| 9021  | `/api/*` prefix required       |
| PDF (.NET)  | 9022  | `/pdf/*` stripped by Caddy     |
| Admin UI    | 9023  | Next.js `basePath: /admin`     |
| Operator UI | 9024  | catch-all                      |
| MinIO S3    | 9027  | presigned URL bucket access    |
| MinIO UI    | 9025  | console (not public)           |
| Postgres    | 5433  | Docker: `vexel_pgdata` volume  |
| Redis       | 6380  | ephemeral                      |

## Docker Compose

Always run compose from the repo root with the project name:
```bash
cd /home/munaim/srv/apps/vexel
docker compose up -d          # start all services
docker compose ps             # status
docker compose logs -f api    # follow API logs
docker compose build api      # rebuild API image
```

## Backup Operations

### Full Backup (all tenants, all data)
```bash
cd /home/munaim/srv/apps/vexel/ops
BACKUP_PASSPHRASE="your-strong-secret" ./backup_full.sh
# Output: runtime/backups/full/vexel-full-YYYYMMDD_HHMMSS.tar.gz
```

### Tenant Export (one lab)
```bash
./backup_tenant.sh <tenantId>
# Example: ./backup_tenant.sh system
# Output: runtime/backups/tenants/vexel-tenant-<id>-YYYYMMDD_HHMMSS.tar.gz
```

### Full Restore
```bash
./restore_full.sh runtime/backups/full/vexel-full-YYYYMMDD_HHMMSS.tar.gz
# Interactive prompt unless you pass --confirm
```

### Health Check
```bash
./healthcheck.sh
# Exit 0 = all healthy, Exit 1 = failures
```

## First-Time VPS Bootstrap

1. Clone repo: `git clone git@github.com:munaimtahir/vexel.git /home/munaim/srv/apps/vexel`
2. Copy env: `cp .env.example .env && nano .env`  (set JWT_SECRET etc.)
3. Start stack: `docker compose up -d`
4. Run migrations + seed: `docker exec vexel-api-1 npx prisma migrate deploy`
5. Set up Caddy symlink:
   ```bash
   mkdir -p /home/munaim/srv/proxy/caddy/overrides
   ln -sf /home/munaim/srv/apps/vexel/runtime/proxy/vexel.Caddyfile \
           /home/munaim/srv/proxy/caddy/overrides/vexel.Caddyfile
   ```
6. Reload Caddy (see above)
7. Run `./ops/healthcheck.sh` — all green
