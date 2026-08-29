# OPD Production-Readiness Handoff

**Prepared:** 2026-08-28 UTC
**Repository:** `/home/munaim/srv/apps/vexel`
**Authoritative decision:** `OPD NOT READY`
**Audience:** planning/implementation agent and release owner

## 1. Executive summary

The repository previously declared OPD production-ready while its detailed evidence documents still recorded `NOT READY`. That promotion has been withdrawn. The current implementation has a usable canonical OPD foundation, but it does not yet satisfy the complete OPD release scope.

The planning agent must not change the status to `READY` based only on compilation, unit tests, health checks, or historical LIMS evidence. Every mandatory requirement needs implementation, automated test, browser evidence, and deployment evidence.

### Product decisions already supplied by the release owner

- Workflow: **appointments plus walk-ins**.
- Legacy data: **permanently delete legacy OPD data** after a verified backup; no archive or product access is required.
- Roles: **small-clinic model** — front desk, clinician, and admin.
- Admin may approve clinical amendments and financial corrections.

Permanent deletion is irreversible. The implementation must still take and verify a restorable backup before deletion and must record the explicit approval and before/after row counts.

## 2. Verified current state

### Passing checks

- Prisma schema validation passes.
- Prisma reports 31 migrations and the local database is up to date.
- API lint, typecheck, build, and 33 Jest suites / 250 tests pass.
- SDK regeneration/freshness passes.
- Admin/OpenAPI parity passes.
- Operator/Admin typechecks and production builds pass, with existing React-hook warnings.
- UI color lint passes.
- Full non-nightly Playwright regression passes: 120 passed, 3 skipped.
- Targeted OPD browser checks pass 2/2, but only cover basic pages and use the super-admin identity.
- Rebuilt API smoke passed health, tenant feature enablement, canonical doctor/patient creation, registration, invoice creation, invoice listing, and invoice retrieval.
- Frontend source scan found no raw API `fetch`, Axios, or Prisma imports in Operator/Admin application code.

### Important implementation corrections already made

- The registered legacy `BillingService` was removed from runtime.
- `/api/opd/billing/*` now delegates to the canonical `OpdService`.
- The dropped legacy `opdVisitId` invoice write was removed.
- OPD billing/document/note-signing controller permissions were tightened.
- Obsolete OPD permission names were removed from new-role seed definitions.
- Local E2E API setup now uses `admin.localhost` for Host-based tenant resolution.

### Current blockers

1. The retirement migration directly drops legacy tables and the invoice legacy link without reconciliation, preflight protection, or rollback rehearsal.
2. Scheduling has booking commands but no complete timezone-aware slot/availability contract.
3. Appointment-to-encounter linkage and deterministic queue ordering are incomplete.
4. Clinical drafts, clinician ownership, immutable note/prescription history, and amendments are absent.
5. Payment void, refund, and correction commands are absent.
6. OPD-specific tenant, RBAC, ownership, concurrency, worker, PDF-failure, and retry tests are incomplete.
7. OPD browser coverage is mostly platform/LIMS coverage and authenticates as super-admin.
8. Operator/Admin scheduling, queue, amendments, approvals, and observability surfaces are incomplete.
9. Clean deployment, rollback, Caddy/TLS, restart/recovery, backup/restore, and full OPD workflow evidence are absent.
10. The API image audit reported 13 high and 1 critical dependency advisories.

The detailed register is [`docs/opd/OPD_GAP_REGISTER.md`](docs/opd/OPD_GAP_REGISTER.md).

## 3. Environment requirements

The following must exist before implementation and release verification can be considered complete.

### Source and build environment

- Node.js 20 or newer.
- pnpm 9.15.4 with `pnpm install --frozen-lockfile` succeeding.
- Docker Engine and Docker Compose.
- Playwright Chromium and required runtime libraries installed with `pnpm mcp:playwright:install-browsers`.
- A clean clone/worktree or an explicitly documented working branch.
- No secrets committed to source, fixtures, reports, or screenshots.

### Local/CI services

The complete Compose stack must be available and healthy:

- PostgreSQL 16;
- Redis 7;
- NestJS API;
- BullMQ worker;
- .NET QuestPDF service;
- MinIO object storage;
- Operator Next.js app;
- Admin Next.js app;
- Caddy reverse proxy/TLS route.

Required checks:

```bash
pnpm install --frozen-lockfile
pnpm mcp:playwright:install-browsers
docker compose config --quiet
docker compose up -d
docker compose ps
```

