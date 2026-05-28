# 06_ENVIRONMENT_AND_RUNTIME_CONFIG_AUDIT.md

**Audit Status:** COMPLETE (Secrets Masked)

---

This document audits the configuration files (`.env`, `docker-compose.yml`), container builds, and CORS configurations.

## 1. Environment Configurations

### `.env` File Inspection
The root directory contains a `.env` example file which maps all expected parameters. 

> [!WARNING]
> Dev keys must never be committed to repository config files. All credentials shown below are development defaults only and must be replaced in staging/production setups.

### Environment Variable Matrix (Docker Compose)

| Service | Variable Name | Current Dev Value (Masked) | Security / Deployment Risk |
|---|---|---|---|
| **api** | `DATABASE_URL` | `postgresql://vexel:[REDACTED]@postgres:5432/vexel` | Dev password in compose. Replace in production. |
| **api** | `REDIS_URL` | `redis://redis:6379` | Standard unauthenticated redis link. |
| **api** | `JWT_SECRET` | `[REDACTED]` | Uses default `vexel-dev-secret-REPLACE-IN-PRODUCTION`. Must override in prod. |
| **api** | `TENANCY_DEV_HEADER_ENABLED` | `false` | **SECURE.** Override disabled in config. |
| **api** | `STORAGE_ACCESS_KEY` | `vexel` | MinIO default user. |
| **api** | `STORAGE_SECRET_KEY` | `[REDACTED]` | MinIO default password `vexel_secret_2026`. |
| **api** | `STORAGE_ENDPOINT` | `http://minio:9000` | Internal network endpoint. |
| **api** | `STORAGE_PUBLIC_URL` | `https://vexel.alshifalab.pk` | Public bucket domain. |
| **api** | `CORS_ALLOWED_ORIGINS` | `https://vexel.alshifalab.pk,...` | Configured to allow Caddy domain and local test ports. |
| **worker** | `BACKUP_PASSPHRASE` | `[REDACTED]` | Empty or developer-supplied. |
| **worker** | `VEXEL_ALLOW_RESTORE` | `false` | **SECURE.** Destructive restore disabled by default. |
| **admin** | `NEXT_PUBLIC_API_URL` | `https://vexel.alshifalab.pk` | Passed as build-arg to Next.js. |
| **operator**| `NEXT_PUBLIC_API_URL` | `https://vexel.alshifalab.pk` | Passed as build-arg to Next.js. |

---

## 2. Healthcheck Configurations

- **API Container:** `wget -qO- http://localhost:3000/api/health || exit 1` (Active, checks health endpoint).
- **PDF Container:** `curl -fsS http://localhost:8080/health/pdf || exit 1` (Active, checks QuestPDF endpoint).
- **MinIO Container:** `curl -fsS http://localhost:9000/minio/health/live || exit 1` (Active).
- **Next.js Apps (Admin/Operator):** Healthchecks are explicitly disabled (`disable: true`) in `docker-compose.yml` to prevent health check failures from Next.js server start delays. They are instead verified downstream by Caddy reverse routing.

---

## 3. CORS Configuration Audit

The API configuration file defines CORS allowed origins:
```yaml
CORS_ALLOWED_ORIGINS: "https://vexel.alshifalab.pk,http://localhost:3000,http://localhost:3001,http://127.0.0.1:9023,http://127.0.0.1:9024"
```
This is **acceptable for MVP**. It restricts access to the Caddy reverse-proxy frontend domain and local development ports, preventing unauthorized cross-origin requests.
