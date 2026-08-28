# OPD Test Evidence

**Release decision:** `NOT READY`

No prior LIMS/platform test result is accepted as OPD release proof. Current-sprint evidence includes dedicated OPD browser checks, real-stack receipt rendering, API/build checks, and repository regression results; mandatory canonical-domain, concurrency, ownership, and fresh-deployment evidence is still incomplete.

## Mandatory evidence matrix

| Gate | Required result | Current status |
|---|---|---|
| OpenAPI/SDK freshness and parity | pass | `pnpm check:sdk-freshness`; admin parity pass |
| lint, color lint, typecheck, production build | pass | API/Admin/Operator builds and typechecks pass; full gate still pending |
| OPD state/validation/idempotency unit tests | pass | API Jest: 35 suites / 249 tests passed; includes 9 state assertions and 4 billing/tenant invariant tests; full command concurrency coverage remains incomplete |
| workflow integration and transaction rollback | pass | incomplete evidence |
| tenant isolation, RBAC, clinician ownership | pass | incomplete evidence |
| registration/payment/document concurrency | pass | incomplete evidence |
| deterministic payload/PDF/retry tests | pass | incomplete evidence |
| Admin/Operator browser E2E | pass | OPD Playwright 2/2; repository browser 118 passed with 2 unrelated regressions repaired; full OPD journeys incomplete |
| migration and deployment smoke tests | pass | Compose config, healthy services, 28 migrations up to date, Prisma validation, API health/correlation, Host resolution, and paid receipt command verified; clean-deployment evidence incomplete |

The release ledger may be changed to `READY` only when each row has a reproducible command and checked-in artifact.
