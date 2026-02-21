# STRUCTURE LOCK — Vexel Health Platform (Phase 1 Complete)

> **Status: LOCKED**
> This document is the authoritative truth map after Phase 1. Do not change locked items without operator sign-off.

---

## 1. Final Monorepo Layout

```
vexel/
├── AGENTS.md                    # AI dev workflow + guardrails
├── README.md
├── docker-compose.yml
├── apps/
│   ├── api/                     # NestJS — OpenAPI server
│   ├── worker/                  # BullMQ workers (PDF render, imports, nightly)
│   ├── pdf/                     # .NET + QuestPDF — PDF renderer service
│   ├── admin/                   # Next.js App Router — Back Office UI
│   └── operator/                # Next.js App Router — Operator workflow UI
└── packages/
    ├── contracts/
    │   └── openapi.yaml         # Single source of truth for API contracts
    └── sdk/                     # Generated TS client (imported by admin + operator)
```

---

## 2. Frontend Decision (LOCKED)

| App | Framework | Rules |
|-----|-----------|-------|
| `apps/admin` | **Next.js (App Router)** | API client only. No direct DB/Prisma. SDK only. |
| `apps/operator` | **Next.js (App Router)** | API client only. No direct DB/Prisma. SDK only. |
| Future portals | **Next.js (App Router)** | Same rules apply. |

**Override applied:** React + Vite is superseded. All frontends are Next.js. This is final.

---

## 3. Contract-First Enforcement Points (CI Gates)

| Gate | Rule |
|------|------|
| **Backend drift** | CI fails if NestJS routes drift from `packages/contracts/openapi.yaml` |
| **SDK bypass** | CI fails if any frontend imports axios/fetch to call backend endpoints directly |
| **SDK generation** | SDK must be regenerated from openapi.yaml before any frontend PR merges |
| **Schema migration** | Prisma migrations must be applied; CI runs `prisma migrate deploy` in test env |

---

## 4. Tenancy Rules Summary

| Rule | Detail |
|------|--------|
| **Tenant resolution (prod)** | Host header → tenant lookup |
| **Tenant resolution (dev)** | `x-tenant-id` header (only when explicitly enabled) |
| **Row isolation** | Every customer-owned entity has `tenantId` |
| **Unique constraints** | All uniqueness is tenant-scoped (never global, unless truly system-wide) |
| **Query enforcement** | Every service method and DB query must include tenant filter |
| **Cross-tenant reads** | Prohibited. No exceptions. |

---

## 5. Admin v1 Route Map

| Route | Page | Required endpoints |
|-------|------|--------------------|
| `/admin/login` | Login | `POST /auth/admin/login` |
| `/admin/dashboard` | Dashboard | `GET /health`, `GET /audit-events` (last 20), `GET /jobs/failed-count` |
| `/admin/tenants` | Tenant CRUD | `GET/POST /tenants`, `GET/PATCH /tenants/:id`, `GET/PATCH /tenants/:id/config` |
| `/admin/tenants/:id/feature-flags` | Tenant Feature Flags | `GET/PUT /tenants/:id/feature-flags` |
| `/admin/users` | User CRUD | `GET/POST /users`, `GET/PATCH/DELETE /users/:id` |
| `/admin/users/:id/roles` | Role Assignment | `GET/PUT /users/:id/roles` |
| `/admin/feature-flags` | Global Feature Flags | `GET /feature-flags`, `PUT /feature-flags/:key` |
| `/admin/catalog` | Catalog Admin | `GET/POST /catalog/tests`, `GET/PATCH/DELETE /catalog/tests/:id`, `GET/POST /catalog/panels` |
| `/admin/audit` | Audit Explorer | `GET /audit-events` (with filters: tenant, user, entity, action, correlationId) |
| `/admin/jobs` | Jobs & Failures | `GET /jobs`, `GET /jobs/failed`, `POST /jobs/:id:retry` |

---

## 6. Document Pipeline Summary

