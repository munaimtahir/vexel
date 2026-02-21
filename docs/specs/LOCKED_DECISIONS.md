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
- Operator App: **React + Vite**
- Admin App: **React + Vite** (separate app)
- Both must use generated SDK from the OpenAPI contract.

Deployment:
- Docker Compose for single-host
- Reverse proxy: **Caddy**
- Internal services bind to **127.0.0.1** only

## D) Build order (locked)
1) Build **Admin App** first (Back Office) + Admin APIs.
2) Then build vertical slices end-to-end: backend + UI + docs + smoke tests.
