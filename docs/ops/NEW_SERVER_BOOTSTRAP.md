# Vexel New Server Bootstrap Runbook

Purpose: move this repository to a new server and bring production up safely after DNS cutover.

Audience: human operator or AI agent executing terminal steps on the new machine.

Last updated: 2026-03-02

---

## 0) Migration Status (Current)

This handoff now assumes:

- `.env` has already been copied to the new server.
- Caddy path-based routing has already been set up on the new server.

So the next blocking focus is:

1. Bring up/rebuild Docker services.
2. Run localhost smoke checks.
3. Run public-domain smoke checks after DNS propagation.

---

## 1) Snapshot of Current Architecture

- Monorepo root: `vexel/`
- Runtime stack (Docker Compose):
  - `postgres` (127.0.0.1:5433)
  - `redis` (127.0.0.1:6380)
  - `api` NestJS (127.0.0.1:9021)
  - `pdf` .NET QuestPDF (127.0.0.1:9022)
  - `admin` Next.js (127.0.0.1:9023, basePath `/admin`)
  - `operator` Next.js (127.0.0.1:9024)
  - `minio` console (127.0.0.1:9025), S3 (127.0.0.1:9027)
  - `worker` BullMQ (internal only)
- Public URL (existing): `https://vexel.alshifalab.pk`
- API prefix is fixed: `/api/*`
- Reverse proxy expected: Caddy (TLS termination), app containers bound to localhost only.

---

## 2) Non-Negotiable Guardrails During Migration

- Do not change OpenAPI contract-first workflow.
- Do not bypass generated SDK in frontend code.
- Do not add direct DB access in Next.js apps.
- Keep tenant isolation and command-only workflow behavior unchanged.
- Do not run destructive database commands unless explicitly approved.

---

## 3) New Server Prerequisites

Install these on the new server first:

1. Docker Engine + Docker Compose plugin
2. Git
3. Node.js 20+
4. pnpm 9.x
5. Caddy 2.x
6. `jq` and `curl` (for smoke checks)

Suggested check:

```bash
docker --version
docker compose version
node -v
pnpm -v
caddy version
jq --version
curl --version
```

---

## 4) Clone and Bootstrap Repository

```bash
mkdir -p /home/munaim/srv/apps
cd /home/munaim/srv/apps
git clone git@github.com:munaimtahir/vexel.git
cd vexel
git checkout main
pnpm install --frozen-lockfile
```

Notes:
- SSH deploy key/user must already have GitHub repo access.
- Keep the path stable if possible (`/home/munaim/srv/apps/vexel`) to reduce drift with existing docs and scripts.

---

## 5) Environment Configuration

Create/update `.env` from `.env.example`:

```bash
cd /home/munaim/srv/apps/vexel
cp .env.example .env
```

Set at minimum:

```env
JWT_SECRET=<64-byte-random-hex>
NEXT_PUBLIC_API_URL=https://<your-domain>
```

Generate JWT secret:

```bash
python3 -c "import secrets; print(secrets.token_hex(64))"
```

Important:
- `NEXT_PUBLIC_API_URL` is a Docker build-arg for admin/operator images. If domain changes, rebuild those images.
- `docker-compose.yml` currently includes production defaults for `vexel.alshifalab.pk`. Update if your new domain differs.

---

## 6) Bring Up Stack

```bash
cd /home/munaim/srv/apps/vexel
docker compose up -d --build
docker compose ps
```

Expected:
- `postgres`, `redis`, `api`, `pdf`, `minio` healthy
- `admin` and `operator` may show `unhealthy` due to disabled/misaligned healthchecks, but should still serve HTTP 200.

API container entrypoint behavior:
- Runs `prisma migrate deploy`
- Runs seed (`node dist/prisma/seed.js || true`)
- Starts API

---

## 7) Caddy Reverse Proxy (Domain Front Door)

Add site block in Caddy config for your domain (example for `vexel.alshifalab.pk`):

```caddy
vexel.alshifalab.pk {
	encode gzip zstd

	# API keeps /api prefix
	handle /api/* {
		reverse_proxy 127.0.0.1:9021
	}

	# PDF service expects /health/pdf etc. Strip /pdf prefix
	handle_path /pdf/* {
		reverse_proxy 127.0.0.1:9022
	}

	# Admin keeps /admin basePath
	handle /admin/* {
		reverse_proxy 127.0.0.1:9023
	}

	# Everything else -> Operator app
	handle {
		reverse_proxy 127.0.0.1:9024
	}
}
```

Reload Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

If your environment uses another Caddy path/service name, adapt commands accordingly.

---

## 8) Smoke Verification Checklist (Blocking)

Run these after stack + proxy are up:

