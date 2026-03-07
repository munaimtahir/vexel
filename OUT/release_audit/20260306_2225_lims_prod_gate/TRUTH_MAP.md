# TRUTH MAP — LIMS Production Gate Audit

## Repository Structure
| Item | Present | Condition |
|------|---------|-----------|
| `apps/api` | ✅ | Full NestJS app, 24 modules |
| `apps/worker` | ✅ | BullMQ worker with 4 processors |
| `apps/pdf` | ✅ | .NET QuestPDF service |
| `apps/admin` | ✅ | Next.js App Router, 35+ pages |
| `apps/operator` | ✅ | Next.js App Router, 40+ pages |
| `apps/e2e` | ✅ | Playwright with 14 spec files |
| `packages/contracts/openapi.yaml` | ✅ | 9458 lines, canonical |
| `packages/sdk` | ✅ | Generated from openapi.yaml, fresh |
| `packages/theme` | ✅ | Shared theme tokens |
| `packages/ui-system` | ✅ | Shared UI components |
| `docker-compose.yml` | ✅ | 7 services configured |
| `.github/workflows/ci.yml` | ✅ | 5 CI jobs |
| `apps/api/prisma/schema.prisma` | ✅ | Full schema, 50+ models |
| Migrations | ✅ | 20 migration files |
| `apps/api/prisma/seed.ts` | ✅ | Seeds tenant + admin + feature flags |
| `docs/ops/SMOKE_TESTS.md` | ✅ | Documented smoke tests |
| `docs/specs/LIMS_WORKFLOWS.md` | ✅ | Command workflow documented |

## What Exists and is Working

| Feature | Status | Evidence |
|---------|--------|----------|
| Auth (login/refresh/logout) | ✅ Working | Live curl confirmed |
| Patient registration | ✅ Working | Live data in DB |
| Encounter creation (register) | ✅ Working | Live encounters present |
| Lab ordering | ✅ Working | Encounters in lab_ordered state |
| Specimen collection/receipt | ✅ Working | SpecimenItem model + service |
| Result entry | ✅ Working | LabResult model + service |
| Verification | ✅ Working | Verification service, 409s enforced |
| Report publish | ✅ Working | Documents in PUBLISHED state |
| Document idempotency | ✅ Working | Duplicate publish returns same doc |
| Catalog management | ✅ Working | Tests/Params/Panels/Panels CRUD |
| Feature flags (tenant-scoped) | ✅ Working | `module.lims` checked per tenant |
| RBAC (permissions) | ✅ Working | 29 permissions, role-based |
| Audit trail | ✅ Working | 139 audit.log call-sites |
| PDF generation | ✅ Working | QuestPDF service healthy |
| MinIO storage | ✅ Working | Bucket created, documents uploaded |

## What is Partially Implemented / Stubbed

| Feature | Status | Details |
|---------|--------|---------|
| `/api/health/worker` | ❌ STUB | Always returns ok, has `// TODO` |
| `/api/health/pdf` | ❌ STUB | Always returns ok, has `// TODO` |
| Ops backup execution | ⚠️ PARTIAL | Tables + BullMQ processor exist; shell scripts in `ops/` not verified |
| Worker healthcheck in docker-compose | ⚠️ MISSING | Worker has no healthcheck defined |
| Admin/operator docker healthcheck | ⚠️ DISABLED | `healthcheck: disable: true` |

## What is Missing for Strict Production Readiness

| Item | Severity |
|------|----------|
| Strong JWT secret set in `.env` | Critical |
| `NODE_ENV=production` for API service | Critical |
| Real worker/PDF health probes | Major |
| Postgres and MinIO strong passwords | Major |
| `VEXEL_ROOT` env var for worker | Major |
| E2E tests runnable in CI environment | Major (infra) |
| Multi-tenant live isolation smoke test | Minor |

## TODO/FIXME/Stub Search Results

| Location | Issue |
|----------|-------|
| `apps/api/src/health/health.controller.ts:21` | `// TODO: check Redis/BullMQ connectivity` |
| `apps/api/src/health/health.controller.ts:28` | `// TODO: proxy to PDF service` |
| `apps/operator/src/lib/api-client.ts:7` | Fallback `?? 'http://localhost:9021'` (acceptable; env var set at build time) |
| `apps/admin/src/lib/api-client.ts:9` | Fallback `?? 'http://localhost:9021'` (acceptable; env var set at build time) |
| `apps/api/src/auth/auth.module.ts:14` | Fallback `?? 'vexel-dev-secret-change-in-production'` ❌ |
| `apps/api/src/auth/jwt.strategy.ts:13` | Fallback `?? 'vexel-dev-secret-change-in-production'` ❌ |
| `apps/api/src/storage/storage.service.ts:19,74` | Fallback `?? 'vexel_secret_2026'` ❌ |
| `apps/worker/src/main.ts:17` | Fallback `?? 'vexel_secret_2026'` ❌ |
| `apps/worker/src/ops-backup.processor.ts:23` | Fallback `?? '/home/munaim/srv/apps/vexel'` ❌ |
