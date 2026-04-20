# OPD Test Evidence Plan

## Unit coverage targets
- OPD transition rules (`DRAFT -> READY_FOR_PRINT -> COMPLETED`, cancel rules).
- Invalid transitions return `409`.
- Doctor profile field validation.
- OPD deterministic payload builder (prescription + receipt payload shape).

## Integration coverage targets
- Tenant isolation for OPD encounters/doctor profiles.
- Command behavior for finalize/cancel/publish/generate-receipt.
- Permission checks for admin doctor config vs operator workflow.

## E2E/smoke targets
- Patient select/create -> OPD registration -> intake -> prescription publish -> receipt generation.
- Document retrieval for prescription/receipt.
- Verify doctor identity mapping on prescription output.

## Evidence collected in this run
- API unit suite run completed successfully (`pnpm --filter @vexel/api test -- --runInBand`).
- Operator and Admin production builds complete (with pre-existing lint warnings only).
- SDK generation completed and OPD receipt operations confirmed in generated types.

## Environment constraints
- PDF service binary verification not completed locally due to missing .NET runtime in this environment.
