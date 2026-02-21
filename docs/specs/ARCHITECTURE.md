# Architecture (Target)

## Runtime components
1) **API** (NestJS)
2) **Worker** (BullMQ)
3) **PDF service** (.NET + QuestPDF)
4) **Operator UI** (React/Vite)
5) **Admin UI** (React/Vite)
6) Postgres + Redis
7) Caddy reverse proxy (TLS termination)

## Monorepo layout (target)
- `apps/api` — NestJS API (OpenAPI server)
- `apps/worker` — BullMQ workers (jobs: PDF render, imports, nightly jobs)
- `apps/pdf` — PDF renderer service (QuestPDF)
- `apps/operator` — Operator workflow UI (React/Vite)
- `apps/admin` — Back Office UI (React/Vite)
- `packages/contracts` — `openapi.yaml` + generator scripts
- `packages/sdk` — generated TS client (imported by both frontends)

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
