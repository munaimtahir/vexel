# Security & Config Audit — LIMS Production Gate

## JWT Secret

| Item | Value | Status |
|------|-------|--------|
| `.env` JWT_SECRET | `ci-test-jwt-secret-not-for-production-use-only` | ❌ CRITICAL |
| Container runtime `JWT_SECRET` | `ci-test-jwt-secret-not-for-production-use-only` | ❌ CRITICAL |
| Fallback in `auth.module.ts` | `'vexel-dev-secret-change-in-production'` | ❌ MAJOR |
| Fallback in `jwt.strategy.ts` | `'vexel-dev-secret-change-in-production'` | ❌ MAJOR |

**Action required:** Generate strong 64-byte hex secret and set in `.env`; restart API.

## Storage Credentials

| Item | Value | Status |
|------|-------|--------|
| `STORAGE_SECRET_KEY` in docker-compose | `vexel_secret_2026` (hardcoded) | ❌ MAJOR |
| Fallback in `storage.service.ts` | `'vexel_secret_2026'` | ❌ MAJOR |
| Fallback in `worker/main.ts` | `'vexel_secret_2026'` | ❌ MAJOR |
| `MINIO_ROOT_PASSWORD` in docker-compose | `vexel_secret_2026` | ❌ MAJOR |

## Database Credentials

| Item | Value | Status |
|------|-------|--------|
| `POSTGRES_PASSWORD` | `vexel` | ❌ MAJOR |
| `DATABASE_URL` in docker-compose | `postgresql://vexel:vexel@postgres:5432/vexel` | ❌ MAJOR |

## NODE_ENV

| Service | NODE_ENV | Status |
|---------|----------|--------|
| API | `development` | ❌ CRITICAL — Swagger exposed |
| Worker | `development` | ⚠️ MINOR — no UI impact |
| Admin | `production` | ✅ |
| Operator | `production` | ✅ |

## CORS

- Allowed origins: configured via `CORS_ALLOWED_ORIGINS` env var
- Default fallback: `'http://localhost:3000,http://localhost:3001'`
- Production `docker-compose.yml` sets: `https://vexel.alshifalab.pk,http://localhost:3000,http://localhost:3001,http://127.0.0.1:9023,http://127.0.0.1:9024`
- **Note:** Includes `127.0.0.1` dev addresses in production CORS policy — not critical but should be cleaned up.

## TENANCY_DEV_HEADER_ENABLED

- Default: `false` in docker-compose.yml
- Confirmed `false` in running API container
- **Result: ✅ PASS**

## Refresh Token Security

- Tokens stored hashed (bcrypt round 10)
- Token rotation on each refresh
- Revocation on logout (`updateMany` sets `revokedAt`)
- **Result: ✅ PASS**

## Swagger / API Docs Exposure

- Exposed at `https://vexel.alshifalab.pk/api/docs` (confirmed HTTP 200)
- Guard exists (`if NODE_ENV !== 'production'`) but `NODE_ENV=development` in container defeats it
- **Result: ❌ CRITICAL — must fix NODE_ENV first**

## Hardcoded Server Path

- `VEXEL_ROOT ?? '/home/munaim/srv/apps/vexel'` in ops-backup.processor.ts
- Not set in docker-compose worker environment
- **Result: ❌ MAJOR — backup jobs will use wrong paths on any other server**

## .gitignore

- `.env` is listed in `.gitignore` — ✅ correct, the live `.env` is not committed
- `.env.example` in repo has `REPLACE_WITH_64_BYTE_HEX_SECRET` — ✅ correct placeholder

## TLS

- Caddy handles TLS termination at reverse proxy level
- Internal services bind to `127.0.0.1` only — ✅ correct
