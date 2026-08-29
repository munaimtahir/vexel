# OPD Gap Register

**Release decision:** `NOT READY`
**Reconciled:** 2026-08-29 against repository HEAD, rebuilt local Docker stack, and same-URL smoke

| Area | Current finding | Closure required |
|---|---|---|
| Canonical runtime | Canonical models/routes remain. Duplicate registered billing runtime was removed and the dropped `opdVisitId` write fixed. | Add controller/runtime regression tests and remove remaining stale legacy labels/flag aliases. |
| Scheduling | Timezone-aware slot generation, booking/reschedule/cancel/check-in/no-show commands, and queue listing exist. | Effective-date/DST integration tests and concurrent booking evidence. |
| Queue/linkage | Queue ordering and optional appointment linkage exist in runtime. | Prove atomic linkage and queue behavior against real PostgreSQL and browser journeys. |
| Clinical notes | Draft lifecycle, clinician association, ownership checks, vitals bounds, and note amendments are implemented. | Real-DB ownership/adversarial/rollback tests and signed-document version evidence. |
| Amendments | Versioned note amendment request/approval commands and audit fields exist. | Prescription amendments, approver authorization, immutable document version, UI, and integration evidence. |
| Prescription | Publish uses deterministic documents but replaces prescription items in place. | Immutable prescription versions/drafts, ownership, amendment-only post-publication changes and retrieval tests. |
| Billing | Canonical create/issue/partial payment/void/refund and settings limits exist. | Correction coverage and real concurrent-payment/idempotency evidence. |
| RBAC | OPD permission names exist and controller use was tightened. Seed creates no least-privilege OPD demo users; browser OPD tests use super-admin. | Provision OPD roles/users and prove each allow/deny action, stale JWT, inactive user and UI-hidden API denial. |
| Tenant isolation | Observed service lookups are generally tenant-scoped. | Tenant A/B tests for every entity, nested relation, pagination/search, documents, jobs and guessed IDs. |
| Feature flags | Backend checks `module.opd` plus mixed subfeature names; registry/seed retains scaffold-era aliases. | One canonical flag matrix and disabled-feature API/browser tests. |
| Documents | Shared payload-hash/worker/PDF pipeline is called. | OPD-specific deterministic payload, rendered content, failure injection, FAILED/retry, duplicate worker and secure download evidence. |
| Operator/Admin | Basic encounter/intake/doctor/billing surfaces exist. | Scheduling, queue, amendments, approval, job/document observability, retry, responsive/accessibility and error-state coverage. |
| Migration | Retirement migration is already applied locally; enhanced preflight now reports canonical and legacy counts. | Export/hash manifest, representative-database rehearsal, restore proof, and rollback evidence before production cutover. |
| Security dependencies | API image build reported 13 high and 1 critical advisories. | Triage reachable production dependencies, remediate all Critical/High findings, and check in scan evidence. |
| Deployment | API rebuild and canonical registration/invoice smoke passed. | Clean full-stack deployment, Caddy/TLS, full workflow, restart/recovery, backup/restore and rollback evidence. |
