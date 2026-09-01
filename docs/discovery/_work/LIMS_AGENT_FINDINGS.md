# Stage 1 LIMS Production Readiness — Agent Findings

Audit date: 2026-09-01 UTC
Auditor lane: LIMS workflow, authentication/RBAC, tenancy, documents, deployment, quality gates
Repository: `/home/munaim/srv/apps/vexel`

## Verdict

```text
LIMS RELEASE STATUS

NOT READY
```

The stack is runnable and a single-test LIMS path works, but production release is blocked by three independently sufficient P0 conditions:

1. The live public deployment accepts a repository-known super-admin password while Compose runs the API in development mode and contains fixed infrastructure credentials.
2. A multi-test encounter can be marked `verified` and rendered into a report after only one order has a result; another order remains `ordered` with zero results. The current E2E test calls this a passing happy path.
3. The audit explorer is structurally cross-tenant: `tenantId` is optional and client-controlled, and a tenant-admin is granted `audit.read`.

Command/audit persistence is also non-atomic: workflow state commits before the required audit insert. A failed audit returns an error after the clinical mutation has already persisted.

No application code was changed. The only repository file authored by this lane is this finding draft. Automated E2E tests created normal test patients, encounters, orders, refresh tokens, documents, and audit rows in the live local `system` tenant. `pnpm check:sdk-freshness` regenerated SDK files but left no generated diff. No cleanup or deletion was performed.

## Baseline and runtime

| Item | Evidence |
|---|---|
| Branch / HEAD | `main`, `1ffda42e90a77ed86d87486ad0ac7a12dc35e477` (`docs(opd): refresh readiness evidence after hardening`) |
| Initial worktree | Clean: `## main...origin/main` before audit actions |
| Documentation conflict | `AGENTS.md` still states HEAD `2287b59` and all phases complete; executable HEAD is `1ffda42` |
| Compose runtime | `postgres`, `redis`, `minio`, `api`, `worker`, `pdf`, `admin`, `operator` all `running (healthy)` |
| Database migration state | 33 migrations applied; zero incomplete/rolled back; API startup says `No pending migrations to apply` |
| Public front door | `https://vexel.alshifalab.pk/` 307; `/api/health` 200; `/admin/login` 200; `/lims/worklist` 307; Caddy block at `/home/munaim/srv/proxy/caddy/Caddyfile:598` correctly routes API/Admin/Operator/PDF/MinIO |
| Deep health | `/api/health/deep` 200 with `db`, `redis`, `worker`, `pdf`, `storage`, and `queue` all `ok` |
| Seeded tenancy | Current DB contains only one tenant (`system`) and three domains (`admin.localhost`, `localhost`, `vexel.alshifalab.pk`) |
| Runtime mode | API and worker have `NODE_ENV=development`; `TENANCY_DEV_HEADER_ENABLED=false` |

The local IP login returning 401 `Tenant context not resolved` without a tenant-mapped Host is expected under host-based resolution. Login with `Host: vexel.alshifalab.pk` succeeds. The E2E helper correctly uses `http://admin.localhost:9021` for API login.

## Test and quality gate results

| Command | Exact result | Qualification |
|---|---|---|
| `pnpm --filter @vexel/api test -- --runInBand` | 33 suites passed; 257 tests passed; 0 failed; 25.08s | Console output from encounter workflow tests shows mocked side effects failing (`encounterCode`, `SpecimenItem`, receipt) while the tests still pass. |
| `pnpm --filter @vexel/e2e e2e:auth` | 10 passed; 0 failed | Proves UI login/logout, invalid credentials, operator/super-admin login, API logout 204, and refresh rejection after logout. |
| `pnpm --filter @vexel/e2e e2e:tenancy` | 4 passed; 0 failed | Proves spoofed `x-tenant-id` is rejected for patient/encounter reads. It does not use two real tenants. |
| `pnpm --filter @vexel/e2e e2e:lims` | 9 passed; 0 failed | Includes single test, multi-test, invalid transitions, UI result validation. The multi-test assertion is clinically false-positive (LIMS-P0-002). |
| `pnpm --filter @vexel/e2e e2e:documents` | 5 passed; 2 skipped | Happy render/download and basic idempotency pass. Both failure/retry tests are globally skipped. One “explicit retry” test silently returns on 404/405. |
| `pnpm check:sdk-freshness` | PASS, no generated diff | OpenAPI to SDK generation is fresh. |
| `pnpm check:admin-openapi-parity` | PASS, 154 endpoint references across 60 files | Static reference parity only, not backend implementation proof. |
| `pnpm lint` | Exit 0 | Numerous React hook dependency warnings; no lint errors. |
| `pnpm typecheck` | 6 tasks successful | API, SDK, worker, operator, admin passed. |
| `pnpm build` | 5 tasks successful | API/worker/SDK and production Next builds passed; Turbo replayed cached build logs. |

