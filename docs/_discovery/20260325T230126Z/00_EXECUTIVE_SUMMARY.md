# Executive Summary

## Project identity
Vexel is a multi-tenant health platform rebuild (LIMS first, OPD emerging) with contract-first OpenAPI, SDK-only frontend access, command-driven workflows, deterministic documents, and auditability as architecture laws.

## Intended scope (from governing docs)
- Contract-first API with generated SDK usage only.
- Strict tenant isolation on all customer data.
- Command-only workflow transitions (no raw status CRUD).
- Deterministic document pipeline (`payloadHash` + `pdfHash`, idempotent publish).
- Admin + Operator apps as API clients only (no Prisma in Next.js).
- CI gates for SDK drift and frontend API discipline.

## Actual state (truth bullets)
- Monorepo structure is substantial and coherent (`apps/api`, `apps/admin`, `apps/operator`, `apps/worker`, `apps/pdf`, `apps/e2e`, `packages/contracts`, `packages/sdk`).
- OpenAPI contract exists and is actively used (`packages/contracts/openapi.yaml`, SDK generation scripts).
- CI enforces SDK/no-fetch/no-axios/no-Prisma rules in frontend (`.github/workflows/ci.yml`).
- API auth, RBAC, tenancy middleware, correlation middleware, and major LIMS/OPD modules are implemented (`apps/api/src/*`).
- Workflow command endpoints exist for key LIMS transitions (`:order-lab`, `:collect-specimen`, `:receive-specimen`, `:submit`, `:verify`).
- Deterministic document fields and uniqueness are present in Prisma schema (`apps/api/prisma/schema.prisma`).
- Worker render pipeline exists and auto-publishes targeted doc types (`apps/worker/src/document-render.processor.ts`).
- PDF service is real and routed by template keys, but includes placeholder fallback path (`apps/pdf/Program.cs`).
- Operator/Admin builds complete; lint passes with many hook-dependency warnings.
- API unit/integration test suite is strong and currently passing (199 tests).
- E2E suite exists at scale (119 tests listed), but not re-executed in this discovery pass.
- Local runtime stack was down during audit (`curl` to local API failed; `docker compose ps` showed no running services), so runtime confidence is reduced.
- Mobile app is scaffold/partial and still contains mock/TODO API client code (`apps/mobile/src/api/client.ts`).
- Governance doc naming in prompt differs from repo reality; equivalent docs are under `docs/specs/*` and `docs/FEATURE_FLAGS.md`.

## Top blockers
1. Local runtime truth is unverified in this pass (stack down), limiting deployment confidence.
2. Document engine still contains placeholder rendering fallback (architecture risk for strict determinism quality).
3. Frontend lint warnings are numerous; not failing today but indicate maintainability/stability debt.
4. Mobile surface is not production-ready and is partially mocked.
5. Tasks tracking is fragmented (no authoritative `TASKS.md` in root docs set as requested by prompt).

## Final verdict
**Stage: Stabilization / truth-alignment (late integration partial with strong core implementation).**
Core architecture is largely protected and implemented, but runtime verification and a few governance-quality drifts must be closed before safe expansion.

## Recommended next milestone
**Milestone: “Truth-aligned release-hardening gate”** — bring stack up, re-run full runtime smoke + E2E + tenancy/document determinism checks, remove placeholder/fallback ambiguity in PDF path, and lock an authoritative implementation tracker.
