# AGENTS — Development Workflow for Vexel Health Platform Rebuild

## Mission

We are rebuilding the Vexel Health Platform from the ground up as a **multi-tenant health platform**. LIMS (Laboratory Information Management System) ships first, but the core architecture is designed to support additional modules (RIMS, OPD, etc.) without refactoring.

**This is a greenfield rebuild.** There is no legacy compatibility in v1. We build right from day one.

## Non-Negotiable Guardrails (The Law)

Every agent, developer, and contributor must respect these rules:

### 1. Contract-First OpenAPI
- `packages/contracts/openapi.yaml` is the single source of truth for all API contracts.
- Backend endpoints must implement the contract exactly.
- Frontend apps must use **generated SDK only** — no ad-hoc fetch/axios payloads.
- CI must fail if backend drifts from contract or frontend bypasses SDK.

### 2. Strict Tenant Isolation
- Every customer-owned entity has `tenantId`.
- Every uniqueness constraint is tenant-scoped (no global uniques unless truly global like system config).
- Every query must include tenant filter by default.
- Tenant context is resolved server-side (by Host in production; optional `x-tenant-id` header in dev).
- Cross-tenant reads are prohibited.

### 3. Workflow State Changes via Commands Only
- Workflow state fields (status, stage, verification state) are **never** edited directly via CRUD endpoints or Admin UI.
- All state transitions happen via dedicated Command endpoints (e.g., `POST /encounters/{id}:lab-verify`).
- Invalid transitions return `409 Conflict`.
- Every command writes an `AuditEvent`.

### 4. Deterministic Documents
- Documents are identified by: `(tenantId, encounterId, docType, templateVersion, payloadHash)`.
- Canonical payload → `payloadHash = sha256(canonical_json)`.
- Rendered bytes → `pdfHash`.
- Publishing is **idempotent and retry-safe**.
- Document status lifecycle: QUEUED → RENDERING → RENDERED or FAILED.

### 5. Feature Flags
- Backend-authoritative (frontend never decides feature availability).
- Tenant-scoped (each tenant has own feature config).
- Module + sub-feature keys (e.g., `module.lims`, `lims.auto_verify`, `module.opd`).

### 6. Auditability
- Every request has a `correlationId`.
- Every job (async worker task) has a `correlationId`.
- Audit events capture: tenantId, actorUserId, action, entityRef, before/after (where relevant).
- Admin changes and workflow commands are always audited.

### 7. No Direct DB Access from Next.js
- All Next.js apps (Admin, Operator, future portals) are **API clients only**.
- No Prisma imports in Next.js code.
- All data access goes through the NestJS API via generated SDK.

### 8. No Legacy Compatibility
- This is v1. No migration logic from old systems.
- Clean slate.

---

## How to Read the Doc Set

Documents must be read in this order to understand the rebuild correctly:

### Foundation Docs (Read First)
1. **README.md** — Project overview
2. **docs/specs/LOCKED_DECISIONS.md** — Non-negotiable architectural decisions
3. **docs/specs/ARCHITECTURE.md** — Target architecture and monorepo layout
4. **docs/specs/TENANCY.md** — Tenant isolation rules and resolution
5. **docs/specs/LIMS_WORKFLOWS.md** — Command-only workflow state machine
6. **docs/specs/DOCUMENTS_PDF.md** — Deterministic document pipeline
7. **docs/specs/ADMIN_APP_SPEC.md** — Admin App (Back Office) MVP scope
8. **docs/specs/TESTS.md** — Testing strategy (unit, integration, smoke)

### Operational Docs
9. **docs/ops/SMOKE_TESTS.md** — Smoke test checklist (run after each slice)
10. **docs/ops/BACKUP_POSTURE.md** — Backup strategy (destruction-proof from day one)

### Contract
11. **packages/contracts/openapi.yaml** — Canonical API contract

### Agent Prompts
12. **docs/prompts/CURSOR_PROMPT.md** — Structure lock + scaffold agent
13. **docs/prompts/CODEX_PROMPT.md** — Docker + migrations + seeds + smoke tests agent
14. **docs/prompts/JULES_PROMPT.md** — Systemic repair agent (only if needed)

### Meta Docs
15. **docs/specs/AGENT.md** — Agent goals (short version)
16. **docs/STRUCTURE_LOCK.md** — Locked structure summary (created after Phase 1)

---

## Admin-First Scope

### Why Admin First?
Stop "building in a vacuum." The Admin App is your **Back Office** for:
- Observing real data
- Managing configuration (tenants, users, feature flags, catalogs)
- Troubleshooting (audit logs, failed jobs)
- Safely running admin-only operations

### Admin v1 "Done" Means:
1. **Admin App UI** (Next.js) is running and accessible.
2. **Admin API endpoints** are implemented and tested.
3. **Admin pages** are scaffolded and functional:
   - `/admin/login`
   - `/admin/dashboard` (health, tenant selector, recent audit events, failed jobs count)
   - `/admin/tenants` (create/edit tenant config)
   - `/admin/users` (create user, assign roles/permissions)
   - `/admin/feature-flags` (enable/disable features per tenant)
   - `/admin/catalog` (manage tests, parameters, panels)
   - `/admin/audit` (read-only audit explorer with filters)
   - `/admin/jobs` (read-only queue/job dashboard + retry failed jobs)