Not run in this lane: destructive failure injection, restore apply, a clean-host rebuild, full unfiltered Playwright suite, load/performance tests, and a real two-tenant browser workflow.

## Real LIMS workflow trace

Legend: **Proven** = current runtime or automated current-code evidence; **Partial** = implementation exists but evidence/semantics are incomplete; **Fail** = release-affecting behavior is wrong.

| Transition | Contract / SDK / Backend | Auth / tenant / state / audit | Frontend / runtime / test | Assessment |
|---|---|---|---|---|
| Patient registration | Present; frontend uses generated SDK; service queries and uniqueness are tenant-scoped | `patient.manage`; audit written after create | Single/multi LIMS setup and patient tests pass | Proven for one tenant |
| Encounter registration | `POST /encounters`; command-style creation | `encounter.manage`; `module.lims`; patient tenant checked; audit | Runtime E2E passes | Proven for one tenant |
| Lab order | `POST /encounters/{id}:order-lab`; UI loops once per selected test | Permission and tenant checks; only `registered`/`lab_ordered`; audit | Runtime supports multiple selected tests | Partial: financial/receipt/specimen side effects are non-fatal; multi-order state model is broken downstream |
| Sample collection | Both classic specimen command and newer `SpecimenItem` command family exist | Classic command checks transition and tenant, but collects only the first ordered lab order | Invalid double collect returns 409; UI paths exist | Partial: duplicate specimen architectures and multi-order semantics are not reconciled |
| Sample receipt | Contract/backend/UI exist; feature-flag-controlled separate receive path | Tenant and state checks in classic path | Not independently exercised by the selected LIMS E2E lane; sample UI may auto-receive | Implemented, insufficiently verified |
| Result save/submit | Legacy encounter `:result` and ordered-test `:save`/`:submit` pathways coexist | Permissions/tenant checks; late-entry locking implemented in ordered-test path | Result validation/high flag tests pass | Partial: legacy `:result` advances entire encounter after one order |
| Verification | Legacy encounter `:verify` plus queue-oriented verification endpoint | `result.verify`; invalid early verify returns 409; audit called | Single-test verify works | **Fail for multi-order**: entire encounter verifies while an order is untouched |
| Report generation/render | Generated SDK → API → BullMQ `document-render` → PDF → MinIO; hashes persisted | Tenant-aware identity and job data; correlation propagates to worker/PDF/audit | Recent documents are `RENDERED`, with non-null `payloadHash`, `pdfHash`, and `storageKey` | Proven happy path; failure recovery unproven |
| Report publication | `POST /encounters/{id}:publish-report`; manual command and audit | Requires `document.publish`, checks tenant and document state; repeat is designed idempotently | Publish page exists | Partially proven; selected document suite never calls manual publish and misleading verification UI says auto-publish |
| Download | SDK endpoint, tenant-scoped document lookup, MinIO read | Requires `document.generate` | Browser test passes and link is visible | Proven happy path |

### Runtime clinical-integrity evidence

The passing test `apps/e2e/tests/lims/02-happy-path-multi-parameter.spec.ts:34-95` explicitly:

- orders `t1` and `t2`;
- collects only once;
- enters a result for the first lab order only;
- says additional results get 409 “by design”; and
- accepts encounter-level `verified` as success.

After the 9/9 LIMS run, current DB evidence for encounter `115a2faf-1e2a-4f00-b293-6c7c926fd2f0` was:

| Encounter status | Test | Lab order status | Result status | Result rows |
|---|---|---|---|---:|
| `verified` | `t1` | `verified` | `PENDING` | 1 |
| `verified` | `t2` | `ordered` | `PENDING` | 0 |

The same persisted pattern existed on another prior MultiTest record. Code cause: `enterResult()` sets the whole encounter to `resulted` after one lab order (`encounters.service.ts:408-426`); `verify()` updates only lab orders already in `resulted` but unconditionally marks the encounter `verified` (`:440-449`). `generateFromEncounter()` includes all lab orders, so an incomplete report is then rendered.

## Authentication and authorization assessment

### Proven

- Login is tenant/domain-scoped (`AuthService.login`, `where: { email, tenantId, status: 'active' }`).
- Access token lifetime is exactly one hour in code and response (`auth.service.ts:60,85`).
- Refresh tokens are DB-persisted as bcrypt hashes with a seven-day lifetime; DB observed 178 rows with TTLs of approximately seven days.
- Refresh rotation revokes the matched row then creates a new row (`auth.service.ts:90-151`).
- Logout revokes all active refresh rows for the user; browser/API E2E proves subsequent refresh rejection.
- JWT validation reloads user activation, super-admin status, roles, and permissions from DB on each request (`jwt.strategy.ts:17-43`).
- Authenticated requests reject an `x-tenant-id` different from the JWT tenant and overwrite request tenant context with the JWT tenant (`jwt-auth.guard.ts:16-30`).
- Workflow controllers declare explicit permissions; invalid classic transitions return 409 in runtime tests.

### Gaps

- Public default credentials are active (LIMS-P0-001).
- Refresh lookup loads every unrevoked/unexpired refresh token across all tenants and performs sequential bcrypt comparisons (`auth.service.ts:92-107`). Current DB already has 119 active rows. This is an avoidable scaling/DoS risk.
- JWT strategy has a development fallback secret rather than failing startup when `JWT_SECRET` is absent (`jwt.strategy.ts:13`). Compose also provides a fallback.
- Returned `roles` come from the token payload while permissions and super-admin state are live. Stale role names are mostly presentational, but the trust model should be consistent.

## Tenancy red-team assessment

### What is proven

- Customer LIMS models inspected (`Patient`, `Encounter`, `LabOrder`, `Specimen`, `SpecimenItem`, `LabResult`, `Document`, catalog mappings, audit) carry `tenantId`; significant natural uniques are tenant-scoped.
- Patient, encounter, result, specimen, verification, document, and catalog service entry queries generally include tenant scope or derive child IDs from a tenant-scoped parent.
- Four runtime spoof-header tests pass with 403/404; the JWT guard prevents development-header escape.
- Host-based login resolution works for `vexel.alshifalab.pk`; wrong/unmapped hosts cannot establish a tenant for login.

### What is not proven

- There is only one actual tenant in the runtime DB. The tests use fictitious headers, not two tenant-owned datasets and identities.
- Cross-tenant coverage is limited to patients and encounters. It does not prove documents, results, catalog, users, jobs, or audit events against a second real tenant.
- Audit events are demonstrably structurally unsafe (LIMS-P0-003).
- The generic jobs endpoints neither monitor real queues nor tenant-filter job data (LIMS-P1-006).

## Deterministic document pipeline assessment

### Proven happy path

- `generateDocument()` normalizes selected volatile fields, hashes payload, and uses DB uniqueness `(tenantId, type, templateId, payloadHash)`.
- Repeated recent lab report sources each had one document and one payload hash.
- BullMQ jobs carry `documentId`, `tenantId`, and `correlationId`, use 3 attempts with exponential backoff, and worker sends correlation to the PDF service.
- Current recent LAB_REPORT rows have non-null SHA-256-like `payloadHash`, `pdfHash`, and tenant-prefixed MinIO `storageKey`.
- Worker persists `document.rendered` audit with the same correlation ID as `document.generate`.
- LAB_REPORT is not worker-auto-published; it remains `RENDERED` pending the audited encounter publish command. Receipt types auto-publish.
- Download via the authenticated frontend is runtime-tested.

