# Stage 2 — OPD implementation and release-readiness findings

Audit time: 2026-09-01 UTC
Repository: `/home/munaim/srv/apps/vexel`
Branch/HEAD at start: `main` / `1ffda42e90a77ed86d87486ad0ac7a12dc35e477`
Baseline worktree at first capture: clean (`git status --short` emitted no entries).

## Authoritative verdict

```text
OPD CURRENT STATUS
FUNCTIONALLY IMPLEMENTED BUT NOT RELEASE READY
```

This is not `PARTIALLY IMPLEMENTED` in the narrow code-volume sense: a canonical schema, OpenAPI/SDK surface, mounted Nest modules, real database persistence, real Operator/Admin pages, shared document pipeline calls, PDF templates, permissions, feature registry entries, and a runnable stack all exist. It is not `NEAR RELEASE READY` because the primary clinical publish path is currently runtime-broken, billing frontend/backend/contract shapes conflict, navigation points to a missing route, scheduling/appointment and several clinical commands have no reachable UI, RBAC seed logic collapses intended role separation, feature subflags are not authoritative, and current tests do not exercise the full workflow or adversarial tenant/security/document behavior.

## Highest-confidence answers

1. **What OPD works today?** Super-admin can open the real encounter list and registration pages, search/create a shared Patient, choose a configured `OpdDoctor`, create a walk-in OPD encounter plus invoice, record one intake/vitals set, and start consultation. Admin can CRUD the doctor master and edit tenant OPD flags. API reads for doctors, appointments, encounters/queue, settings and invoices returned `200` against the running stack.
2. **What does not work as a coherent operator workflow?** Prescription publication fails at Prisma runtime because the service uses the retired compound key `tenantId_opdEncounterId`; billing command buttons POST non-contract slash URLs that return `404`; billing response names do not satisfy OpenAPI or UI expectations; no completion/cancellation UI exists; no appointment/schedule/queue UI exists; no draft/amendment UI exists.
3. **Can a real tenant release OPD now?** No. The clinical workflow cannot complete and publish a prescription through current executable truth, billing UI is materially disconnected, least-privilege roles are not actually least privilege, and release-grade tenant/RBAC/document/deployment evidence is absent.
4. **Shortest compliant path?** First reconcile schema/service/OpenAPI/UI contract defects and role/flag enforcement; then make the canonical walk-in clinical workflow complete and immutable; then expose existing scheduling/queue/amendment/billing APIs; finally run real PostgreSQL tenant/RBAC/idempotency/document/browser/deployment gates.

## Current canonical domain and reconstructed workflow

Current canonical persistence is in `apps/api/prisma/schema.prisma:696-961`:

- Shared core: `Tenant`, `User`, `Role`, `Permission`, `Patient`, `Encounter`, `Invoice`, `InvoiceLine`, `Payment`, `Document`, `DocumentTemplate`, audit/job infrastructure.
- OPD-specific: `OpdDoctor`, `OpdSchedule`, `OpdAppointment`, `OpdEncounter`, `OpdVital`, `OpdNote`, `OpdEncounterPrescription`, `OpdPrescriptionItemKmvp`, `OpdCommandLog`, `OpdSettings`.
- The earlier `Provider`, `ProviderSchedule`, `Appointment`, `OPDVisit`, `OPDVitals`, `OPDClinicalNote`, `OPDPrescription` runtime tables were explicitly dropped by `20260828143500_retire_legacy_opd`. They are historical migration evidence, not current models.

Current encounter state machine (`apps/api/src/opd/opd-workflow.ts`):

```text
REGISTERED
  -> INTAKE_COMPLETE
  -> IN_CONSULTATION
  -> NOTE_SIGNED
  -> PRESCRIPTION_PUBLISHED
  -> COMPLETED

REGISTERED / INTAKE_COMPLETE / IN_CONSULTATION / NOTE_SIGNED /
PRESCRIPTION_PUBLISHED -> CANCELLED (subject to the explicit transition table)
```

Appointment state code supports `BOOKED -> CHECKED_IN -> IN_CONSULTATION -> COMPLETED`, plus cancellation/no-show, but only check-in/cancel/reschedule/no-show are controller routes; no controller route exposes appointment `IN_CONSULTATION` or `COMPLETED`. Encounter consultation/completion also does not synchronize those appointment states.