### Database and migration environment

Provide two disposable PostgreSQL targets:

1. an empty database for fresh migration/bootstrap verification;
2. a representative database containing legacy and canonical fixtures.

The representative target must support:

- full logical backup;
- restore to an isolated database;
- row-count/export snapshots before and after migration;
- rollback rehearsal by restoring the pre-migration snapshot;
- no impact to production during rehearsal.

Before permanent legacy deletion, capture and verify:

- backup identifier and restore test result;
- counts and checksums for every legacy OPD table;
- mappings or explicit deletion list;
- signed approval for permanent deletion;
- post-migration counts for all retained canonical entities.

### Tenancy and identity fixtures

Provide or permit creation of:

- Tenant A and Tenant B;
- front-desk user;
- clinician user linked to a specific OPD doctor;
- admin user with amendment and financial-correction approval;
- inactive-user fixture;
- user with stale JWT permissions fixture.

All users must use environment-managed passwords. Browser tests must not use the super-admin as a substitute for every persona.

### Production-like deployment access

The release owner must provide a safe staging or isolated production-like environment with:

- Host-based tenant DNS/routing;
- Caddy configuration and TLS certificate path;
- API, worker, PDF, MinIO, Redis, PostgreSQL, Operator, and Admin logs;
- ability to restart services;
- backup/restore access;
- object-storage inspection;
- job retry/observability access;
- no production data mutation during rehearsal.

### Dependency/security tooling

CI or the release environment must run:

- package vulnerability scan;
- container/image scan;
- secret scan;
- dependency reachability review;
- license/policy checks if required by the deployment organization.

No Critical or High finding may remain unexplained and accepted at final release.

## 4. Implementation work required

### A. Canonical scheduling, availability, and queue

Implement:

- schedule timezone and effective-date evaluation;
- DST-safe availability calculation;
- generated slot endpoint with doctor/date/timezone inputs;
- booking, rescheduling, cancellation, check-in, and no-show commands;
- database conflict protection for overlapping appointments;
- idempotency for retryable commands;
- appointment-to-encounter linkage in one transaction;
- queue position/order based on the approved clinic policy;
- queue list/status endpoints and Operator UI.

Required API behavior:

- all reads and commands tenant-scoped;
- invalid transitions return `409`;
- cross-tenant IDs return safe `404`/`403` without inference;
- every command records actor, tenant, correlation ID, before/after state, and idempotency result.

### B. Clinical workflow and immutable amendments

Implement:

- save/update draft notes;
- clinician-to-user ownership relation and server-side ownership guard;
- validated vitals with repeat history;
- immutable signed-note versions;
- prescription draft and published versions;
- amendment request and approval commands;
- amendment fields: source version, new version, reason, author, approval status, approver, timestamps, preserved content;
- Admin approval UI and audit trail;
- new deterministic document version after approved amendment.

Admin configuration endpoints must never directly mutate signed clinical content or workflow status.

### C. Billing and financial controls

Retain canonical invoice creation, issue, partial payment, balance calculation, and receipt generation. Add:

- payment void command;
- refund command;
- correction/adjustment command;
- method/reference validation;
- row locking and idempotency for every financial command;
- immutable financial audit events;
- overpayment, duplicate, invalid-state, cross-tenant, and concurrent-payment protections.

Role rules:

- front desk may perform allowed registration/payment actions;
- clinician may not issue refunds or corrections;
- admin approval is required for financial corrections and refunds according to the approved policy.

### D. Tenant isolation and RBAC

Create a complete permission matrix for front desk, clinician, and admin covering:

- registration;
- scheduling and queue;
- intake and vitals;
- consultation and draft notes;
- signing;
- prescriptions;
- billing and corrections;
- documents;
- amendments and approvals;
- configuration and observability.

Test both API enforcement and UI-hidden actions. Do not treat hidden buttons as authorization.

### E. Documents and workers

For prescriptions, invoices, receipts, and amendments:

- canonicalize payloads;
- calculate stable payload hashes;
- preserve tenant/template/content identity;
- enqueue BullMQ jobs with tenant and correlation IDs;
- render through QuestPDF;
- store bytes in MinIO;
- calculate PDF hashes;
- persist `QUEUED → RENDERING → RENDERED/FAILED`;
- make publication and retries idempotent;
- restrict metadata/downloads by tenant and permission.

