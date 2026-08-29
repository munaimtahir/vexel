# OPD Gap Register

**Release decision:** `NOT READY`
**Reconciled:** 2026-08-28 against repository HEAD and rebuilt local API

| Area | Current finding | Closure required |
|---|---|---|
| Canonical runtime | Canonical models/routes remain. Duplicate registered billing runtime was removed and the dropped `opdVisitId` write fixed. | Add controller/runtime regression tests and remove remaining stale legacy labels/flag aliases. |
| Scheduling | Book/reschedule/cancel/check-in/no-show commands exist. Availability uses UTC arithmetic rather than schedule timezone; no slot-generation API exists. | Timezone/DST tests, generated slots, effective-date enforcement, idempotency and concurrent booking integration tests. |
| Queue/linkage | Appointment relation exists in schema but registration does not link an appointment; no queue number/order model or queue UI exists. | Transactional appointment-to-encounter linkage and deterministic queue ordering with API/browser tests. |
| Clinical notes | Intake/start/sign/publish/finalize/cancel exist. There is no save-draft command, clinician-to-user ownership mapping, or comprehensive vitals range validation. | Draft lifecycle, ownership enforcement, validated vitals history, transaction rollback and adversarial tests. |
| Amendments | No amendment model, source/new version, reason, approval, approver, history, or commands exist. Current note schema stores only one row. | Immutable versioned amendment aggregate, request/approve commands, new deterministic document version, Admin/Operator UI and tests. |
| Prescription | Publish uses deterministic documents but replaces prescription items in place. | Immutable prescription versions/drafts, ownership, amendment-only post-publication changes and retrieval tests. |
| Billing | Canonical create/issue/partial payment/void/receipt works after routing repair. | Payment void/refund/correction commands, references/method validation, idempotent financial commands and real concurrent-payment tests. |
| RBAC | OPD permission names exist and controller use was tightened. Seed creates no least-privilege OPD demo users; browser OPD tests use super-admin. | Provision OPD roles/users and prove each allow/deny action, stale JWT, inactive user and UI-hidden API denial. |
| Tenant isolation | Observed service lookups are generally tenant-scoped. | Tenant A/B tests for every entity, nested relation, pagination/search, documents, jobs and guessed IDs. |
| Feature flags | Backend checks `module.opd` plus mixed subfeature names; registry/seed retains scaffold-era aliases. | One canonical flag matrix and disabled-feature API/browser tests. |
| Documents | Shared payload-hash/worker/PDF pipeline is called. | OPD-specific deterministic payload, rendered content, failure injection, FAILED/retry, duplicate worker and secure download evidence. |
| Operator/Admin | Basic encounter/intake/doctor/billing surfaces exist. | Scheduling, queue, amendments, approval, job/document observability, retry, responsive/accessibility and error-state coverage. |
| Migration | Retirement migration directly drops source tables and invoice link. | Restore source data from backup if applicable, reconcile/export counts before cutover, verify empty and representative DB, and rehearse rollback. |
| Security dependencies | API image build reported 13 high and 1 critical advisories. | Triage reachable production dependencies, remediate all Critical/High findings, and check in scan evidence. |
| Deployment | API rebuild and canonical registration/invoice smoke passed. | Clean full-stack deployment, Caddy/TLS, full workflow, restart/recovery, backup/restore and rollback evidence. |