The actual reachable Operator journey is shorter:

```text
shared Patient search/create
 -> walk-in OPD registration (+ draft invoice)
 -> one intake/vitals submission
 -> start consultation
 -> sign note + attempt prescription publication
 -> BROKEN at prescription Prisma upsert
```

No reachable Operator action finalizes or cancels the encounter. Appointments, schedule slots, queue, note drafts, amendments, refunds and settings are backend-only.

## Capability matrix

Legend is the requested status vocabulary. `Runtime` means current-stack evidence, not historical documentation.

| Capability | Schema | OpenAPI | SDK | Backend | Frontend | Nav | Real wiring | Persistence | Tests | Runtime | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Shared patient search/create | shared | yes | yes | yes | Operator | yes, via registration | SDK | PostgreSQL | only browser page flow/API creation | page/API passed | USABLE |
| Doctor/provider master | yes | yes | yes | list/get/create/update | Admin CRUD + Operator picker | Admin + Operator | SDK | PostgreSQL | mock service coverage only indirectly | `GET /opd/doctors` 200; Admin source wired | USABLE, insufficiently verified |
| Clinic/department/specialty | doctor strings only | doctor fields | yes | stored on doctor | Admin doctor fields | doctor page | SDK | denormalized strings | none | not exercised | PARTIAL |
| Recurring schedules | yes | list/create only | yes | list/create, overlap check | none | none | none | PostgreSQL | one mocked slot test | endpoint not directly exercised | BACKEND ONLY |
| Availability slots | derived | yes | yes | timezone-derived slots | none | none | none | appointment reads | one mocked test | doctors endpoint only | BACKEND ONLY |
| Appointment booking/list | yes | yes | yes | list/create | none | none | none | PostgreSQL | no real DB test | list returned 200 empty | BACKEND ONLY |
| Appointment check-in/cancel/reschedule/no-show | yes | yes | yes | commands | none | none | none | PostgreSQL | none | not mutated | BACKEND ONLY |
| Appointment start/complete synchronization | fields exist | absent | absent | internal transition helper accepts target but no routes/calls | none | none | no | possible | none | no | PARTIAL |
| Walk-in registration | yes + shared Encounter/Invoice | yes | yes | command | Operator form | yes | SDK | PostgreSQL | browser creates registration | page and API passed | USABLE with transactional gap |
| Appointment-to-encounter registration | relation exists | registration request omits appointment fields | SDK omits | service accepts undocumented appointmentId/code | no UI | no | undocumented | PostgreSQL | none | not verified | PARTIAL / contract-incompatible |
| Queue | checkedInAt/settings | yes | yes | list/sort | no current page | sidebar points to missing `/opd/worklist` | no | read model | mocked order test | API 200 | BACKEND ONLY; current nav broken |
| Chief complaint + first vitals | yes | yes | yes | command with bounds/BMI | Operator intake | encounter actions | SDK | PostgreSQL | mocked bounds + browser page only | page visible; no browser submit | WIRED, insufficiently verified |
| Repeat vitals/history | one-to-many schema | no separate command/read contract | no | `recordIntake` cannot replay after state leaves REGISTERED | no | no | no | schema capable | none | no | SCHEMA ONLY in practical terms |
| Consultation start | state | yes | yes | command/audit | Doctor page button | encounter action | SDK | PostgreSQL | workflow unit state only | page source wired | WIRED, not E2E-proven |
| Draft clinical note | versioned schema | yes | yes | save command | none | none | none | PostgreSQL | no dedicated test | no | BACKEND ONLY |
| Sign structured note | yes | yes | yes | command/ownership conditional | combined with Publish button | encounter action | SDK | PostgreSQL | mocked ownership only | not executed E2E | WIRED, insufficiently verified |
| Note amendments/approval | versioned fields | yes | yes | request/approve | none | none | none | PostgreSQL | one mocked request test | no | BACKEND ONLY |
| Free-text prescription items | versioned parent schema/items | yes | yes | publish + document call | Doctor form | encounter action | SDK | intended | no publish integration test | Prisma validation proves current publish fails | BROKEN |
| Prescription history/immutable versions | version column | response read gives latest | yes | replaces items in place; never marks prescription `PUBLISHED`; invalid upsert key | none | none | no | not correctly used | none | no | PARTIAL / architecturally incompatible |
| Encounter completion/cancellation | fields/state | yes | yes | commands/audit | none | none | none | PostgreSQL | state unit only | no | BACKEND ONLY |
| Invoice creation/list/detail | shared finance schema | yes but incompatible field model | yes | yes | list/new/detail | billing nav | `as any`; wrong request/response assumptions | PostgreSQL | billing service mocks | API 200, UI commands broken | PARTIAL |
| Invoice issue/void/payment/refund | shared finance schema | yes | yes | commands with row locks | issue/void/payment UI only; refund absent | detail | wrong URL shapes | PostgreSQL | mocked payment/refund only | canonical colon URLs work; UI slash URLs 404 | BACKEND ONLY in current user workflow |
| Consultation receipt PDF | shared Document | yes | yes | deterministic pipeline call | broken Generate button/link | detail | wrong command URL and stale document link | Document/MinIO | no OPD document integration test | canonical API generated PUBLISHED receipt | BACKEND USABLE; frontend BROKEN |
| Prescription PDF | shared Document | yes | yes | deterministic pipeline call | intended blob retrieval | doctor | SDK | Document/MinIO | none | blocked before generation | PARTIAL |
| OPD settings | yes | yes | yes | get/update | none | none | none | PostgreSQL | refund unit consumes mock | GET 200 | BACKEND ONLY |
| Tenant feature configuration | shared TenantFeature | yes | yes | registry/resolved/admin | Admin page + some Operator checks | Admin | SDK | PostgreSQL | no disabled-subfeature E2E | flags present | PARTIAL; aliases/enforcement drift |
| LIMS/RIMS orders from OPD | shared platform could be reused | no OPD order contract | no | no OPD linkage | none | none | no | absent | none | no | ABSENT |
| Diagnosis coding/ICD | free text only | free text | yes | free text | note fields only | no separate surface | partial | PostgreSQL | none | no | CONCEPT ONLY for structured diagnosis |
| Referral/procedure/follow-up workflow | followUp/investigations strings only | strings | yes | strings | no complete UI | none | no | strings | none | no | CONCEPT ONLY |
| Visit/consultation summary or certificate | no dedicated type | absent | absent | absent | absent | absent | no | absent | none | no | ABSENT |