4. **Docker stack boots cleanly**: Postgres, Redis, API, Worker, PDF, Admin UI.
5. **Smoke tests pass**: health checks, basic tenancy isolation, idempotency check.
6. **Seed data exists**: 1 tenant, 1 admin user, feature flags.

### Admin Non-Goals (MVP)
- No operator workflow in Admin App.
- No result entry in Admin App.
- Admin edits config only; state changes must call Command endpoints.

---

## Development Workflow (Three-Agent Model)

### Phase 1: Structure Lock (Cursor)
**Agent:** Cursor  
**Goal:** Lock structure before coding.

**Tasks:**
1. Read and internalize the doc set.
2. Create/confirm monorepo layout (apps/*, packages/*).
3. Lock core data model (Prisma schema with tenant scoping).
4. Lock API surface (OpenAPI endpoints for Admin MVP).
5. Lock Admin UI routes.
6. Lock governance enforcement points (tenant resolver, audit middleware, SDK-only enforcement).
7. Create scaffolds + placeholder handlers (no full implementations yet).
8. Produce `docs/STRUCTURE_LOCK.md` summary.

**Output:**
- Monorepo folders exist.
- Prisma schema is locked.
- OpenAPI is expanded for Admin MVP.
- SDK generation is wired.
- Admin routes are scaffolded.
- Governance middleware stubs are in place.

### Phase 2: Bring Up Stack (Codex)
**Agent:** Codex  
**Goal:** Docker up, migrations, seeds, smoke tests.

**Tasks:**
1. Build and start Docker stack (Postgres, Redis, API, Worker, PDF, Admin UI).
2. Run Prisma migrations.
3. Seed minimal data (1 tenant, 1 admin user, feature flags).
4. Validate health endpoints (API, PDF).
5. Run smoke tests (docs/ops/SMOKE_TESTS.md).
6. Create evidence artifacts in `docs/_audit/DEPLOY_RUNS/<timestamp>/`.

**Output:**
- PASS/FAIL summary.
- If FAIL: root cause + exact fixes + commit message.

### Phase 3: Systemic Repair (Jules, only if needed)
**Agent:** Jules  
**Goal:** Fix systemic issues without changing locked decisions.

**Inputs:**
- Codex failure logs.
- Current repo state.

**Tasks:**
- Fix config drift, broken Docker wiring, broken migrations, misaligned contract generation.
- Restore boot + migrations + smoke tests.

**Output:**
- A patch that makes the stack boot cleanly.
- Updated docs explaining what changed and why.

**Rules:**
- Do not change locked decisions.
- Keep contract-first discipline.
- Keep tenant isolation.
- Keep command-only workflow philosophy.

---

## Never Do (Red Lines)

1. **Never bypass the SDK in frontends** — no direct fetch/axios to API endpoints.
2. **Never access the database from Next.js** — no Prisma imports in Admin or Operator apps.
3. **Never allow cross-tenant reads** — every query must filter by tenantId.
4. **Never edit workflow state fields directly** — state changes only via Command endpoints.
5. **Never use non-deterministic document generation** — always compute payloadHash and pdfHash.
6. **Never skip audit events** — commands and admin changes are always audited.
7. **Never use global uniqueness constraints on tenant-owned data** — uniqueness is always tenant-scoped.
8. **Never add legacy compatibility logic** — this is a clean v1 rebuild.
9. **Never store secrets in code** — use environment variables and secret management.
10. **Never deploy without smoke tests passing** — each slice must pass docs/ops/SMOKE_TESTS.md.

---

## Tech Stack Summary

### Backend
- **API:** NestJS (TypeScript)
- **ORM:** Prisma
- **DB:** PostgreSQL
- **Cache/Queue:** Redis + BullMQ
- **Worker:** Separate process/container (BullMQ Worker)
- **PDF:** Separate service (.NET + QuestPDF)

### Frontend
- **Admin App:** Next.js (App Router)
- **Operator App:** Next.js (App Router)
- Both use generated SDK from OpenAPI contract.
- Both are API clients only (no direct DB access).

### Deployment
- **Local/Single-host:** Docker Compose
- **Reverse Proxy:** Caddy (TLS termination)
- Internal services bind to 127.0.0.1 only.

---

## Build Order (Locked)

1. **Admin App + Admin APIs** (Back Office first)
2. **Vertical slices end-to-end** (backend + UI + docs + smoke tests per feature)

---

## Success Criteria (Overall)

- Contract-first discipline is enforced (CI gates in place).
- Tenant isolation is structural and tested.
- Workflow state changes are command-only and audited.
- Documents are deterministic and idempotent.
- Feature flags work tenant-scoped.
- Admin App is useful for observability and config.
- Smoke tests pass after each slice.
- Docker stack boots cleanly and reliably.
- Backup posture is destruction-proof from day one.

---

**This document is the governance baseline. Read it first. Respect the guardrails. Build right.**
