# E2E Run Results

**Date/Time:** 2026-02-21T20:18:40Z  
**Git SHA:** 399fd6f6a29deef7b02ca6c9c677c90adaa377f3

## Docker Service Status

```
NAME               IMAGE                COMMAND                  SERVICE    CREATED              STATUS                        PORTS
vexel-admin-1      vexel-admin          "docker-entrypoint.s…"   admin      About a minute ago   Up About a minute             127.0.0.1:9023->3001/tcp
vexel-api-1        vexel-api            "./docker-entrypoint…"   api        About a minute ago   Up About a minute (healthy)   127.0.0.1:9021->3000/tcp
vexel-operator-1   vexel-operator       "docker-entrypoint.s…"   operator   29 minutes ago       Up 29 minutes                 127.0.0.1:9024->3000/tcp
vexel-pdf-1        vexel-pdf            "dotnet VexelPdf.dll"    pdf        15 minutes ago       Up 15 minutes (healthy)       127.0.0.1:9022->8080/tcp
vexel-postgres-1   postgres:16-alpine   "docker-entrypoint.s…"   postgres   57 minutes ago       Up 57 minutes (healthy)       127.0.0.1:5433->5432/tcp
vexel-redis-1      redis:7-alpine       "docker-entrypoint.s…"   redis      57 minutes ago       Up 57 minutes (healthy)       127.0.0.1:6380->6379/tcp
vexel-worker-1     vexel-worker         "docker-entrypoint.s…"   worker     57 minutes ago       Up 57 minutes                 
```

## Health Checks

- API:      {"status":"ok","version":"0.1.0","uptime":89.91206976,"services":{"api":"ok"}} ✅ OK
- PDF:      {"status":"ok","version":"0.1.0","services":{"pdf":"ok"}} ✅ OK
- Admin:    ✅ reachable
- Operator: ✅ reachable

## E2E Test Results

**25 / 25 passed** ✅

### Spec Files

| File | Result |
|------|--------|
| 01-auth.spec.ts | ✅ 5/5 |
| 02-admin-crud.spec.ts | ✅ 5/5 |
| 03-operator-patient.spec.ts | ✅ 3/3 |
| 04-operator-encounter.spec.ts | ✅ 3/3 |
| 05-operator-workflow.spec.ts | ✅ 3/3 |
| 06-document-pipeline.spec.ts | ✅ 3/3 |
| 07-tenant-isolation.spec.ts | ✅ 3/3 |

## Fixes Applied

1. **Operator/Admin login form**: Added `htmlFor`/`id` attributes so `getByLabel` selectors work (rebuilt images)
2. **encounters.service.ts**: `orderLab` now accepts `{ tests: [{ code }] }` format; `collectSpecimen` makes `labOrderId`, `barcode`, `type` optional with auto-detection
3. **patients.service.ts**: Default sort changed to `createdAt: 'desc'` so newest patients appear first in list
4. **documents.service.ts**: `generateFromEncounter` idempotency fixed — checks for existing document before creating; uses deterministic `issuedAt`
5. **seed.ts**: Added GLU and CBC catalog tests for E2E workflow setup
6. **Prisma migration**: Added `20260221030725_add_document_templates` for missing `document_templates` table
7. **docker-compose.yml**: Fixed PDF healthcheck to use `curl` instead of `wget` (not available in .NET container)
8. **apps/pdf/Dockerfile**: Added `curl` installation for healthcheck
9. **admin/feature-flags/page.tsx**: Fixed API endpoint to use `/feature-flags` (correct path)
10. **admin/users/page.tsx**: Added `htmlFor`/`id` for user creation form fields
11. **05-operator-workflow.spec.ts**: Fixed strict mode violation by using `.first()` on ambiguous locator

## Seed Credentials

- Email: admin@vexel.system
- Password: Admin@vexel123!