Approximation derived from the 29 matrix rows (not intuition):

- Schema/shared persistence support: 24/29 capabilities (83%) have at least a model/field.
- Contract/SDK support: 23/29 (79%) have a declared API shape, although billing and appointment registration shapes drift.
- Backend code support: 23/29 (79%) have some implementation.
- Frontend presence: 12/29 (41%) have a page/action; only 8/29 (28%) are plausibly wired without a known hard break.
- Current runtime-usable operator workflow: 6/29 (21%) capabilities were either directly executed or are prerequisite pages/API reads without a known hard break. No end-to-end completed encounter exists.
- Automated verification: 8/29 (28%) receive any direct automated attention, mostly mocked/unit/page-presence; 0/29 have a full tenant/RBAC/worker/PDF production-style E2E proof.

## Material release-gap ledger

### OPD-P0-001 — Prescription publication is runtime-broken

- **Module / Area:** OPD / clinical prescription
- **Finding:** `publishPrescription()` calls Prisma `upsert` using `where.tenantId_opdEncounterId`, but schema uniqueness was migrated to `(tenantId, opdEncounterId, version)`. Type checking misses it because Prisma is cast to `any`.
- **Evidence:** `apps/api/src/opd/opd.service.ts:1726-1730`; schema `@@unique([tenantId, opdEncounterId, version])` at `schema.prisma:901`. Generated Prisma type exposes only `tenantId_opdEncounterId_version`. Direct non-writing runtime validation returned: `PrismaClientValidationError: Unknown argument tenantId_opdEncounterId`.
- **Current State:** BROKEN
- **Expected State:** Draft/versioned prescription publication succeeds, never replaces published history, and queues deterministic document rendering.
- **Severity / Release Impact:** P0 / primary workflow cannot complete.
- **Recommended Action:** Design the version semantics first; create/update only the active DRAFT by its valid compound key, mark it PUBLISHED, never `deleteMany` published items, and add real-DB publish/retry/history tests.
- **Dependencies:** schema/contract agreement, document version policy.
- **Verification Required:** real PostgreSQL workflow through published PDF plus replay/amendment.

