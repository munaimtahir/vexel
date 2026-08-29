# OPD Release Ledger

**Release:** OPD production release

**Decision:** `OPD NOT READY`

**Release candidate commit:** none

**Authoritative scope:** [`OPD_RELEASE_SCOPE.md`](OPD_RELEASE_SCOPE.md)

## Evidence ledger

| Gate | Evidence | Status |
|---|---|---|
| Canonical runtime | Legacy models/routes were removed; stale duplicate billing runtime was removed in this sprint | PARTIAL |
| Scheduling and queue | Booking commands exist; slot output, queue ordering, and encounter linkage proof are missing | FAIL |
| Clinical workflow/amendments | Basic intake/sign/publish/finalize exists; drafts, ownership, immutable amendments and approval do not | FAIL |
| Billing controls | Canonical create/issue/partial payment/void/receipt paths exist; refunds, payment void/correction and complete concurrency proof do not | FAIL |
| OpenAPI/SDK | Contract generation/freshness passes | PASS |
| Tenant security/RBAC | Tenant filters and OPD permissions exist; full adversarial matrix and clinician ownership are missing | FAIL |
| Documents/worker/PDF | Shared deterministic pipeline is used; OPD failure/retry/duplicate-worker/render assertions are missing | FAIL |
| Operator/Admin | Basic encounter/intake/doctor/billing pages exist; scheduling, queue, amendment, observability and failure-state parity are incomplete | FAIL |
| Migration/rollback | `20260828143500_retire_legacy_opd` drops source tables without reconciliation or rollback evidence | FAIL |
| Quality gates | API static/unit gates pass; complete frontend/build/E2E/security/dependency gates do not | FAIL |
| Deployment | Rebuilt API live smoke passes; clean deployment, full stack, proxy/TLS and recovery proof are incomplete | FAIL |

## 2026-08-28 correction log

- Withdrew contradictory production-ready claims.
- Removed the registered legacy `BillingService` implementation that queried dropped `opdVisit`/provider/appointment relations.
- Routed `/api/opd/billing/*` through the canonical `OpdService` and removed its dropped `opdVisitId` write.
- Replaced broad LIMS document/billing permissions on OPD controllers with OPD-specific read/manage/generate permissions; note signing now requires `opd.clinical_note.sign`.
- Removed obsolete OPD permission names from new-role seed definitions.
- Rebuilt the API and live-smoked feature enablement, registration, invoice creation/list/retrieval.

Historical entries in Git remain useful provenance but do not override the current failing gates.