```
API receives request
  → validates payload
  → computes payloadHash = sha256(canonical_json(payload))
  → creates Document record (status: QUEUED)
    identity: (tenantId, encounterId, docType, templateVersion, payloadHash) — UNIQUE
  → enqueues render job (correlationId attached)

Worker picks up job
  → calls PDF service with payload
  → receives rendered bytes
  → computes pdfHash = sha256(bytes)
  → stores bytes to storage backend
  → updates Document: status RENDERED, pdfHash, storageRef

On failure
  → Document status: FAILED
  → job moves to failed queue (retryable)

Idempotency
  → if Document with same identity exists and status = RENDERED → return existing
  → if status = QUEUED/RENDERING → return 202 (in progress)
  → if status = FAILED → allow re-queue
```

---

## 7. Phase 2 TODO Checklist

### Scaffold
- [ ] Initialise `apps/api` — NestJS with Prisma, BullMQ, OpenAPI plugin
- [ ] Initialise `apps/worker` — BullMQ worker process
- [ ] Initialise `apps/pdf` — .NET QuestPDF service with render endpoint
- [ ] Initialise `apps/admin` — Next.js App Router app
- [ ] Initialise `apps/operator` — Next.js App Router app
- [ ] Initialise `packages/sdk` — OpenAPI generator script (openapi-generator or orval)
- [ ] Configure pnpm/turborepo workspace (`pnpm-workspace.yaml`, `turbo.json`)

### OpenAPI Expansion
- [ ] Add all Admin MVP endpoints to `packages/contracts/openapi.yaml`
- [ ] Add auth endpoints (`POST /auth/admin/login`, token refresh)
- [ ] Add tenant CRUD + config endpoints
- [ ] Add user CRUD + role assignment endpoints
- [ ] Add feature-flag endpoints
- [ ] Add catalog CRUD endpoints
- [ ] Add audit-events endpoint (with filter params)
- [ ] Add jobs/failed-jobs + retry endpoint
- [ ] Add health endpoints (api, worker, pdf)

### Prisma Schema
- [ ] Define `Tenant` model (id, name, domains[], status, createdAt)
- [ ] Define `User` model (id, tenantId, email, passwordHash, roles)
- [ ] Define `Role` / `Permission` models
- [ ] Define `TenantFeature` model (tenantId, key, enabled)
- [ ] Define `Patient` model (tenantId, mrn, name, dob, …)
- [ ] Define `Encounter` model (tenantId, patientId, moduleType, status)
- [ ] Define `LabOrder` + `LabOrderItem` models
- [ ] Define `Specimen` model
- [ ] Define `Result` + `Verification` models
- [ ] Define `Document` model (with payloadHash, pdfHash, status, storageRef)
- [ ] Define `AuditEvent` model (tenantId, actorId, action, entityRef, correlationId, before, after)
- [ ] Write initial migration + seed (system tenant + super-admin user)

### SDK Generation
- [ ] Add codegen script to `packages/contracts/package.json`
- [ ] Confirm generated client lands in `packages/sdk/src/`
- [ ] Import SDK in `apps/admin` and verify types resolve

### Admin Shell
- [ ] Scaffold admin layout (sidebar, auth guard, tenant context)
- [ ] Wire `/admin/login` → `POST /auth/admin/login` via SDK
- [ ] Wire `/admin/dashboard` → health + audit summary via SDK
- [ ] Verify no direct fetch/axios calls exist in admin app

### Docker Boot
- [ ] `docker-compose.yml` includes: api, worker, pdf, admin, operator, postgres, redis, caddy
- [ ] All internal services bind to `127.0.0.1`
- [ ] Caddy routes: `/api/*` → api, `/admin/*` → admin, `/` → operator
- [ ] `docker compose up` results in a running stack with no errors

### Smoke Tests
- [ ] `GET /health` returns 200
- [ ] Super-admin login returns JWT
- [ ] Create tenant → verify in DB
- [ ] Create user in tenant → verify tenant isolation
- [ ] Enable feature flag for tenant → verify
- [ ] Audit events written for admin actions
- [ ] All tests in `docs/ops/SMOKE_TESTS.md` pass
