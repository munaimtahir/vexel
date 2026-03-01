# Catalog evidence pack

## Verification commands
Full output is captured in:
- `docs/_audit/catalog/verification.log`
- `docs/_audit/catalog/merge_gate.log`
- `docs/_audit/catalog/deploy_smoke.log`

Executed commands:
- `pnpm sdk:generate`
- `pnpm --filter @vexel/api test -- --runInBand`
- `pnpm --filter @vexel/api build`
- `pnpm --filter @vexel/admin lint`
- `pnpm --filter @vexel/admin build`
- `pnpm check:admin-openapi-parity`
- `pnpm --filter @vexel/api lint`
- `pnpm --filter @vexel/operator lint`
- `pnpm --filter @vexel/operator build`

OpenAPI/SDK stability:
- Re-running `pnpm sdk:generate` produced no additional diff (`openapi_sdk_diff_stable=yes`).

## Artifacts
- Starter workbook sample: `docs/catalog/samples/starter-catalog.xlsx`
- Import guide: `docs/catalog/how-to-import-catalog.md`
- Template rules: `docs/catalog/template-rules.md`
- Catalog build workspace: `docs/catalog/build/v1/`
  - Full workbook: `docs/catalog/build/v1/workbooks/catalog_v1.xlsx`
  - Batch workbooks: `batch-01..batch-04`
  - Batch outputs: `docs/catalog/build/v1/reports/*.json` + export snapshots
  - Batch notes: `docs/catalog/build/v1/release-notes/*.md`

## Result summary
- API tests: pass (`11/11` suites, `51/51` tests)
- API build: pass
- Admin lint: pass with existing hook-dependency warnings
- Admin build: pass
- Deploy smoke: pass on rebuilt stack (`docker compose up -d`, migration deploy, auth + catalog endpoints + template/export + import apply idempotency)

## Known baseline waivers
- `next lint` reports existing `react-hooks/exhaustive-deps` warnings in Admin/Operator pages; these are pre-existing baseline warnings and not introduced by this catalog slice.
- Workflow proof (`docs/_audit/catalog/workflow_proof/`) requires manual UI/PDF capture and is left as a checklist for operator verification.