### Gaps

- The serializer named `canonicalJson` is not JSON: strings are not quoted/escaped and `null`/`undefined` both become empty strings. For example, string `"1"` and number `1` serialize identically. This permits payload identity collisions (LIMS-P1-007).
- New documents start at `RENDERING`, not the locked `QUEUED → RENDERING` lifecycle (`documents.service.ts:227-265`).
- Failure/retry browser tests are globally skipped, and there is no document-specific retry endpoint. Regenerating a FAILED identity can requeue it internally, but no reliable operator/Admin recovery path is proven.
- The API jobs UI watches queue `jobs`; the worker explicitly documents that actual queues (`document-render`, catalog queues, `ops-backup`) are invisible.
- Encounter verification catches document enqueue/generation errors and still returns success. Without a real failed-document worklist/retry path, a clinically verified encounter can have no recoverable report.
- Immutable-history behavior after a published report and subsequent correction/amendment was not proven in this lane.

## Findings ledger

### LIMS-P0-001

- **Module:** Platform / LIMS
- **Area:** Production deployment security
- **Finding:** The live public API accepts the repository-known super-admin credential. The API/worker run in development mode, Swagger is public, and Compose embeds/falls back to fixed Postgres, MinIO, storage, and JWT secrets.
- **Evidence:** `curl ... https://vexel.alshifalab.pk/api/auth/login` with seeded `admin@vexel.system` credential returned 200; `/api/docs` returned 200. `docker-compose.yml:6-8,35-36,78-88,114-120`; `apps/api/prisma/seed.ts:187-211`; API startup logs print the password.
- **Current State:** Publicly reachable development-style deployment with active bootstrap credentials.
- **Expected State:** Production mode; no known/default accounts; secrets supplied from protected environment/secret store; bootstrap forces credential rotation and never logs a password; Swagger disabled or restricted.
- **Severity:** P0 / Critical
- **Release Impact:** Immediate production release blocker and current public security incident exposure.
- **Recommended Action:** Rotate/revoke all seeded public credentials and JWT/storage/DB credentials, invalidate sessions, remove password logging/default fallbacks, make production startup fail closed on absent secrets, set `NODE_ENV=production`, and review access/audit logs.
- **Dependencies:** Deployment owner, secret rotation, database/MinIO restart plan.
- **Verification Required:** Known credentials fail publicly; old JWT/refresh tokens fail; secret scan clean; production-mode headers/cookies/Swagger verified; incident review completed.

### LIMS-P0-002

- **Module:** LIMS
- **Area:** Multi-test workflow / clinical integrity
- **Finding:** One test result advances the whole encounter to `resulted`; verify marks the encounter verified while other orders remain ordered/unresulted, then generates a report containing the incomplete order set.
- **Evidence:** Runtime DB table above; `encounters.service.ts:391-449`; `order/page.tsx:56-70` exposes multi-select orders; false-positive E2E at `lims/02-happy-path-multi-parameter.spec.ts:34-95` passed.
- **Current State:** Executable, tested, clinically incorrect multi-order behavior.
- **Expected State:** Per-order state remains authoritative; encounter becomes resulted/verifiable only when all required active orders/results meet policy; incomplete orders block verify with 409; report contains only an explicitly valid immutable verified set.
- **Severity:** P0 / Critical
- **Release Impact:** Can publish an incomplete/incorrect patient report.
- **Recommended Action:** Reconcile legacy encounter commands with ordered-test workflow, define aggregate transition invariants, block verification if any required order/result is pending, and replace the false-positive E2E with assertions over every order and report payload.
- **Dependencies:** Locked LIMS workflow decision for partial results/cancellations and specimen grouping.
- **Verification Required:** Multi-test browser/API E2E; pending/partial/cancelled variants; DB and PDF payload assertions; invalid verify returns 409.

### LIMS-P0-003

