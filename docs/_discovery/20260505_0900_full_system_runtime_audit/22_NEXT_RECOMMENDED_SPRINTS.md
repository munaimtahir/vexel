# 22_NEXT_RECOMMENDED_SPRINTS.md

Status: COMPLETE (recommendations only; no implementation)

## Sprint 0: Stabilize Contract + Tests (Blockers)

Objective:
- Restore “contract-first” enforcement and green test baseline.

Why:
- OpenAPI lint fails (3.1 `nullable`), SDK tests cannot run, API tests not green. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/21_GAPS_RISKS_AND_TECH_DEBT.md`

Likely areas:
- `packages/contracts/openapi.yaml`
- `packages/contracts/scripts/*`
- `packages/sdk/package.json` (test runner deps/tooling)
- `apps/api/src/catalog/__tests__/catalog-reference-range-import.spec.ts`

Acceptance criteria:
- `npx @redocly/cli lint packages/contracts/openapi.yaml` passes (or equivalent agreed linter for OAS 3.1).
- `pnpm --filter @vexel/sdk test` passes.
- `pnpm --filter @vexel/api test` passes.

Exit gate:
- NO-GO unless all above are green.

## Sprint 1: Tenancy Isolation Proof (Runtime + Tests)

Objective:
- Prove tenant isolation end-to-end with automated tests + runtime checks.

Why:
- Tenant isolation is a non-negotiable locked rule; current proof is incomplete. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/09_TENANCY_ISOLATION_AUDIT.md`

Likely areas:
- `apps/api/src/tenant/*`
- `apps/api/prisma/schema.prisma` (models without tenantId intent)
- API services with list/get queries (tenant filters)

Acceptance criteria:
- Two-tenant runtime test documented + repeatable.
- Automated integration tests for cross-tenant access attempts (A cannot read B).

Exit gate:
- NO-GO if any cross-tenant read is possible.

## Sprint 2: UI Governance Restoration (Route Groups + Namespacing)

Objective:
- Bring Admin/Operator routing into compliance with locked UI governance rules.

Why:
- Current filesystem routes violate route-group and LIMS namespacing constraints. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/13_ADMIN_APP_AUDIT.md`, `docs/_discovery/20260505_0900_full_system_runtime_audit/14_OPERATOR_APP_AUDIT.md`

Likely areas:
- `apps/admin/src/app/*`
- `apps/operator/src/app/*`

Acceptance criteria:
- All unauth pages under `(public)`; all auth pages under `(protected)` or `(admin)` as applicable.
- LIMS routes only under `/lims/*` (non-namespaced routes replaced with redirects if needed).
- `pnpm --filter @vexel/admin lint` and `pnpm --filter @vexel/operator lint` remain green.

Exit gate:
- Conditional GO once governance is restored and smoke flows remain functional.

## Sprint 3: Release Audit Hardening (E2E + Evidence)

Objective:
- Automate the critical runtime verification flows and keep evidence repeatable.

Why:
- Current audit verified core LIMS flow via API, but UI/browser verification is not yet automated. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/19_E2E_RUNTIME_VERIFICATION_REPORT.md`

Likely areas:
- `apps/e2e` (if present), Playwright setup docs, CI workflows.

Acceptance criteria:
- Playwright E2E covers Admin login + key pages and Operator LIMS happy path.
- CI runs smoke suite with deterministic env + artifacts.