### OPD-P0-002 — OPD billing contract, backend response and frontend are three incompatible models

- **Module / Area:** OPD / billing / contract-first
- **Finding:** OpenAPI `OpdInvoice` requires `invoiceNumber`, `subtotal`, `discountTotal`, `taxTotal`, `paidTotal`, etc. Backend emits `invoiceCode`, `subtotalAmount`, `discountAmount`, `amountPaid`, etc. OpenAPI create accepts `visitId`/`appointmentId`; backend accepts/validates only undocumented `encounterId` and otherwise silently creates a detached invoice. UI uses the OpenAPI-era names and `as any`, so summary fields are blank/wrong.
- **Evidence:** `openapi.yaml:1974-2070`; `opd.service.ts:62-92,257-332`; `billing/new/page.tsx:65-76`; runtime invoice keys were exactly `amountPaid,balanceDue,discountAmount,encounterId,grandTotal,invoiceCode,subtotalAmount,...`, with `invoiceNumber/subtotal/discountTotal/paidTotal` absent.
- **Current State:** PARTIAL / active contract drift
- **Expected State:** One canonical financial DTO/linkage implemented exactly in OpenAPI, SDK, backend and UI.
- **Severity / Release Impact:** P0 / financial behavior and UI truth are unreliable.
- **Recommended Action:** Choose canonical shared `Invoice` terminology and linkage, update OpenAPI first, regenerate SDK, remove every `as any`, return contract-conformant response, validate link ownership, and add controller schema tests.
- **Dependencies:** decide whether OPD invoice links by shared encounter (recommended current architecture) and how appointment is represented.
- **Verification Required:** request/response validation plus full invoice/payment/refund/receipt UI E2E.

### OPD-P0-003 — Billing UI command paths are superseded and return 404

- **Module / Area:** OPD / Operator billing
- **Finding:** UI calls `/issue`, `/void`, POST `/payments`, and `/receipt`; contract/backend use `:issue`, `:void`, `:record-payment`, `:generate-receipt`.
- **Evidence:** `billing/invoices/[invoiceId]/page.tsx:117-185`; `billing.controller.ts:64-123`; `openapi.yaml:8400-8593`. Authenticated runtime: slash forms all `404`; canonical colon forms reached service (`200` for issue/generate, `409` validation for zero payment).
- **Current State:** BROKEN
- **Expected State:** generated-SDK typed command calls only.
- **Severity / Release Impact:** P0 / cash-desk UI cannot issue, pay, void or generate receipts.
- **Recommended Action:** Replace strings with canonical generated paths, delete `as any`, map response fields correctly.
- **Dependencies:** OPD-P0-002.
- **Verification Required:** browser E2E as OPD finance user.

### OPD-P0-004 — Seed backfill destroys least-privilege OPD role separation

- **Module / Area:** OPD / RBAC
- **Finding:** Although initial role definitions differ, the backfill loop grants the entire OPD permission set to `opd-operator`, `opd-doctor`, and `opd-finance`. No users are seeded into these roles. Current DB confirms all three roles have clinical sign/publish, billing manage, encounter manage and document publish.
- **Evidence:** `apps/api/prisma/seed.ts:246-336`; current DB permission aggregation. E2E defaults to `admin@vexel.system` (super-admin) in `apps/e2e/tests/opd/01-opd-workflow.spec.ts:4-5`.
- **Current State:** architecturally incompatible security configuration.
- **Expected State:** explicit least-privilege matrix; dedicated operator, clinician and finance users; deny evidence.
- **Severity / Release Impact:** P0 / clinical and financial authorization separation absent.
- **Recommended Action:** correct idempotent seed reconciliation (including removing permissions no longer desired), create non-super-admin test users, and prove API/UI allow/deny including stale JWT/inactive user.
- **Dependencies:** locked permission matrix.
- **Verification Required:** role-by-command matrix and direct API bypass tests.

### OPD-P0-005 — No completed real clinical/document E2E exists

