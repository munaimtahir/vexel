# OPD Technical Completion Prompt

You are the implementation agent for `/home/munaim/srv/apps/vexel`.

Complete all remaining OPD implementation work and change the release status to `OPD PRODUCTION READY` only after every mandatory gate passes.

## Current state

- Canonical workflow:
  `REGISTERED → INTAKE_COMPLETE → IN_CONSULTATION → NOTE_SIGNED → PRESCRIPTION_PUBLISHED → COMPLETED`
- Separate `signNote` command exists.
- Canonical `OpdSchedule` and `OpdAppointment` schema exists.
- Canonical scheduling is partially implemented.
- Legacy Provider, ProviderSchedule, Appointment, OPDVisit, OPDVitals, OPDClinicalNote, and OPDPrescription models/routes/UI still coexist.
- API baseline is green, but OPD release remains `NOT READY`.
- Preserve existing history and commits. Do not use destructive Git commands.
- Do not weaken or skip mandatory tests.

## Phase 0 — Baseline and governance

1. Inspect branch, HEAD, working tree, migrations, Prisma schema, OpenAPI, API, Operator, Admin, worker, PDF service, Docker, Caddy, and OPD release documents.
2. Read:
   - `docs/releases/OPD_RELEASE_SCOPE.md`
   - `docs/opd/OPD_CANONICAL_WORKFLOW.md`
   - `docs/opd/OPD_GAP_REGISTER.md`
   - `docs/specs/opd/OPD_MVP_SPEC.md`
   - `packages/contracts/openapi.yaml`
   - `AGENTS.md`
3. Maintain `docs/releases/OPD_RELEASE_LEDGER.md` with actual execution evidence only.
4. Never mark a requirement complete without implementation and verification evidence.

## Phase 1 — Canonical scheduling

Use only `OpdDoctor`, `OpdSchedule`, `OpdAppointment`, and `OpdEncounter`.

Implement and test:

- schedule create/list/update/delete;
- timezone-aware availability;
- schedule effective dates;
- slot generation;
- booking;
- rescheduling;
- cancellation;
- check-in;
- no-show;
- queue ordering;
- appointment-to-encounter linkage;
- tenant, doctor, and patient validation;
- overlapping schedule and appointment rejection;
- transaction locking;
- idempotency;
- audit events;
- correlation IDs.

Every command must define source state, destination state, permission, tenant check, validation, idempotency behavior, conflict behavior, audit action, and correlation behavior.

## Phase 2 — Clinical workflow

Complete registration, encounter creation, intake, vitals, consultation start, draft notes, note signing, prescription draft, prescription publication, completion, and cancellation.

Rules:

- Generic CRUD must never mutate workflow status.
- Invalid transitions return `409`.
- Signed notes and published prescriptions cannot be silently edited.
- Clinician ownership must be enforced.
- Every command requires permission and tenant checks.
- Every command is audited, idempotent, and correlation-aware.

Implement governed amendments with immutable version number, source version, amendment reason, author, approval status, approver, timestamps, preserved historical content, and new deterministic document versions where required.

Admin may initiate or approve amendments but must never silently mutate clinical history.

## Phase 3 — Billing

Complete invoice creation and issue, partial payments, concurrent payment protection, balance calculation, payment method/reference, void, refund, correction, receipt generation, and financial audit.

OPD operators must have controlled full finance authority.

Test invalid invoices, overpayments, cross-tenant linkage, duplicate commands, concurrent payments, void/refund/correction state rules, and audit coverage.

## Phase 4 — Legacy retirement

After canonical replacement coverage is complete:

1. Remove legacy Provider, ProviderSchedule, Appointment, OPDVisit, OPDVitals, OPDClinicalNote, and OPDPrescription routes, services, UI, models, and relations.
2. Remove obsolete OpenAPI paths and schemas.
3. Add a safe retirement migration.
4. Verify no active legacy OPD runtime references remain.

No legacy OPD production data requires preservation because the approved decision states that no prior production OPD data exists.

## Phase 5 — OpenAPI and SDK

Update `packages/contracts/openapi.yaml` to describe only canonical OPD behavior, including schemas, read models, create/update requests, commands, responses, pagination, filtering, validation, authorization, tenant errors, `404`, `409`, scheduling, appointments, queue, clinical workflow, amendments, billing, documents, and feature flags.

Regenerate the SDK using the canonical generator.

Verify OpenAPI validation, SDK generation, SDK freshness, frontend SDK-only usage, and absence of raw OPD fetch/Axios transport.

## Phase 6 — Authorization and tenancy

Use the existing authentication/RBAC system. Implement least-privilege permissions for encounter, intake, consultation, notes, prescriptions, scheduling, appointments, queue, billing, documents, amendments, and configuration.

Test unauthenticated access, unauthorized users, authorized operators, clinicians, finance operators, Admin, removed permissions after JWT issuance, inactive accounts, super-admin, tenant admins, cross-tenant access, direct API bypasses, disabled OPD, disabled subfeatures, guessed UUIDs, nested relations, pagination, and search leakage.

