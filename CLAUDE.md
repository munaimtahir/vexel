# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vexel is a multi-tenant healthcare platform, built contract-first. LIMS (Laboratory Information Management System) is
the first module; the architecture is meant to support future modules (OPD, RIMS, billing) without refactoring.

This is a pnpm/turborepo monorepo:
- `apps/api` — NestJS backend (business logic, OpenAPI server, global prefix `/api`)
- `apps/worker` — BullMQ worker (async jobs: PDF rendering, imports, scheduled tasks). Has its own `PrismaClient`, reads `DATABASE_URL` directly — it is not an API client.
- `apps/pdf` — .NET + QuestPDF service for document rendering
- `apps/admin` — Next.js back-office app (config/observability only), `basePath: '/admin'`
- `apps/operator` — Next.js LIMS workflow app (patient registration, sample collection, results, verification), all routes under `/lims/*`
- `apps/e2e` — Playwright E2E suite covering both frontend apps
- `apps/mobile` — excluded from most root scripts (`--filter=!@vexel/mobile`)
- `packages/contracts` — `openapi.yaml` (the API contract) + SDK generation scripts
- `packages/sdk` — generated TypeScript client (`@vexel/sdk`), the *only* way frontends talk to the API
- `packages/theme`, `packages/ui-system` — shared styling/components

Infra: PostgreSQL, Redis (+BullMQ), MinIO (S3-compatible storage, `forcePathStyle: true`), Caddy reverse proxy.

## Commands

Root (turborepo, run from repo root):
```
pnpm install --frozen-lockfile        # install deps (CI-safe)
pnpm dev                              # start all apps except mobile
pnpm build                            # build all apps/packages
pnpm lint                             # lint across the monorepo
pnpm sdk:generate                     # regenerate @vexel/sdk from openapi.yaml — run after ANY contract change
pnpm dev:ui-mock                      # admin+operator against Prism mock gateway (NEXT_PUBLIC_API_URL=http://127.0.0.1:9031)
pnpm dev:full                         # full stack via docker compose
pnpm mock:api                         # docker compose --profile mock up mock-api mock-gateway
pnpm mock:smoke                       # scripts/mock-smoke.js
pnpm ui:color-lint                    # scripts/ui-color-lint.mjs — fails on hard-coded hex colors
pnpm check:admin-openapi-parity       # scripts/check-admin-openapi-parity.js
pnpm mcp:playwright:install-browsers  # one-time Playwright browser setup
```

API (`apps/api`):
```
pnpm --filter @vexel/api test                 # jest unit/integration tests
pnpm --filter @vexel/api test -- -t "<name>"   # run a single test by name
pnpm --filter @vexel/api test:watch
pnpm --filter @vexel/api test:cov
pnpm --filter @vexel/api prisma:dev            # create/apply a dev migration
pnpm --filter @vexel/api prisma:migrate        # deploy migrations (prod-style)
pnpm --filter @vexel/api prisma:seed           # ts-node --transpile-only --skip-project prisma/seed.ts
```

E2E (`apps/e2e`, Playwright):
```
pnpm --filter @vexel/e2e test               # operator + admin projects, excludes @nightly
pnpm --filter @vexel/e2e e2e:smoke          # --grep='@smoke'
pnpm --filter @vexel/e2e e2e:lims           # operator, --grep='@lims'
pnpm --filter @vexel/e2e e2e:admin          # admin project only
pnpm --filter @vexel/e2e e2e:tenancy        # --grep='@tenancy'
pnpm --filter @vexel/e2e e2e:security       # --grep='@security'
pnpm --filter @vexel/e2e test:ui            # interactive Playwright UI
pnpm --filter @vexel/e2e e2e:debug          # PWDEBUG=1, headed, operator only
pnpm --filter @vexel/e2e test:public        # runs against https://vexel.alshifalab.pk
```

Per-app frontend checks — run before considering a UI change done:
```
npx tsc --noEmit   # in apps/admin and apps/operator
npx next lint       # in apps/admin and apps/operator
```

## Non-Negotiable Architectural Rules

These are treated as hard governance, not style preferences — violating them is expected to fail CI or review:

1. **Contract-first**: `packages/contracts/openapi.yaml` is the single source of truth for the API. Backend endpoints implement it exactly; run `pnpm sdk:generate` after any change to it.
2. **SDK-only frontends**: `apps/admin` and `apps/operator` may only call the API through `@vexel/sdk`. No `fetch(` or `axios` to the API in frontend source — this is lint-enforced.
3. **No DB access from Next.js**: no Prisma imports in `apps/admin` or `apps/operator`. Frontends are API clients only.
4. **Strict tenant isolation**: every tenant-owned entity has `tenantId`; every query filters by it; every uniqueness constraint is tenant-scoped (no global uniques except true system config). Tenant context resolves server-side (Host header in prod, optional `x-tenant-id` in dev). Cross-tenant reads are prohibited.
5. **Command-only workflow state**: fields like encounter status/stage/verification state are never edited via generic CRUD or Admin UI — only via dedicated command endpoints (e.g. `POST /encounters/{id}:lab-verify`). Invalid transitions return `409`. Every command writes an `AuditEvent`.
6. **Deterministic documents**: documents are keyed by `(tenantId, encounterId, docType, templateVersion, payloadHash)`, where `payloadHash = sha256(canonical_json)` and rendered bytes produce a `pdfHash`. Publishing is idempotent/retry-safe. Status lifecycle: `QUEUED → RENDERING → RENDERED | FAILED`.
7. **Backend-authoritative feature flags**: tenant-scoped, module + sub-feature keyed (e.g. `module.lims`, `lims.auto_verify`). Frontend never decides availability itself.
8. **Auditability**: every request/job has a `correlationId`; audit events capture tenantId, actorUserId, action, entityRef, before/after where relevant.
9. **No legacy compatibility** — this is a clean v1 rebuild; don't add migration shims for a prior system.

## Frontend Conventions (Admin/Operator)

- Every Next.js page must live under an explicit route group: `(public)` (no sidebar, uses `PublicShell`), `(protected)` (LIMS pages, wrapped in `AppShell`), or `(admin)` (wrapped in `AdminShell`). Shell components live in `components/shell/`; don't inline shell HTML in pages.
- Module namespacing: all LIMS routes under `/lims/*`; future modules get their own prefix (`/opd/*`, `/rims/*`, `/billing/*`). Never add unnamespaced top-level routes.
- Compose pages from `components/app/*`: `PageHeader` (required on every page), `SectionCard`, `DataTable`, and all three of `EmptyState`/`ErrorState`/`SkeletonPage`. Use `EncounterStatusBadge`/`DocumentStatusBadge` instead of inlining status colors. New shadcn/ui primitives go in `components/ui/`.
- Tailwind utilities for layout/spacing; no inline `style={{}}` objects in new code. Any new color must be added as a CSS variable (see `apps/operator/src/app/globals.css` `:root`/`.dark`), never hardcoded — enforced by `pnpm ui:color-lint`.
- Query-param integers (page, limit) arrive as strings from the client — always cast with `Number()` in service `list()` methods before passing to Prisma `take`/`skip`.

## Where to Look

- `docs/specs/` — architecture, tenancy, LIMS workflow state machine, document pipeline, Admin app scope, testing strategy
- `docs/ops/` — smoke test checklist, backup posture
- `packages/contracts/openapi.yaml` — canonical API contract
- `apps/api/prisma/schema.prisma` — data model
- `AGENTS.md` — session handoff log, environment/deploy details (ports, Caddy routing, demo credentials, known gotchas); check it for current stack state before assuming something is broken or unbuilt.
