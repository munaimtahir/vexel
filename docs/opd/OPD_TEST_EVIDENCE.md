# OPD Test Evidence

**Release decision:** `NOT READY`

No prior LIMS/platform test result is accepted as OPD release proof. The current OPD audit records core API/build checks but explicitly lacks a dedicated OPD E2E run and local PDF runtime verification.

## Mandatory evidence matrix

| Gate | Required result | Current status |
|---|---|---|
| OpenAPI/SDK freshness and parity | pass | pending current sprint run |
| lint, color lint, typecheck, production build | pass | pending current sprint run |
| OPD state/validation/idempotency unit tests | pass | incomplete evidence |
| workflow integration and transaction rollback | pass | incomplete evidence |
| tenant isolation, RBAC, clinician ownership | pass | incomplete evidence |
| registration/payment/document concurrency | pass | incomplete evidence |
| deterministic payload/PDF/retry tests | pass | incomplete evidence |
| Admin/Operator browser E2E | pass | incomplete evidence |
| migration and deployment smoke tests | pass | incomplete evidence |

The release ledger may be changed to `READY` only when each row has a reproducible command and checked-in artifact.
