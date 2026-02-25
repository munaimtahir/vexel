# OPD MVP Test Plan

## Scope and Guardrails

- Contract-first is already locked in `packages/contracts/openapi.yaml`; tests validate implementation behavior against the locked command semantics, not ad-hoc payloads.
- SDK-only frontend rule is unaffected by this plan (API service tests + API smoke only; no direct frontend fetch patterns introduced).
- Tenant isolation is mandatory: OPD reads/writes must stay tenant-scoped and cross-tenant reads must fail.
- Workflow state changes are command-only: appointment/visit/invoice transitions are exercised through command methods/endpoints and invalid transitions must return `409 Conflict`.
- Admin app remains config-only; no OPD operator workflow is moved into Admin as part of these tests.
- Deterministic documents are still a release gate: OPD smoke must reference and rerun document lifecycle/idempotency/hash checks in `docs/ops/SMOKE_TESTS.md` steps `20-23`.
- No LIMS breakage: run at least one LIMS regression test/spec after OPD test changes.

## Test Strategy

### 1. API Unit Tests (fast, deterministic)

Target files:
- `apps/api/src/appointments/__tests__/appointments.service.spec.ts`
- `apps/api/src/billing/__tests__/billing.service.spec.ts`

Coverage:
- Appointment command transitions:
  - valid command path (`BOOKED -> CHECKED_IN`)
  - invalid command path returns `409` (example: `BOOKED -> IN_CONSULTATION`)
- Invoice payment state math:
  - `ISSUED -> PARTIALLY_PAID` on partial payment
  - `PARTIALLY_PAID -> PAID` on final payment
  - invalid payment transition (e.g. `DRAFT`) returns `409`
- Tenant isolation:
  - appointment lookup uses tenant-scoped query and cross-tenant read yields `NotFound`
  - invoice lookup uses tenant-scoped query and cross-tenant read yields `NotFound`

### 2. API Smoke Tests (real stack)

Use the OPD section added to `docs/ops/SMOKE_TESTS.md`:
- Provider/schedule setup
- Appointment command transitions (including invalid `409`)
- Visit + billing invoice/payment transition checks
- Dev-header tenant isolation spot-check
- Deterministic document smoke rerun (`20-23`)

### 3. Regression Safety (LIMS)

Run at least one LIMS test after OPD test additions to confirm no test harness regressions:
- Recommended: `apps/api/src/documents/__tests__/document-idempotency.spec.ts` (deterministic docs path), or
- `apps/api/src/encounters/__tests__/encounter-workflow.spec.ts` (LIMS command workflow path)

## Commands

Run from repo root unless noted.

### OPD unit tests only
```bash
pnpm --filter @vexel/api test -- appointments/__tests__/appointments.service.spec.ts billing/__tests__/billing.service.spec.ts
```

### Single-file runs (debug)
```bash
pnpm --filter @vexel/api test -- appointments/__tests__/appointments.service.spec.ts
pnpm --filter @vexel/api test -- billing/__tests__/billing.service.spec.ts
```

### LIMS regression spot-check (recommended)
```bash
pnpm --filter @vexel/api test -- documents/__tests__/document-idempotency.spec.ts
```

### Alternative LIMS workflow regression check
```bash
pnpm --filter @vexel/api test -- encounters/__tests__/encounter-workflow.spec.ts
```

## PASS Criteria

- OPD unit tests pass with explicit coverage of valid/invalid command transitions and tenant isolation.
- OPD smoke steps are executable (not placeholders) and include expected HTTP/status outcomes.
- Deterministic document coverage is explicitly referenced from OPD smoke.
- At least one LIMS regression spec passes after OPD test/doc changes.

## Evidence to Capture (for handoff / PR)

- Exact commands executed
- Jest PASS/FAIL summary with spec counts
- Any skipped smoke steps and why (e.g., local stack not running, missing seeded OPD patient/provider permissions)
- If failures occur: failing assertion, root cause, and whether runtime code changes are required (out of scope for subagent G)
