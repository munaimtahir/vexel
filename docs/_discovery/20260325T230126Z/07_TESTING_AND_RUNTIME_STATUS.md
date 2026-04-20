# Testing and Runtime Status

## What exists
- API unit/integration tests: extensive Jest suites (`apps/api/test`, `apps/api/src/**/*.spec.ts`).
- E2E tests: Playwright suite in `apps/e2e` with broad scenario coverage.
- Governance checks: UI color lint and contract parity scripts in root scripts.

## What was executed in this audit
- `pnpm ui:color-lint` -> PASS.
- `pnpm check:admin-openapi-parity` -> PASS.
- `pnpm --filter @vexel/api test -- --passWithNoTests --runInBand` -> PASS (199 tests).
- `pnpm --filter @vexel/api build` -> PASS.
- `pnpm --filter @vexel/worker build` -> PASS.
- `pnpm --filter @vexel/operator build` -> PASS (warnings).
- `pnpm --filter @vexel/admin build` -> PASS (warnings).
- `pnpm --filter @vexel/operator lint` and `pnpm --filter @vexel/admin lint` -> PASS with many warnings.

## Runtime status in this audit
- Local services were not running; local health checks failed due to connection absence.
- Therefore runtime path verification is **Unverified** in this pass.

## Missing verifications
- Fresh `docker compose up` + health checks.
- Full smoke script run from `docs/ops/SMOKE_TESTS.md` against live local stack.
- Re-run E2E in current state.
- Explicit tenancy leakage and document determinism runtime assertions in live stack.