- **Module:** Shared platform / Admin
- **Area:** Audit tenant isolation
- **Finding:** `GET /audit-events` accepts optional client `tenantId`; when omitted the Prisma filter is `{}` and returns all tenants. Tenant-admin is granted `audit.read`.
- **Evidence:** `audit-events.controller.ts:16-41`; `audit.service.ts:62-92`; `seed.ts:145-180`.
- **Current State:** Structurally cross-tenant query path, masked by a one-tenant runtime.
- **Expected State:** Actor tenant injected server-side; only an explicit platform-super-admin endpoint may query across tenants, with audited purpose and contract distinction.
- **Severity:** P0 / Critical
- **Release Impact:** Multi-tenant confidentiality breach once a second tenant exists.
- **Recommended Action:** Remove tenant choice from tenant-admin path; pass authenticated tenant to service; add mandatory tenant where; add two-real-tenant negative tests.
- **Dependencies:** Contract/API reconciliation if platform audit search remains required.
- **Verification Required:** Tenant admin cannot read or infer another tenant’s events; super-admin behavior explicitly tested.

### LIMS-P0-004

- **Module:** Shared platform / LIMS
- **Area:** Command audit atomicity
- **Finding:** Commands commit workflow/financial/admin changes and only then insert required AuditEvent. If audit insertion fails, the API reports failure but the state mutation remains.
- **Evidence:** Example verify transaction commits at `encounters.service.ts:440-449`, audit follows at `:451`; publish mutates document and encounter before audit at `:491-519`. `AuditService` correctly throws for required mode, but it cannot roll back prior commits.
- **Current State:** Audit-required in error handling, not transactionally guaranteed.
- **Expected State:** State change and audit event commit atomically in one Prisma transaction/outbox boundary.
- **Severity:** P0 / Critical
- **Release Impact:** Violates non-negotiable auditability; can leave unaudited clinical state.
- **Recommended Action:** Make command mutation + AuditEvent transactional (or durable transactional outbox); avoid nested service transactions that separate audit.
- **Dependencies:** Audit service transaction-client support and command service refactor.
- **Verification Required:** Fault-injection tests prove audit failure rolls back command state for every critical transition.

### LIMS-P1-005

- **Module:** LIMS documents
- **Area:** Failure recovery
- **Finding:** Report generation is best-effort after clinical verification, but failed render/retry is not operationally proven and no document-specific retry UI/API exists.
- **Evidence:** `encounters.service.ts:453-464`; globally skipped tests `documents/03-render-failure-retry.spec.ts:12-44`; document E2E result 5 passed/2 skipped.
- **Current State:** Happy path works; failure handling is unverified and operationally incomplete.
- **Expected State:** FAILED visible to authorized staff, safe retry command, preserved correlation/error evidence, and end-to-end recovery test.
- **Severity:** P1 / High
- **Release Impact:** A verified patient may be stranded without a report.
- **Recommended Action:** Implement/contract a tenant-safe audited retry command or documented regeneration path, surface it in the real queue/Admin UI, and enable controlled failure injection in CI/nightly acceptance.
- **Dependencies:** LIMS-P1-006 queue reconciliation.
- **Verification Required:** Inject failure → FAILED → retry → RENDERED → publish → download, with same logical document identity.

### LIMS-P1-006

- **Module:** Infrastructure / Admin
- **Area:** Jobs observability and retry
- **Finding:** `/jobs` monitors queue `jobs`, while no worker consumes it; actual queues are `document-render`, `catalog-import`, `catalog-export`, and `ops-backup`. Job listing/retry also has no tenant filter.
- **Evidence:** `jobs.service.ts:6-100`; explicit worker comment `worker/src/main.ts:69-73`.
- **Current State:** Jobs dashboard is misleading/empty and cannot operate real document failures.
- **Expected State:** Real queue registry, tenant-aware job metadata/filtering, least-privilege visibility, and queue-specific audited retry.
- **Severity:** P1 / High
- **Release Impact:** Operational failures are invisible and unrecoverable through the advertised Admin capability.
- **Recommended Action:** Replace dummy queue service with real queue adapters and tenant constraints; redact job payloads.
- **Dependencies:** Queue contract and retry policy.
- **Verification Required:** Seed failures in each queue and verify correct tenant visibility/retry.

### LIMS-P1-007

