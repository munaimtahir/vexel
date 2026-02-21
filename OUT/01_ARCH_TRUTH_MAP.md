# Architecture Truth Map — AS-IS

**Generated:** `find /home/munaim/srv/apps/vexel -maxdepth 4 -not -path "*/node_modules/*" -not -path "*/.next/*" -not -path "*/.git/*" | sort | head -200`

```
/home/munaim/srv/apps/vexel
/home/munaim/srv/apps/vexel/.github/workflows/ci.yml
/home/munaim/srv/apps/vexel/.gitignore
/home/munaim/srv/apps/vexel/AGENTS.md
/home/munaim/srv/apps/vexel/README.md
/home/munaim/srv/apps/vexel/apps/admin
/home/munaim/srv/apps/vexel/apps/admin/.env.example
/home/munaim/srv/apps/vexel/apps/admin/Dockerfile
/home/munaim/srv/apps/vexel/apps/admin/next.config.ts
/home/munaim/srv/apps/vexel/apps/admin/package.json
/home/munaim/srv/apps/vexel/apps/admin/src/app
/home/munaim/srv/apps/vexel/apps/admin/src/components
/home/munaim/srv/apps/vexel/apps/admin/src/lib
/home/munaim/srv/apps/vexel/apps/api
/home/munaim/srv/apps/vexel/apps/api/Dockerfile
/home/munaim/srv/apps/vexel/apps/api/dist            ← compiled output present
/home/munaim/srv/apps/vexel/apps/api/docker-entrypoint.sh
/home/munaim/srv/apps/vexel/apps/api/nest-cli.json
/home/munaim/srv/apps/vexel/apps/api/prisma/migrations
/home/munaim/srv/apps/vexel/apps/api/prisma/schema.prisma
/home/munaim/srv/apps/vexel/apps/api/prisma/seed.ts
/home/munaim/srv/apps/vexel/apps/api/src/app.module.ts
/home/munaim/srv/apps/vexel/apps/api/src/audit
/home/munaim/srv/apps/vexel/apps/api/src/auth
/home/munaim/srv/apps/vexel/apps/api/src/catalog
/home/munaim/srv/apps/vexel/apps/api/src/common
/home/munaim/srv/apps/vexel/apps/api/src/documents
/home/munaim/srv/apps/vexel/apps/api/src/encounters
/home/munaim/srv/apps/vexel/apps/api/src/feature-flags
/home/munaim/srv/apps/vexel/apps/api/src/health
/home/munaim/srv/apps/vexel/apps/api/src/jobs
/home/munaim/srv/apps/vexel/apps/api/src/main.ts
/home/munaim/srv/apps/vexel/apps/api/src/patients
/home/munaim/srv/apps/vexel/apps/api/src/prisma
/home/munaim/srv/apps/vexel/apps/api/src/rbac
/home/munaim/srv/apps/vexel/apps/api/src/roles
/home/munaim/srv/apps/vexel/apps/api/src/tenant
/home/munaim/srv/apps/vexel/apps/api/src/tenants
/home/munaim/srv/apps/vexel/apps/api/src/users
/home/munaim/srv/apps/vexel/apps/operator
/home/munaim/srv/apps/vexel/apps/operator/Dockerfile
/home/munaim/srv/apps/vexel/apps/operator/next.config.ts
/home/munaim/srv/apps/vexel/apps/operator/src/app
/home/munaim/srv/apps/vexel/apps/operator/src/components
/home/munaim/srv/apps/vexel/apps/operator/src/lib
/home/munaim/srv/apps/vexel/apps/pdf
/home/munaim/srv/apps/vexel/apps/pdf/Dockerfile
/home/munaim/srv/apps/vexel/apps/pdf/Program.cs
/home/munaim/srv/apps/vexel/apps/pdf/vexel-pdf.csproj
/home/munaim/srv/apps/vexel/apps/worker
/home/munaim/srv/apps/vexel/apps/worker/Dockerfile
/home/munaim/srv/apps/vexel/apps/worker/src/catalog-export.processor.ts
/home/munaim/srv/apps/vexel/apps/worker/src/catalog-import.processor.ts
/home/munaim/srv/apps/vexel/apps/worker/src/document-render.processor.ts
/home/munaim/srv/apps/vexel/apps/worker/src/main.ts
/home/munaim/srv/apps/vexel/apps/worker/src/prisma.ts
/home/munaim/srv/apps/vexel/docker-compose.yml
/home/munaim/srv/apps/vexel/docs/STRUCTURE_LOCK.md
/home/munaim/srv/apps/vexel/docs/_audit/PHASE6_PASS/EVIDENCE_LOG.md
/home/munaim/srv/apps/vexel/docs/_audit/PHASE6_PASS/README.md
/home/munaim/srv/apps/vexel/docs/_audit/PHASE6_PASS/STATIC_CHECKS.md
/home/munaim/srv/apps/vexel/docs/ops/BACKUP_POSTURE.md
/home/munaim/srv/apps/vexel/docs/ops/PHASE6_MANUAL_TEST.md
/home/munaim/srv/apps/vexel/docs/ops/PHASE6_PASS.md
/home/munaim/srv/apps/vexel/docs/ops/SMOKE_TESTS.md
/home/munaim/srv/apps/vexel/docs/prompts/CODEX_PROMPT.md
/home/munaim/srv/apps/vexel/docs/prompts/CURSOR_PROMPT.md
/home/munaim/srv/apps/vexel/docs/prompts/JULES_PROMPT.md
/home/munaim/srv/apps/vexel/docs/specs/ADMIN_APP_SPEC.md
/home/munaim/srv/apps/vexel/docs/specs/AGENT.md
/home/munaim/srv/apps/vexel/docs/specs/ARCHITECTURE.md
/home/munaim/srv/apps/vexel/docs/specs/AUTH.md
/home/munaim/srv/apps/vexel/docs/specs/DOCUMENTS_PDF.md
/home/munaim/srv/apps/vexel/docs/specs/LIMS_WORKFLOWS.md
/home/munaim/srv/apps/vexel/docs/specs/LOCKED_DECISIONS.md
/home/munaim/srv/apps/vexel/docs/specs/TENANCY.md
/home/munaim/srv/apps/vexel/docs/specs/TESTS.md
/home/munaim/srv/apps/vexel/package.json
/home/munaim/srv/apps/vexel/packages/contracts/openapi.yaml
/home/munaim/srv/apps/vexel/packages/contracts/package.json
/home/munaim/srv/apps/vexel/packages/contracts/scripts/generate-client.js
/home/munaim/srv/apps/vexel/packages/sdk/README.md
/home/munaim/srv/apps/vexel/packages/sdk/package.json
/home/munaim/srv/apps/vexel/packages/sdk/scripts/check-sdk-freshness.sh
/home/munaim/srv/apps/vexel/packages/sdk/src/client.ts
/home/munaim/srv/apps/vexel/packages/sdk/src/generated/api.d.ts
/home/munaim/srv/apps/vexel/packages/sdk/src/index.ts
/home/munaim/srv/apps/vexel/pnpm-workspace.yaml
/home/munaim/srv/apps/vexel/turbo.json
```

