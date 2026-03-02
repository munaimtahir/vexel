# Baseline Context — 2026-03-02

Updated: 2026-03-02 03:20:51 UTC
Scope: Persistent handoff baseline for upcoming implementation, bug-fix, and review tasks.

## 1) Project Mission (Locked)
- Vexel is a multi-tenant Health Platform with LIMS-first delivery.
- Architecture must support future modules (OPD, RIMS, etc.) without refactor.
- v1 is greenfield; no legacy compatibility logic.

## 2) Non-Negotiable Guardrails
- Contract-first: `packages/contracts/openapi.yaml` is canonical.
- Frontend SDK-only: Admin/Operator must use generated SDK (`packages/sdk`); no ad-hoc backend calls.
- Tenant isolation: all customer-owned entities have `tenantId`; tenant-scoped uniqueness and tenant-filtered queries are mandatory.
- Workflow state changes: command endpoints only; no direct status CRUD edits.
- Deterministic documents: canonical payload hash (`payloadHash`) and rendered bytes hash (`pdfHash`); idempotent publish and retry-safe pipeline.
- Auditability: correlationId on requests/jobs; commands and admin changes audited.
- Next.js apps are API clients only; never import Prisma in frontend apps.

## 3) Runtime and Architecture Baseline
- Runtime components: API (NestJS), Worker (BullMQ), PDF service (.NET/QuestPDF), Admin UI (Next.js), Operator UI (Next.js), Postgres, Redis, Caddy.
- Deployment mode: Docker Compose, internal services bound to localhost.
- Global API prefix: `/api/*`.
- Admin basePath requirement: `/admin`.

## 4) Current Operational Context (from AGENTS handoff)
- LIMS Operator UI is live and currently in bug-fix + UX improvement mode.
- CI and local validation were reported green in the latest handoff:
  - API unit tests: PASS
  - Playwright E2E: PASS
  - Contract truth-map gaps reduced and documented as mostly non-blocking utility/admin endpoints.
- Live URL: `https://vexel.alshifalab.pk`
- Repo path: `/home/munaim/srv/apps/vexel`

## 5) Workflow and State Model Baseline
- LIMS flow remains command-driven end-to-end:
  - register patient -> create encounter -> order lab -> collect/receive specimen -> enter results -> verify -> publish report
- Invalid transitions must return `409 Conflict`.
- Every command must emit an audit event.

## 6) Tenancy and Auth Baseline
- Tenant resolution:
  - Production: request Host/domain mapping.
  - Dev override header `x-tenant-id` only when explicitly enabled.
- Auth model:
  - Access token: JWT (short-lived).
  - Refresh token: DB-persisted, hashed, rotated on use.
  - Permissions loaded live from DB and enforced by guard.

## 7) Documents/PDF Baseline
- Document identity unique key: `(tenantId, encounterId, docType, templateVersion, payloadHash)`.
- Async pipeline:
  - API enqueue -> Worker render call -> store bytes -> update status/hash -> publish command.
- Lifecycle: `QUEUED -> RENDERING -> RENDERED/FAILED`, then `PUBLISHED` by command.

## 8) OPD Baseline (Governance Locked)
- OPD routes are namespaced under `/opd/*` in UIs and `/api/opd/*` in API.
- OPD state changes must remain command-only.
- OPD billing/invoice/receipt docs must remain deterministic/idempotent.
- OPD scope in includes providers, appointments, vitals, clinical note, free-text prescription, billing/payments.

## 9) QA/Release Baseline
- Minimum bars:
  - Unit: state transitions and document idempotency/hash behavior.
  - Integration: tenancy isolation and publish idempotency.
  - Smoke: `docs/ops/SMOKE_TESTS.md` after each slice.
- UI governance gates:
  - `tsc --noEmit` and `next lint` pass in Admin and Operator.
  - Route-group shell structure and `/lims/*` namespace constraints preserved.

## 10) Practical Execution Rules for Future Tasks
- Before coding: verify scope against locked docs and OpenAPI contract.
- For any API/UI change: update contract first, regen SDK, then implement.
- For workflow/status changes: implement/consume command endpoint only.
- For list pagination params (`page`, `limit`): cast query strings to numbers before Prisma usage.
- Preserve tenant filters in all service queries and index/unique design.
- Avoid regressions against known fixed issues (basePath, API build args, specimen/default handling, auth header download paths).

## 11) Canonical References
- `README.md`
- `docs/specs/LOCKED_DECISIONS.md`
- `docs/specs/ARCHITECTURE.md`
- `docs/specs/TENANCY.md`
- `docs/specs/LIMS_WORKFLOWS.md`
- `docs/specs/DOCUMENTS_PDF.md`
- `docs/specs/AUTH.md`
- `docs/specs/ADMIN_APP_SPEC.md`
- `docs/specs/TESTS.md`
- `docs/ops/SMOKE_TESTS.md`
- `packages/contracts/openapi.yaml`

## 12) Baseline Confidence Notes
- This baseline is documentation-derived and intended as a working context anchor.
- For any release-critical task, re-run smoke checks and target-area tests before deploy.