- **Module / Area:** OPD / release evidence
- **Finding:** Browser suite named “OPD production workflow” has two tests: page presence and registration + intake-page presence. The second is titled “completed encounter is rendered as locked” but never completes or submits intake. No OPD-specific worker/PDF, cross-tenant, RBAC, idempotency/concurrency or failure/retry E2E exists.
- **Evidence:** full `apps/e2e/tests/opd/01-opd-workflow.spec.ts`; current run passed 2/2 in 26.3s but did not exercise the advertised completed state. Unit run passed 28/28, primarily mocks.
- **Current State:** TESTED only at shallow page/mock level.
- **Expected State:** real backend/browser sequence from patient through completed encounter and downloadable published documents, plus invalid transitions and adversarial gates.
- **Severity / Release Impact:** P0 under current authoritative OPD release scope.
- **Recommended Action:** after defects are fixed, add deterministic setup and non-super-admin full-stack E2E.
- **Dependencies:** P0-001 through P0-004.
- **Verification Required:** PostgreSQL, Redis, worker, PDF, MinIO, Operator and Admin in same run.

### OPD-P1-001 — Registration and appointment linkage are not atomic or safe

- **Finding:** `createRegistration` updates an appointment, creates shared Encounter, allocates sequence, creates OpdEncounter, creates Invoice, optionally issues/pays, and audits as separate operations. Failure can leave partial state. Appointment lookup does not verify requested patient/doctor match the appointment. Appointment fields are not in OpenAPI request.
- **Evidence:** `opd.service.ts:1207-1332`.
- **Impact:** P1 data integrity; elevate to P0 before enabling appointment workflow.
- **Action:** single real Prisma transaction, tenant/patient/doctor/appointment invariants, contract fields, rollback tests.

### OPD-P1-002 — Scheduling semantics are incomplete and backend-only

- **Finding:** create/list only; no update/delete/exception/leave UI. Booking compares UTC weekday/minutes to schedule wall-clock strings and ignores effective dates; slot generation uses timezone conversion, so availability display and booking validation can disagree. No controller routes transition appointment to consultation/completed.
- **Evidence:** schema schedule effective dates; service `getDoctorSlots` vs `createCanonicalAppointment` (`:718-929`); controller appointment routes `:105-145`; no appointment routes in current UIs.
- **Impact:** P1 for release scope that includes appointments.
- **Action:** lock timezone/effective-date semantics, expose complete commands, add DB exclusion/concurrency protection or equivalent, build Admin schedule and Operator booking/queue UI.

### OPD-P1-003 — Clinical ownership is conditional and incomplete

- **Finding:** sign/draft/amend request checks assigned doctor only when `doctor.userId` is non-null. Start consultation and prescription publication do not enforce assigned clinician ownership. Admin doctor form permits arbitrary `userId`; service does not validate that user belongs to tenant or has clinician role.
- **Evidence:** `opd.service.ts:1456-1533,1587-1649,1691-1845`; `createDoctor/updateDoctor`; schema relation is global `User.id` with no composite tenant key.
- **Impact:** P1 security/clinical integrity.
- **Action:** require clinician assignment for clinical execution, validate same-tenant active user and role, centralize ownership guard, add tenant/ownership tests.

### OPD-P1-004 — Signed/published prescription history is not immutable

- **Finding:** model has `version/status`, but publish upserts a single row, deletes all items, recreates them, never sets `status=PUBLISHED`, and only updates one document ID. This both currently crashes and would overwrite history after repair if kept.
- **Evidence:** `opd.service.ts:1726-1748,1825-1828`; schema `:887-926`.
- **Impact:** P1 legal/clinical record integrity (and part of P0-001 functional block).
- **Action:** explicit DRAFT/PUBLISHED version lifecycle and governed amendment; immutable document linkage per version.

### OPD-P1-005 — Frontend lacks large portions of implemented workflow

- **Finding:** no schedule, appointment, availability, queue, finalize, cancel, draft note, amendment request/approval, refund, settings, document/job observability or retry pages. Admin has only OPD landing, doctors and feature flags. Sidebar and billing link point to missing `/opd/worklist` instead of `/opd/encounters`.
- **Evidence:** source route inventory contains 9 Operator OPD pages and 3 Admin pages; `sidebar.tsx:208`; `billing/page.tsx:73`.
- **Impact:** P1 operator usability; a developer/API client is required for workflow completion.
- **Action:** expose existing canonical APIs in dependency order after backend/contract closure; fix navigation immediately.