```bash
curl -fsS http://127.0.0.1:9021/api/health
curl -fsS http://127.0.0.1:9022/health/pdf
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9023/admin/login
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9024/lims/worklist
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9025/
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9027/minio/health/live
```

Auth smoke:

```bash
TOKEN=$(curl -fsS -X POST http://127.0.0.1:9021/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@vexel.system","password":"Admin@vexel123!"}' | jq -r .accessToken)

curl -fsS http://127.0.0.1:9021/api/me \
  -H "Authorization: Bearer $TOKEN"
```

Public URL checks (after DNS + TLS):

```bash
curl -fsS https://vexel.alshifalab.pk/api/health
curl -fsS -o /dev/null -w "%{http_code}\n" https://vexel.alshifalab.pk/admin/login
curl -fsS -o /dev/null -w "%{http_code}\n" https://vexel.alshifalab.pk/lims/worklist
```

Expected:
- All health and route checks return 200.
- Login endpoint returns access token.

---

## 9) Demo Credentials (Current Seeded)

- Super Admin: `admin@vexel.pk` / `admin123`
- System Admin: `admin@vexel.system` / `Admin@vexel123!`
- Demo Operator: `operator@demo.vexel.pk` / `Operator@demo123!`
- Demo Verifier: `verifier@demo.vexel.pk` / `Verifier@demo123!`

Change these for production hardening if this is not a demo environment.

---

## 10) Data Migration Notes

If you need existing production data on the new server:

1. Stop write traffic (maintenance window) or set app read-only.
2. Backup old server PostgreSQL and MinIO bucket.
3. Restore backup into new server `postgres` and `minio`.
4. Run `docker compose up -d` and verify migrations do not regress restored schema.
5. Re-run full smoke checklist.

Do not drop or recreate DB volumes during cutover unless you intentionally want a fresh environment.

---

## 11) Frequent Issues and Fixes

1. Admin `/admin/login` 404:
   - Cause: missing proxy route or admin basePath mismatch.
   - Fix: ensure Caddy has `/admin/* -> 9023` and keep `apps/admin/next.config.ts` basePath `/admin`.

2. Frontend calling wrong API host:
   - Cause: stale `NEXT_PUBLIC_API_URL` baked at build time.
   - Fix: set `.env` correctly and rebuild (`docker compose up -d --build admin operator`).

3. API 500 on paginated lists:
   - Previously fixed by numeric cast in services; ensure you are on latest main branch and rebuilt images.

4. Worker or document pipeline not publishing:
   - Check `worker`, `pdf`, `minio` logs and `api/documents` status transitions.

5. `admin`/`operator` marked unhealthy in `docker compose ps`:
   - Known low-priority compose healthcheck mismatch; verify actual HTTP routes instead of container health status.

---

## 12) AI Agent Execution Script (Recommended Order)

Use this exact order on a fresh host:

1. Validate prerequisites (`docker`, `node`, `pnpm`, `caddy`, `jq`).
2. Clone repo into `/home/munaim/srv/apps/vexel`.
3. `pnpm install --frozen-lockfile`.
4. Configure `.env` with secure `JWT_SECRET` and correct `NEXT_PUBLIC_API_URL`.
5. `docker compose up -d --build`.
6. Configure/reload Caddy site block.
7. Run localhost smoke checks.
8. Run public URL smoke checks.
9. Login with seeded admin credentials and verify LIMS operator flow opens.
10. Capture evidence log in `docs/_audit/DEPLOY_RUNS/<timestamp>/` (commands + outputs).

---

## 12.1) Resume Steps (Given Current Status)

Since `.env` and Caddy routing are already done, run:

```bash
cd /home/munaim/srv/apps/vexel
chmod +x scripts/new-server-resume.sh
./scripts/new-server-resume.sh
```

If your public domain is different, run:

```bash
DOMAIN=<your-domain> ./scripts/new-server-resume.sh
```

If any command fails, collect logs:

```bash
docker compose logs --tail=200 api worker admin operator pdf minio
journalctl -u caddy -n 200 --no-pager
```

---

## 13) Post-Cutover Hardening Checklist

- Rotate `JWT_SECRET`.
- Rotate demo user passwords or disable demo users.
- Restrict SSH and firewall to minimum required ports (`80/443` public only).
- Set regular DB + object storage backup schedule.
- Add external uptime monitoring for:
  - `/api/health`
  - `/admin/login`
  - `/lims/worklist`

---

## 14) References

- `AGENTS.md`
- `docs/ops/SMOKE_TESTS.md`
- `docker-compose.yml`
- `docs/ops/BACKUP_POSTURE.md`
- `docs/specs/LOCKED_DECISIONS.md`
