# OPD implementation discovery

## Authoritative status

```text
OPD CURRENT STATUS
FUNCTIONALLY IMPLEMENTED BUT NOT RELEASE READY
```

OPD is substantially beyond foundation-only: canonical schema/migrations, OpenAPI/SDK, mounted Nest modules, real persistence, shared documents/PDF, permissions/flags, nine Operator routes, and three Admin routes exist. It is not near release because the primary prescription publish path crashes, billing and appointment command routes drift, role separation is unsafe, major backend capabilities lack UI, and no full clinical/document E2E exists.

## Reality by layer

- **Already exists:** shared Patient/Encounter/Invoice/Payment/Document infrastructure; OPD doctor, schedules, appointments, encounter, vitals, notes, prescription, settings, command log; Admin doctor CRUD; Operator walk-in registration, encounter/intake/doctor and billing pages.
- **Schema/contract intent only:** practical repeat-vitals history, immutable prescription versions, appointment lifecycle completion synchronization.
- **Backend only:** schedules/slots, appointments and commands, queue, draft/amendment, finalization/cancellation, refund, settings, correct receipt generation.
- **Frontend only/stale:** slash-form billing commands and `/opd/worklist`/Admin provider/schedule links; these do not map to current routes.
- **Mocked evidence:** most invariants for scheduling, queue, ownership, vitals, refund, and clinical persistence.
- **Connected end-to-end:** login/navigation; shared patient create/search; walk-in registration persists Patient/Encounter/OpdEncounter/Invoice; encounter/intake pages load. No browser test completes consultation/prescription/document flow.
- **Currently usable:** encounter listing, patient search/create, walk-in registration, doctor selection, intake form and consultation start with qualifications. Billing command completion and prescription publishing are not usable.
- **Architecturally incompatible:** `as any` contract bypass, mutable prescription design, least-privilege seed backfill, optional clinician ownership, unenforced feature aliases.
- **Absent:** OPD-to-LIMS/RIMS order linkage, structured ICD/diagnosis catalog, referrals, visit summary/certificate. These should not expand the minimum release until current scope closes.

## Shared core direction

Keep the current shared authentication, tenancy, Patient, Encounter, finance, audit, flags, jobs, Document/PDF/MinIO architecture. Reuse the canonical OPD models introduced after the legacy table retirement. Do not resurrect the dropped Provider/OPDVisit mini-platform. Reconcile duplicated read state (`paymentStatus`, appointment/encounter lifecycle) transactionally against shared owners.

## Release path

1. Fix prescription version/publish persistence, malformed appointment commands, billing DTO/routes, and role seed backfill.
2. Make registration/appointment/invoice atomic and enforce same-tenant clinician ownership.
3. Lock immutable signed-note/prescription amendment semantics; repeat vitals and lifecycle reconciliation.
4. Canonicalize and enforce OPD subfeature flags and transactional idempotency.
5. Expose existing schedule/appointment/queue/finalize/cancel/draft/amend/refund/settings/document-retry APIs through generated-SDK pages.
6. Run non-super-admin two-tenant RBAC/ownership tests and complete walk-in plus appointment browser E2E through published prescription/receipt.
7. Prove BullMQ/PDF/MinIO retry, idempotency, deployment, migration, backup/restore, and Caddy acceptance.

Detailed evidence: [`_work/OPD_AGENT_FINDINGS.md`](_work/OPD_AGENT_FINDINGS.md).
