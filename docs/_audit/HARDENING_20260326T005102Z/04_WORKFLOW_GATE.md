# Workflow Integrity Gate

Validation sources:
- API tests (`pnpm --filter @vexel/api test -- --runInBand`) -> PASS (`199/199`).
- Full E2E includes command-workflow transition coverage.

Observed passing workflow categories:
- order-lab
- collect-specimen
- receive/transition protections
- result submit
- verify
- publish/document generation path
- invalid transition 409 guards

Evidence from suite names includes:
- `encounter-workflow.spec.ts`
- `invalid-transition-*.spec.ts`
- `LIMS happy-path` specs