Every OPD customer-owned query must include tenant context.

## Phase 7 — Documents and workers

Use the existing deterministic asynchronous document pipeline.

For every OPD document: construct canonical JSON, normalize ordering and values, compute `payloadHash`, create deterministic identity, enqueue BullMQ work, propagate tenant and correlation IDs, render through the PDF service, store bytes, compute `pdfHash`, transition status, publish idempotently, and audit generation/failure/retry/publishing.

Add test-only PDF failure injection.

Prove deterministic hashes, safe duplicate delivery, recoverable failures, safe retries, new versions for changed clinical input, correct PDF content/layout, and cross-tenant document isolation.

## Phase 8 — Operator and Admin

Move all OPD frontend behavior to canonical routes and generated SDK calls.

Operator must support patient registration, booking, availability, check-in, queue, intake, vitals, consultation, note drafting/signing, prescription publishing, completion, cancellation, billing, documents, and amendment requests where applicable.

Admin must support doctor configuration, schedules, feature flags, OPD/billing configuration, document observability, failed-job retry, amendment approval, and tenant creation.

Admin must never directly mutate workflow state.

Cover loading, empty, validation, disabled actions, permission denied, feature disabled, `404`, `409`, retry, document failure, responsive layouts, and accessibility.

## Phase 9 — Mandatory tests

Remove mandatory skips and implement:

- state-machine tests;
- command idempotency tests;
- registration transaction tests;
- scheduling overlap tests;
- concurrent booking tests;
- queue tests;
- tenant-isolation tests;
- RBAC and clinician ownership tests;
- billing concurrency tests;
- amendment immutability tests;
- document hash/idempotency tests;
- PDF failure/retry tests;
- worker restart/retry tests;
- Admin tenant-creation browser test;
- Operator canonical workflow browser test;
- API integration tests;
- frontend tests;
- browser E2E tests;
- full repository regression tests.

Do not skip, weaken, or relabel mandatory failures as expected failures.

## Phase 10 — Fresh deployment

Build and verify a clean deployment containing PostgreSQL, Redis, API, worker, PDF service, Operator, Admin, and Caddy/reverse proxy.

Verify fresh database initialization, migrations, seed/bootstrap, authentication, Host-based tenant resolution, feature enablement, appointment booking, queue, clinical workflow, billing, worker processing, PDF rendering, audit events, restart/recovery, and public HTTPS routing.

Do not rely on development-only `x-tenant-id` behavior as production evidence.

## Phase 11 — Browser and security audit

Run real browser tests against the integrated backend for login, tenant resolution, navigation, patient registration, scheduling, queue, intake, consultation, note signing, prescription publication, billing, documents, permissions, feature flags, persistence, invalid transitions, and logout/session behavior.

Perform adversarial tests for cross-tenant UUIDs, document URLs, nested relations, pagination, search, command endpoints, direct workflow-status mutation, stale permissions, disabled features, malformed clinical data, excessive payloads, and sensitive logging.

No Critical or High security issue may remain.

## Phase 12 — Final release gate

Run formatting, lint, TypeScript, Prisma, migration, SDK freshness, OpenAPI, API build, frontend builds, worker build, PDF build, unit, integration, contract, browser E2E, smoke, security, concurrency, and full repository regression checks.

Update:

- `docs/releases/OPD_RELEASE_SCOPE.md`
- `docs/opd/OPD_GAP_REGISTER.md`
- `docs/opd/OPD_TEST_EVIDENCE.md`
- `docs/opd/OPD_DEPLOYMENT_EVIDENCE.md`
- `docs/opd/OPD_RELEASE_READINESS.md`
- `docs/releases/OPD_RELEASE_LEDGER.md`
- requirements-to-evidence traceability matrix;
- OPD smoke documentation;
- operations runbook.

The ledger must record timestamps, phases, summaries, files, migrations, commands, tests, results, failures, fixes, commit SHAs, evidence paths, and deferred external items.

## Final decision rule

Set the final status to `OPD PRODUCTION READY` only if all of the following are true:

- canonical OPD model only;
- legacy runtime removed;
- complete workflow, scheduling, queue, billing, and amendments;
- tenant isolation;
- RBAC and ownership;
- backend-authoritative feature flags;
- audit and correlation IDs;
- deterministic documents;
- reliable workers;
- complete API, frontend, browser, security, concurrency, and regression tests;
- fresh public-like deployment passes;
- smoke tests pass;
- documentation and traceability are complete;
- no Critical or High security issues remain;
- no P0 or P1 defects remain;
- Git working tree is clean.

If any mandatory requirement is incomplete, the final status must remain `OPD NOT READY`.

Never claim readiness based only on compilation, unit tests, mock mode, historical LIMS evidence, partial deployment, health checks, incomplete browser coverage, skipped tests, or undocumented manual verification.