### OPD-P1-006 — Feature subflags are aliases, not backend-authoritative boundaries

- **Finding:** registry/seed defines 15 OPD keys. Service universally checks `module.opd`, but only doctor master, intake, prescription and receipt check a subflag. Scheduling/appointments/billing/notes/vitals endpoints ignore their named subflags. Operator billing only checks module flag. Mixed names (`module.opd.prescription` and `opd.prescription`, plus stale providers/doctor_master/free_text flags) coexist.
- **Evidence:** registry `apps/api/src/feature-flags/registry.ts:238-427`; seed `:61-77`; service feature checks found only at `:980,1015,1023,1071,1209,1337,1693,1969`.
- **Impact:** P1 product entitlement/tenant configuration is misleading.
- **Action:** define one canonical matrix, enforce on backend endpoints, return resolved capabilities to UI, remove or classify aliases.

### OPD-P1-007 — Repeat vitals and encounter/payment status reconciliation are incomplete

- **Finding:** schema supports many vitals but the only command transitions REGISTERED to INTAKE_COMPLETE and rejects replay. `paymentStatus` is updated only for immediate registration payment; later invoice payments/refunds do not synchronize OpdEncounter. Appointment and encounter lifecycle similarly diverge.
- **Evidence:** `recordIntake :1335-1435`; `recordPayment/refund`; `createRegistration :1312-1315`.
- **Impact:** P1 clinical history/read-model correctness.
- **Action:** separate repeat-vital append command from intake transition; derive or transactionally synchronize financial and appointment read state.

### OPD-P1-008 — Contract validation is bypassed inside OPD frontend

- **Finding:** no raw fetch/Axios was found, which is good, but many calls cast both path and body to `any`. That permitted stale routes and incompatible DTOs to compile while all API/Admin/Operator typechecks passed.
- **Evidence:** all three typechecks exited 0; billing pages contain repeated `as any`; wrong paths produced authenticated 404.
- **Impact:** P1 governance enforcement failure.
- **Action:** prohibit `as any` around SDK calls in lint/CI and use generated operation types.

### OPD-P2-001 — Contract schemas themselves contain defects

- **Finding:** `OpdDoctorListResponse` omits declared `pagination` property despite backend returning it; `OpdCanonicalScheduleCreateRequest` oddly contains a `pagination` property; error responses/validation coverage are uneven.
- **Evidence:** `openapi.yaml:2210-2245`.
- **Impact:** P2 after primary contract closure.
- **Action:** schema review and response-validation tests.

### OPD-P2-002 — Idempotency is not transactionally atomic with side effects

- **Finding:** `withCommandIdempotency` holds an advisory lock/log transaction but executor functions use `this.prisma` outside the provided transaction client. If command-log insert/outer commit fails after side effects, replay semantics can diverge.
- **Evidence:** `opd.service.ts:150-204` and executor implementations.
- **Impact:** P2 for most commands; P1 for financial/clinical publish.
- **Action:** pass transaction client through command executors and audit/document outbox boundaries; add crash/replay tests.

### OPD-P2-003 — Current docs and names retain superseded KMVP/legacy vocabulary

- **Finding:** active operation/schema names still include `Kmvp`; PDF has fallback `opdVisitId`; historical migrations/docs contain retired models. These are not active duplicates but increase drift risk.
- **Evidence:** schema names/maps, operation IDs, `apps/pdf/Program.cs:1805`.
- **Impact:** P2 cleanup after release closure.
- **Action:** classify compatibility fallbacks and rename only through contract/migration-safe plan; do not delete historical migrations.

## Shared core versus OPD-specific assessment

Correctly reused today:

- Auth issuer/JWT/refresh, tenant resolver, users/roles/permissions.
- `Patient` and shared `Encounter` (OPD creates `moduleType='OPD'`).
- Shared `Invoice`, `InvoiceLine`, `Payment` and tenant sequences.
- Shared audit service and correlation ID headers.
- Shared `Document`/template/hash/BullMQ/worker/PDF/MinIO path.
- Shared tenant feature storage/registry and generated SDK transport.

OPD-specific and appropriate:

- Doctor profile, schedule, appointment, OPD clinical encounter, vitals, notes, prescription items, OPD settings and command idempotency metadata.

Reconciliation concerns:

- `OpdEncounter` duplicates patient and tenant pointers already present on shared Encounter; service must enforce equality transactionally because DB FKs are not composite tenant relations.
- `paymentStatus` duplicates shared Invoice balances/status and already drifts.
- Appointment lifecycle and OPD encounter lifecycle are parallel state machines with no synchronization after check-in.
- Doctor `userId` relation is not structurally tenant-scoped.
- There is no second auth/tenant/document architecture, which is positive; the defects are reconciliation and incomplete enforcement, not a separate OPD mini-platform.

## What is absent versus deliberately deferred

Completely absent from current executable OPD:

- Shared LIMS order creation/referral from an OPD consultation; no RIMS/procedure order abstraction.
- Structured diagnosis/ICD catalog.
- Referral workflow.
- Dedicated consultation/visit summary, medical certificate or referral document.
- Drug formulary/catalog (explicitly deferred by MVP spec; free-text medication lines exist).
- Patient portal, reminders, insurance/claims/payment gateway (explicitly deferred).

The minimum coherent release should not add the deferred items. It does need the locked appointment/walk-in, clinical note, prescription, billing/payment and deterministic document scope to work coherently.

## Dependency-ordered OPD release path

### Phase A — Stop active drift and restore executable truth (P0)

1. Freeze one canonical OPD workflow/financial DTO vocabulary.
2. Fix prescription version/upsert lifecycle and add a real-DB regression test.
3. Reconcile OpenAPI billing/registration shapes with shared Invoice/Encounter architecture; regenerate SDK.
4. Remove SDK `as any` at OPD call sites and correct billing command paths/response mapping/navigation.
5. Correct OPD role seed/backfill and provision least-privilege test identities.

### Phase B — Make canonical clinical records safe (P1)

6. Make registration + optional appointment check-in + encounter + invoice atomic and validate patient/doctor/tenant linkage.
7. Require and validate same-tenant clinician ownership for consultation, draft/sign, prescription and amendments.
8. Implement immutable prescription draft/publish/amend version history and robust signed-note amendment semantics.
9. Separate repeat vitals append from the one-time intake transition; reconcile payment/appointment read states.

### Phase C — Close backend feature semantics (P1)

10. Canonicalize and backend-enforce OPD feature/subfeature flags.
11. Finish appointment transition/link synchronization, schedule timezone/effective-date rules and database-safe overlap handling.
12. Make command idempotency/side effects transactionally safe; add concurrency and failure/retry coverage.

### Phase D — Complete real Operator/Admin surfaces (P1)

13. Operator: appointment booking/availability, check-in/queue, complete/cancel, draft recovery, amendment request, correct billing/refund/document flows.
14. Admin: schedules, OPD settings, amendment approval, document/job failure visibility and retry.
15. Every page gets permission/disabled/conflict/validation/loading/empty/retry/download states using generated SDK only.

### Phase E — Release proof

16. Real PostgreSQL tenant A/B and guessed-ID tests for every OPD entity/nested/document/job route.
17. Role/ownership/stale-token/inactive-user/direct-API denial suite with non-super-admin accounts.
18. Full walk-in and appointment browser E2E through completed encounter, payment/refund and published prescription/receipt download.
19. Deterministic same-payload replay, changed-payload version, BullMQ retry/failure injection, PDF content/hash and secure retrieval evidence.
20. Fresh migration/seed, restart/recovery, backup/restore/rollback, Caddy/TLS and production acceptance.

## Commands and exact observed results