---

## App / Package Inventory

| App / Package | Type | Status |
|---|---|---|
| `apps/api` | NestJS API | ✅ WIRED — compiled dist present, 7 test suites passing |
| `apps/admin` | Next.js Admin App | ✅ WIRED — 15 pages, real SDK calls in all pages |
| `apps/operator` | Next.js Operator App | ✅ WIRED — 10 pages, real SDK calls in workflow pages |
| `apps/worker` | BullMQ Worker | ✅ WIRED — document-render, catalog-import, catalog-export processors present |
| `apps/pdf` | .NET QuestPDF Service | ✅ WIRED — `Program.cs` contains `/render` endpoint |
| `packages/contracts` | OpenAPI contract | ✅ WIRED — `openapi.yaml` (78 operationIds, 55 paths) |
| `packages/sdk` | Generated TypeScript client | ⚠️ STALE — `api.d.ts` has only 36 paths; missing document + catalog-advanced endpoints |

## Key Config Files

| File | Notes |
|---|---|
| `docker-compose.yml` | Defines all 6 services (postgres, redis, api, worker, pdf, admin, operator) |
| `apps/api/prisma/schema.prisma` | Prisma schema with tenant-scoped models |
| `apps/api/prisma/seed.ts` | Seed script (1 tenant, 1 admin user, feature flags) |
| `apps/api/src/common/correlation-id.middleware.ts` | Injects `x-correlation-id` on every request |
| `apps/api/src/tenant/tenant-resolver.middleware.spec.ts` | Tenant isolation test — PASSES |
| `packages/sdk/scripts/check-sdk-freshness.sh` | CI gate script — exists but not enforced automatically |

## What Is Wired vs Stub

| Area | Wired? | Notes |
|---|---|---|
| Auth (JWT login/refresh/logout) | ✅ | Controller + service implemented |
| Tenant management | ✅ | CRUD + config endpoints implemented |
| User management | ✅ | Create, list, patch, role assignment |
| Feature flags | ⚠️ | Controller at `/feature-flags`; OpenAPI contract path is `/tenants/{tenantId}/feature-flags` → path mismatch |
| Catalog (tests/panels) | ✅ | Full CRUD controllers |
| Catalog (parameters/reference-ranges/import-export) | ✅ in API | Controllers present; SDK types missing for these paths |
| Patients | ✅ | CRUD |
| Encounters + workflow commands | ✅ | order-lab, collect-specimen, result, verify, cancel all implemented |
| Documents pipeline | ✅ | receipt:generate, report:generate, publish, download — controllers + service + worker processor |
| Audit events | ✅ | Read endpoint + audit service used in commands |
| Jobs queue | ✅ | BullMQ via jobs controller |
| RBAC / Permissions guard | ✅ | Guard + decorator + spec pass |