Add test-only controlled PDF failure injection. Prove failed jobs, authorized retry, duplicate workers, changed-content new versions, and correct rendered patient/clinician/encounter data.

### F. Migration retirement

Because the release owner authorized permanent legacy deletion:

- replace unconditional destruction with a guarded migration/preflight process;
- require verified backup and signed deletion approval;
- export/count legacy data before deletion;
- verify the empty and representative database paths;
- rehearse restore rollback;
- record exactly what was deleted and what canonical data remains.

Do not perform this against production until the isolated rehearsal passes.

### G. Operator and Admin completion

Operator must cover registration, appointments, availability, queue, intake, consultation, drafts, signing, prescriptions, completion, cancellation, billing, documents, and amendment requests.

Admin must cover tenant OPD enablement, doctors, schedules, billing configuration, document/job observability, retry operations, and amendment/financial approvals.

Each page needs loading, empty, validation, disabled-feature, permission, not-found, conflict, retry, accessibility, and responsive states.

## 5. Verification plan

### Automated gates

Run and retain output for:

```bash
pnpm --filter @vexel/api exec prisma validate
pnpm check:sdk-freshness
pnpm check:admin-openapi-parity
pnpm lint
pnpm typecheck
pnpm build
pnpm ui:color-lint
pnpm --filter @vexel/api test -- --runInBand
pnpm --filter @vexel/e2e test
```

Add dedicated suites for scheduling concurrency, queue ordering, registration rollback, clinician ownership, amendments, refunds/corrections, tenant isolation, RBAC, document failure/retry, and migration reconciliation.

### Browser journeys

Run with real least-privilege users:

1. login and tenant resolution;
2. disabled OPD feature denial;
3. patient registration;
4. appointment booking and availability;
5. walk-in registration;
6. queue/check-in/no-show;
7. intake and repeat vitals;
8. clinician consultation and draft note;
9. note signing;
10. prescription draft/publication/download;
11. invoice/partial payment/refund/correction;
12. amendment request and admin approval;
13. deterministic document reprint;
14. invalid transitions and permission denials;
15. reload persistence, logout, restart recovery, and cross-tenant denial.

### Deployment gates

Prove from a clean environment:

- database initialization, migrations, and seed;
- Host-based tenant resolution;
- OPD feature enablement;
- complete workflow through worker/PDF/document retrieval;
- audit and correlation IDs;
- service restart/recovery;
- Caddy/TLS routing;
- backup/restore and rollback.

## 6. Evidence and status rules

Update these artifacts only from current executions:

- `docs/opd/OPD_RELEASE_READINESS.md`;
- `docs/opd/OPD_GAP_REGISTER.md`;
- `docs/opd/OPD_TEST_EVIDENCE.md`;
- `docs/opd/OPD_DEPLOYMENT_EVIDENCE.md`;
- `docs/opd/OPD_DOCUMENT_EVIDENCE.md`;
- `docs/opd/OPD_TENANCY_SECURITY_EVIDENCE.md`;
- `docs/opd/OPD_REQUIREMENTS_TRACEABILITY.md`;
- `docs/releases/OPD_RELEASE_SCOPE.md`;
- `docs/releases/OPD_RELEASE_LEDGER.md`.

Use a dated evidence directory containing command output, migration counts, backup/restore IDs, browser traces/screenshots, document hashes, and deployment logs.

The final decision must be:

- `OPD NOT READY` if any mandatory gate is missing, failed, unaudited, or based only on historical evidence;
- `OPD PRODUCTION READY` only when every mandatory gate passes, all Critical/High findings are closed, no P0/P1 defect remains, evidence is current and consistent, and Git is clean.

## 7. Release-owner inputs still required

The following are still required from the release owner/environment owner:

- staging or isolated production-like deployment access;
- verified backup/restore target;
- permission to create Tenant B and least-privilege test users;
- confirmation of the clinic’s queue ordering rule;
- exact refund/correction approval thresholds, if any;
- confirmation that permanent legacy deletion is authorized after backup (already stated, but must be recorded in the migration approval artifact);
- dependency remediation policy and deadline;
- production compliance/retention requirements for clinical, financial, document, and audit records.

## 8. Handoff instruction

The planning agent should use this report as the execution contract, preserve the `NOT READY` status while work is incomplete, and close gaps in the order: migration safety, scheduling/queue, clinical/amendments, billing, tenancy/RBAC, documents/workers, UI, deployment, then final evidence.