```text
git status --short; git rev-parse --abbrev-ref HEAD; git rev-parse HEAD
  -> initially clean; main; 1ffda42e90a77ed86d87486ad0ac7a12dc35e477

docker compose ps
  -> postgres, redis, api, worker, pdf, admin, operator, minio all Up/healthy

pnpm --filter @vexel/api test -- --runInBand opd-workflow opd.service
  -> 2 suites passed; 28/28 tests passed; 16.567s

pnpm --filter @vexel/e2e exec playwright test tests/opd/01-opd-workflow.spec.ts --project=operator
  -> 2/2 passed; 26.3s (page presence plus registration/intake-page presence only)

pnpm --filter @vexel/api typecheck
pnpm --filter @vexel/operator typecheck
pnpm --filter @vexel/admin typecheck
  -> all exit 0

DATABASE_URL=... pnpm --filter @vexel/api exec prisma validate --schema prisma/schema.prisma
  -> schema valid (first attempt without DATABASE_URL failed only because env was absent)

pnpm check:sdk-freshness
  -> generation succeeded and generated SDK diff check passed

rg 'fetch\\(|axios' current OPD UI source
  -> no matches

Authenticated runtime GETs:
  /api/opd/doctors                 -> 200
  /api/opd/canonical-appointments  -> 200
  /api/opd/encounters              -> 200
  /api/opd/encounters/queue        -> 200
  /api/opd/settings                -> 200
  /api/opd/billing/invoices        -> 200

Authenticated billing command path comparison:
  POST .../{id}/issue              -> 404
  POST .../{id}:issue              -> 200
  POST .../{id}/payments           -> 404
  POST .../{id}:record-payment {}  -> 409 (route reached; positive amount required)
  POST .../{id}/receipt            -> 404
  POST .../{id}:generate-receipt   -> 200

Direct Prisma validation of current prescription where key:
  -> PrismaClientValidationError: Unknown argument `tenantId_opdEncounterId`
```

## Audit-caused state/files that must be disclosed

The authenticated route comparison was intended to distinguish route reachability but invoked two real canonical commands on invoice `4eba4c9b-c203-4043-a64e-76ea54678eff`:

- invoice changed from `DRAFT` to `ISSUED` at `2026-09-01 09:38:17.428 UTC`;
- OPD receipt document `3abc09b0-06b7-487b-883c-fd104a81e4a8` was generated and reached `PUBLISHED` for encounter `cfb9c4fc-d8b1-4765-a841-fdf85a09f925`.

No state was deleted or rolled back. This mutation must remain in the final audit disclosure.

Test/typecheck execution also modified generated local artifacts visible in Git status (`apps/admin/tsconfig.tsbuildinfo`, `apps/operator/tsconfig.tsbuildinfo`, `apps/e2e/playwright-report/index.html`, `apps/e2e/test-results/preflight.json`, `apps/e2e/test-results/results.json`). They were not manually edited and were not reverted because concurrent audit work may own overlapping artifacts. The only intentional source/document write by this agent is this findings file.

## Final Stage 2 summary by requested categories

- **A. What already exists:** canonical tenant-scoped OPD schema/migrations, 36 OpenAPI OPD paths and 42 mounted controller operations, generated SDK, mounted OPD/Billing controllers, doctor/schedule/appointment/queue/clinical/billing/document services, shared worker/PDF templates, Operator/Admin pages, flags and permissions.
- **B. Schema/contracts only:** practical repeat-vitals history; some prescription version/status intent; appointment start/complete route intent is absent despite fields.
- **C. Backend only:** schedules/slots, all appointments, queue, draft notes, amendments/approval, finalization/cancellation, refund/settings and correct receipt generation.
- **D. Frontend only/stale:** billing UI expectations and command URL families; `/opd/worklist` navigation. They are not backed by current contract/backend paths.
- **E. Mocked:** most invariant tests use hand-built Prisma mocks; slot/queue/vitals/ownership/refund evidence is mocked.
- **F. Actually connected E2E:** page login/navigation; real patient creation and OPD registration performed by the second browser test; API registration persists shared Patient/Encounter/OpdEncounter/Invoice. It does not complete intake/consultation/document workflow.
- **G. Currently usable by a real operator:** encounter list; patient search/create; walk-in registration; intake form and consultation start are wired, though not release-proven. Prescription and billing command completion are not usable.
- **H. Incomplete/broken:** prescription publish, billing UI, navigation, appointments/schedules/queue UI, finalization/cancel UI, drafts/amendments UI, flag enforcement, role separation, immutable prescription history, atomic registration.
- **I. Architecturally incompatible:** active contract drift masked by `any`; published prescription overwrite design; all-permissions role backfill; optional/unchecked clinical ownership; subfeature flags that do not disable backend functionality.
- **J. Completely absent:** OPD-to-shared orders, structured diagnosis/ICD, referrals, visit summary/certificates, comprehensive OPD tenant/RBAC/document/deployment verification.
