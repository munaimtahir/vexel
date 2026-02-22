# AGENTS — Development Workflow for Vexel Health Platform Rebuild

---

## ⚡ SESSION HANDOFF — READ THIS FIRST (updated 2026-02-22)

### Current State: Phases 2–7 COMPLETE. Application is LIVE.

**Live URL:** https://vexel.alshifalab.pk  
**Repo:** `git@github.com:munaimtahir/vexel.git` (SSH auth)  
**HEAD commit:** `2729139` on `main`  
**Server:** `/home/munaim/srv/apps/vexel/`

#### Credentials (test)
| User | Email | Password | Role |
|------|-------|----------|------|
| Super Admin | `admin@vexel.pk` | `admin123` | super-admin (all 29 permissions) |
| System Admin | `admin@vexel.system` | `Admin@vexel123!` | super-admin |

#### Live endpoints verified ✅
- `https://vexel.alshifalab.pk/` → Operator app (307 → /encounters)
- `https://vexel.alshifalab.pk/admin/login` → Admin app (200)
- `https://vexel.alshifalab.pk/api/health` → `{"status":"ok"}`
- `https://vexel.alshifalab.pk/api/auth/login` → JWT token on valid credentials

#### Stack (Docker Compose — all 8 services healthy)
| Service | Port | Image |
|---------|------|-------|
| postgres | 127.0.0.1:5433 | postgres:16-alpine |
| redis | 127.0.0.1:6380 | redis:7-alpine |
| api (NestJS) | 127.0.0.1:9021 | vexel-api |
| pdf (.NET QuestPDF) | 127.0.0.1:9022 | vexel-pdf |
| admin (Next.js) | 127.0.0.1:9023 | vexel-admin |
| operator (Next.js) | 127.0.0.1:9024 | vexel-operator |
| minio | 127.0.0.1:9025 (console) | minio/minio |
| worker (BullMQ) | internal | vexel-worker |

**To restart stack after VPS reboot:** `cd /home/munaim/srv/apps/vexel && docker compose up -d`

#### Caddy routing (`/home/munaim/srv/proxy/caddy/Caddyfile`)
- `/api/*` → preserve prefix → 9021
- `/pdf/*` → strip prefix (handle_path) → 9022
- `/admin/*` → preserve prefix → 9023 (Next.js has `basePath: '/admin'`)
- catch-all `handle` → 9024 (Operator)

#### Key architectural decisions locked
- `NEXT_PUBLIC_API_URL` must be set as **build arg** (not runtime env) — baked into JS at build time
- Admin app requires `basePath: '/admin'` in `apps/admin/next.config.ts`
- Worker has its own PrismaClient (not an API client) — reads `DATABASE_URL` directly
- API uses `app.setGlobalPrefix('api')` → all routes at `/api/*`
- MinIO uses `forcePathStyle: true` for S3 client compatibility
- Seed runs via `ts-node --transpile-only --skip-project prisma/seed.ts` (avoid tsconfig conflict)

#### Known gotchas / bugs fixed
- `GET /api/documents?limit=N` — limit arrives as string; must cast `Number(filters.limit)` ✅ fixed `2729139`
- Admin 404 on `/admin/login` — was missing `basePath: '/admin'` ✅ fixed `ddf7f81`
- Operator calling `127.0.0.1:9021` in browser — NEXT_PUBLIC_API_URL was wrong build arg ✅ fixed `ddf7f81`
- Worker Dockerfile needs root build context (`.`) to access `apps/api/prisma/schema.prisma`
- API seed: `nest build` does NOT compile `prisma/seed.ts`; use ts-node directly

#### Phases completed
| Phase | What was built |
|-------|---------------|
| 2 | Monorepo scaffold, OpenAPI 78 ops, Docker Compose, SDK generation |
| 3 | Real auth (bcrypt+JWT+refresh), 29-permission RBAC, tenant resolver, audit service |
| 4 | LIMS Prisma models, 6-command state machine, Catalog CRUD, BullMQ workers |
| 5 | Deterministic doc pipeline (payloadHash=sha256(canonical_json)), DocumentTemplate |
| 6 | Operator UI (5 pages), 36 integration tests, CI gates, Phase 6 PASS audit |
| 7 | MinIO storage, QuestPDF real template, auto-publish on verify, 25/25 E2E pass |
| Deploy | Caddy routing, port assignment, seed super-admin, `basePath` fix, `limit` cast fix |

#### Remaining / future work
- No blocking gaps. All 72 planned todos are done.
- Potential next phase items:
  - Full Playwright CI run (currently `if: false` — needs persistent env)
  - Admin branding UI (TenantConfig fields exist, page scaffold exists, needs wiring)
  - MinIO console Caddy route (port 9025, optional)
  - Multi-order encounters (currently one order per encounter)
  - Real logo rendering in QuestPDF (field exists, image loading not wired)
  - RIMS / OPD modules (architecture ready, no features built)

---

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

## UX + Contract First Scope

### Why UX + Contract First?
Build against a deterministic contract before the backend is complete. This eliminates "building in a vacuum" and ensures the frontend is verifiable independently.

### The 5-Step Workflow
1. **Feature + Workflow lock** — Define scope, flows, and state machine. Document in `docs/specs/`.
2. **OpenAPI lock + SDK regen** — Contract is canonical. All endpoints defined first. SDK regenerated. Frontends use only `@vexel/sdk`.
3. **Frontend in Mock Mode** — UI built against Prism mock + scenario gateway. `NEXT_PUBLIC_API_URL=http://127.0.0.1:9031`. Deterministic scenarios for happy path + errors.
4. **Backend implementation** — Implements the locked contract exactly. No contract changes without going back to step 2.
5. **Full-stack verification** — Smoke tests pass in real mode. Release gate matrix all PASS.

### What Mock Mode Gives You
- Frontend development decoupled from backend schedule
- Deterministic error scenario testing (409 transitions, 403 permissions, 422 validation)
- CI can run UI tests without a real backend
- `pnpm dev:ui-mock` starts admin+operator against the mock gateway

### Non-Goals (MVP)
- No operator workflow in Admin App (Admin edits config only)
- No result entry in Admin App
- State changes must call Command endpoints — never direct CRUD

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

## Build Order (locked)

1. **Auth unification** — One identity system, one auth issuer, shared session across all apps
2. **OpenAPI + SDK baseline** — All contract gaps fixed, single SDK regen pass
3. **Catalog domain** — Parameters/Tests/Panels with mappings, import/export, Admin UI
4. **Operator workflow UI** — Full 7-page workflow built in mock mode first, then wired to real backend
5. **Full-stack verification** — MVP Release Gate Audit passes all blocking gates

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
