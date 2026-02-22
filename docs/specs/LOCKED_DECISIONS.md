# Locked Decisions (Final)

## A) Product mission (locked)
1) We are building a **Health Platform**, not only a LIMS.
2) **LIMS ships first**, but core modules are shared for later modules (RIMS/OPD/etc.).
3) Must work in:
   - Standalone LIMS mode, and
   - Suite mode (LIMS + future modules), without refactor.

## B) Architecture doctrine (locked non‑negotiables)
1) **Contract-first OpenAPI** is the single source of truth.
2) **Generated SDK only** in frontend apps (no ad-hoc axios/fetch payloads).
3) **Tenant isolation is structural**:
   - `tenantId` on every customer-owned row
   - tenant-scoped unique constraints
   - request-scoped tenant context enforced server-side
4) **Workflow state changes only via Commands**:
   - no direct DB status updates from CRUD routes or Admin UI
5) **Deterministic documents**:
   - canonical payload -> `payloadHash`
   - rendered bytes -> `pdfHash`
   - publish is idempotent and retry-safe
6) **Feature flags**:
   - backend-authoritative
   - tenant-scoped
   - module + sub-feature keys
7) **Auditability**:
   - correlationId per request/job
   - audit events for workflow commands + admin changes
8) **No legacy compatibility** in v1.

## C) Tech stack (locked default)
Backend:
- API: **NestJS (TypeScript)**
- ORM: **Prisma**
- DB: **PostgreSQL**
- Cache/Queue: **Redis + BullMQ**
- Worker: **separate process/container** (BullMQ Worker)
- PDF: **separate service** (**.NET + QuestPDF**)

Frontend:
- Operator App: **Next.js (App Router)**
- Admin App: **Next.js (App Router)** (separate app)
- Both must use generated SDK from the OpenAPI contract.
- Next.js apps are API clients only (NO direct DB/Prisma usage).

Deployment:
- Docker Compose for single-host
- Reverse proxy: **Caddy**
- Internal services bind to **127.0.0.1** only

## D) Development Workflow (locked)

All new features follow this sequence:

1. **Feature + Workflow lock** — Define the feature scope, user flows, and state machine changes. No code until this is locked.
2. **OpenAPI lock + SDK regen** — Add/update all required endpoints and schemas in `packages/contracts/openapi.yaml`. Regenerate SDK. All frontends use only the generated SDK — never raw fetch/axios.
3. **Frontend implementation in Mock Mode** — Build UI pages against deterministic mocks (Prism + scenario gateway). `NEXT_PUBLIC_API_URL` points to mock gateway (port 9031). Pages are complete and tested before backend is finished.
4. **Backend implementation** — Implement backend endpoints to match the locked OpenAPI contract exactly. Must pass contract compliance check.
5. **Full-stack verification** — Run smoke tests in real mode. All gates in the MVP Release Gate Matrix must pass before any release.
