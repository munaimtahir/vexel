# Architecture (Target)

## Runtime components
1) **API** (NestJS)
2) **Worker** (BullMQ)
3) **PDF service** (.NET + QuestPDF)
4) **Operator UI** (Next.js App Router)
5) **Admin UI** (Next.js App Router)
6) Postgres + Redis
7) Caddy reverse proxy (TLS termination)

## Monorepo layout (target)
- `apps/api` — NestJS API (OpenAPI server)
- `apps/worker` — BullMQ workers (jobs: PDF render, imports, nightly jobs)
- `apps/pdf` — PDF renderer service (QuestPDF)
- `apps/operator` — Operator workflow UI (Next.js App Router)
- `apps/admin` — Back Office UI (Next.js App Router)
- `packages/contracts` — `openapi.yaml` + generator scripts
- `packages/sdk` — generated TS client (imported by both frontends)

## Frontend rules (locked)
- All Next.js apps are API clients only (NO direct DB/Prisma usage).
- All API calls MUST use generated SDK from canonical OpenAPI.
- No ad-hoc fetch/axios payloads to backend endpoints.

## Contract-first enforcement
- `packages/contracts/openapi.yaml` is canonical.
- CI must fail if:
  - backend routes drift from contract, or
  - frontend calls non-SDK endpoints.

## Tenancy
- Tenant is resolved by **Host** in production.
- DEV can use `x-tenant-id` only if explicitly enabled.
- Tenant context is enforced in every service method + DB query.

## Documents
- Document records are immutable by identity:
  - (tenantId, encounterId, docType, templateVersion, payloadHash) unique
- Rendering is async:
  - API enqueues render job
  - Worker calls PDF service
  - Worker stores bytes and updates Document status