- **Module:** Documents
- **Area:** Canonical payload identity
- **Finding:** `canonicalJson` is deterministic text but not canonical JSON and is type-collision-prone.
- **Evidence:** `canonical.ts:3-13`: primitive values use `String`, strings are unquoted/unescaped, null/undefined collapse.
- **Current State:** Idempotency works for tested payloads; uniqueness is not collision-safe across JSON types/content.
- **Expected State:** Standards-consistent canonical JSON preserving types and escaping, with golden vectors and migration/versioning strategy.
- **Severity:** P1 / High
- **Release Impact:** Distinct clinical payloads can share a logical identity/hash and reuse the wrong artifact.
- **Recommended Action:** Use a well-tested canonical JSON algorithm, version hash semantics, add collision/type/order/unicode vectors, and assess existing document compatibility.
- **Dependencies:** Document identity migration decision.
- **Verification Required:** Golden hash tests, collision negatives, repeat rendering against real payloads.

### LIMS-P1-008

- **Module:** LIMS frontend
- **Area:** Verification/publication wiring
- **Finding:** Main verification UI says report auto-publish started and no manual action is required, but worker intentionally leaves LAB_REPORT at `RENDERED` and the page redirects after three seconds.
- **Evidence:** `verification/.../page.tsx:130-205` and success copy below line 260; worker `AUTO_PUBLISH_TYPES` excludes LAB_REPORT; recent runtime rows remain `RENDERED`.
- **Current State:** Manual publish page is implemented and reachable elsewhere, but primary flow communicates the opposite behavior.
- **Expected State:** Verification success directs an authorized user to review/publish, or clearly returns to a queue with a manual-publish task.
- **Severity:** P1 / High
- **Release Impact:** Operators may assume reports are published when they are not.
- **Recommended Action:** Align copy/navigation/status polling with the locked manual command and test actual `PUBLISHED` encounter/document state.
- **Dependencies:** Workflow UX decision; LIMS-P0-002 first.
- **Verification Required:** Browser E2E explicitly clicks publish and asserts document/encounter/audit state; no “published” test accepts `RENDERED`.

### LIMS-P1-009

- **Module:** Feature flags / LIMS
- **Area:** Backend-authoritative module disable
- **Finding:** `module.lims` is enforced in EncountersService and document generation/import, but results, verification, sample-collection worklists/commands, document read/download, patients, and reports do not consistently assert it.
- **Evidence:** repository search finds `assertLimsEnabled` only in `encounters.service.ts`; document generation has a module check, while other listed services do not.
- **Current State:** Flag blocks some new actions but does not fully disable existing LIMS functionality.
- **Expected State:** Central backend module gate applied consistently to all LIMS-only routes, with shared-core patient behavior explicitly defined.
- **Severity:** P1 / High
- **Release Impact:** Tenant can continue module operations after backend disable; billing/licensing/safety control is incomplete.
- **Recommended Action:** Define module route ownership and apply a central guard; test enabled/disabled tenant behavior across every LIMS endpoint family.
- **Dependencies:** Shared core vs LIMS route classification.
- **Verification Required:** Contract-driven flag matrix and two-tenant runtime tests.

### LIMS-P2-010

- **Module:** Authentication
- **Area:** Refresh scalability/security hardening
- **Finding:** Refresh scans all active token hashes and bcrypt-compares them sequentially.
- **Evidence:** `auth.service.ts:90-107`; runtime had 119 active refresh rows.
- **Current State:** Functionally correct at small scale; cost grows linearly platform-wide.
- **Expected State:** Indexed selector/token-family ID plus constant-bounded hash verification and replay handling.
- **Severity:** P2 / Medium
- **Release Impact:** DoS/performance risk, not the primary current blocker.
- **Recommended Action:** Store selector + hash, index selector, add rotation/reuse detection and cleanup.
- **Dependencies:** Refresh token schema migration.
- **Verification Required:** Load tests and rotation/replay unit/integration tests.

### LIMS-P2-011

