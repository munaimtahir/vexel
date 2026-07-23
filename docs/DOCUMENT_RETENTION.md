# Documentation and artifact retention register

Reviewed: 2026-07-23

## Retained as current

- `docs/specs/`, `docs/ops/`, `docs/catalog/`, `docs/templates/`, `docs/ui/`, `docs/features/`, and `docs/mocks/`.
- `docs/audits/20260723_pilot_readiness/`, the latest pilot-readiness technical audit, plan, and plain-language report.
- Older audit families under `docs/_audit/`, `docs/_discovery/`, `docs/_fresh_audit/`, `docs/_implementation/`, and `docs/_verification/` remain available for traceability. Their dates and conclusions must be checked before reuse.
- `docs/archive/runtime-evidence/OUT_legacy_202603/`, retained as historical evidence but no longer used for new runs.

## Moved for standardization

- The active catalog mapping input is now `apps/api/resources/catalog/test-parameters-mapping.csv` so the seed utility can consume it without a host-specific absolute path.
- Catalog delivery artifacts are now under `docs/catalog/source/`.
- The Docker access helper is now `scripts/ops/enable-docker-access.sh`.
- The current E2E evidence destination is `docs/_audit/DEPLOY_RUNS/<timestamp>/` and is ignored by Git.

## Removed as disposable or superseded

The following were generated or duplicated working-session artifacts with no runtime or documentation consumers:

- Root `final_result*.json`, `mapping_result*.json`, `validate_result*.json`, and `final_test.json` files.
- Root screenshots `operator-current.png` and `operator-fixed.png`.
- Root `copilot_session.md`, `session.md`, and `operatorUIPlan.md`; their useful context is represented by the dated audit records and project docs.
- Root `final.sh` and `fix.sh`; both were one-off recovery scripts containing hard-coded credentials and were not part of the supported operational toolchain.
- Tracked `.playwright-cli/` console logs, page snapshots, trace resources, and screenshots; these are reproducible generated output and are now ignored.

## Do not delete without a new review

- Historical audit evidence referenced by an audit's evidence index or command log.
- Catalog source/workbook files under `docs/catalog/` and the runtime seed mapping under `apps/api/resources/catalog/`.
- Migration files, generated SDK source, OpenAPI contracts, or operational runbooks.