- **Module:** Documents
- **Area:** Lifecycle conformance
- **Finding:** Documents are created directly as `RENDERING`; locked lifecycle and current ops docs say `QUEUED → RENDERING`.
- **Evidence:** `documents.service.ts:227-265`; schema default is `DRAFT`; current docs conflict.
- **Current State:** Functional happy path but declared lifecycle is not implemented exactly.
- **Expected State:** Consistent explicit state machine and observability semantics across contract/schema/API/worker.
- **Severity:** P2 / Medium
- **Release Impact:** Monitoring/retry ambiguity; subordinate to failure recovery blocker.
- **Recommended Action:** Lock one lifecycle, update schema/code/contract/tests atomically.
- **Dependencies:** LIMS-P1-005/006.
- **Verification Required:** Transition tests including queue delay and retry.

### LIMS-P2-012

- **Module:** Test strategy / tenancy
- **Area:** False confidence
- **Finding:** Tenant tests use one real tenant plus fake headers; document tests skip failure recovery; multi-test test positively codifies incorrect behavior.
- **Evidence:** test source and exact run results above.
- **Current State:** Green counts overstate production assurance.
- **Expected State:** Capability-focused acceptance assertions against two real tenants and complete clinical/document invariants; skips reported as gate failures for release-critical lanes.
- **Severity:** P2 / Medium (the underlying clinical defect is P0)
- **Release Impact:** Allows regressions/defects to pass CI.
- **Recommended Action:** Rewrite release gate tests and separate mock/unit confidence from real-stack acceptance.
- **Dependencies:** Fixes above.
- **Verification Required:** CI artifact shows no release-critical skips and validates DB/PDF/audit outcomes.

## Proven production-capable building blocks

- Repository builds and typechecks; OpenAPI-generated SDK is fresh and frontends use the sanctioned client in inspected LIMS paths.
- Compose startup runs migrations and idempotent seed, all eight services are healthy, public Caddy routing works, and persistent Postgres/MinIO volumes exist.
- Host-scoped login, one-hour JWT, DB refresh rotation, logout revocation, live permissions, and spoof-header blocking work.
- Patient/encounter/catalog storage is structurally tenant-owned in inspected LIMS models.
- Single-test order → collect → result → verify produces a hashed PDF in MinIO and supports authenticated download.
- Classic invalid transitions tested (double collection, early verify, post-verify result) return 409.
- Correlation IDs are generated/returned and propagate through request audit → render job → PDF call → document audit on observed happy paths.
- Document generation is idempotent for unchanged tested encounters, and worker does not bypass the manual LAB_REPORT publish command.

These are valuable release foundations, not enough to offset the P0 defects.

## Shortest dependency-ordered path to production

1. **P0 incident closure:** immediately remove/rotate known public credentials and secrets, invalidate sessions, switch production mode, restrict Swagger, and review logs.
2. **P0 tenant/audit boundary:** force authenticated tenant scope in audit and real job surfaces; add two actual tenants/users/datasets to red-team tests before further production data.
3. **P0 clinical aggregate state:** reconcile the duplicate legacy/ordered-test workflows; prevent partial multi-order verification/reporting; rewrite the misleading multi-test E2E.
4. **P0 audit atomicity:** commit commands and AuditEvent together; fault-test rollback for registration, ordering, collection, result submission, verification, publication, corrections, finance, and admin changes.
5. **P1 document operations:** expose real queues/failures and audited retry; enable failure injection; prove deterministic retry, manual publish, download, and immutable historical behavior.
6. **P1 hash correctness and publication UX:** version/fix canonicalization and align verification/publish UI plus assertions with manual publication.
7. **P1 module/tenant acceptance:** centrally gate LIMS routes and execute patient/order/result/document/catalog/user/job/audit cross-tenant tests with two real tenants.
8. **Acceptance:** clean-host production-mode Compose bootstrap using external secrets and non-default admin bootstrap; full lint/type/build/unit/integration/browser suite with no release-critical skips; backup/restore acceptance; operator and verifier UAT on the complete multi-test workflow.

## Priority counts proposed for the central ledger

```text
P0: 4
P1: 5
P2: 3
P3: 0
```

P0/P1 IDs: `LIMS-P0-001` through `LIMS-P0-004`; `LIMS-P1-005` through `LIMS-P1-009`.
