# Vexel LIMS — Issues & Pending Work (Sprint Plan)

> Written: 2026-09-20. Scope: **LIMS only** (OPD is out of scope for this document).
> Audience: the project owner (not a technical expert) and the engineers/AI agents doing the work.
> Written in plain English on purpose. Technical file names are given in brackets so engineers can find things.
>
> **Status: APPROVED FOR EXECUTION.** Tasks marked **IN PROGRESS** may begin.
> Updating this plan records approval; it does not by itself mean product code has changed.

## Mega-sprint execution update — 2026-09-19

## Go-live closure execution update — 2026-09-20

The closure sprint has completed the technical release-proof work selected by
the owner. The catalogue remains intentionally blocked until clinical/business
sign-off; no 329-test production import was performed.

### Completed and verified

- Current-server restore proof passed with a pre-snapshot. PostgreSQL, MinIO
  and Caddy restoration completed; the application stack was restarted and
  public health/routing checks passed. Evidence:
  `docs/audits/20260920_go_live_closure/README.md`.
- Restore reliability defects found during the drill were fixed: MinIO is
  stopped before volume replacement, missing Caddy override directories are
  tolerated, root-owned runtime config is replaceable, and destructive restore
  runs no longer fail merely because their source database row was replaced.
- Demo credentials were rotated after restore, refresh tokens were revoked,
  old admin login returned 401, and new admin login returned 200. Seed now
  requires environment-provided passwords and never prints them.
- Documents now start in `QUEUED`; failed documents have an audited retry
  command. Live proof passed: injected PDF failure → `FAILED` → retry →
  `RENDERED` with storage key and PDF hash.
- Live result-entry UI/API verification passed 5/5 tests; tenant-isolation
  acceptance passed 7/7 tests; login/refresh passed after the indexed refresh
  token lookup migration.
- Two-lab acceptance passed against the live system and Tenant B domains: both
  labs authenticated, completed an isolated order → specimen → result →
  verification → report workflow, and could not see the other lab's patient.
  Jobs and audit endpoints were also reachable for both tenants.
- The multi-test release proof now checks every ordered test has a result before
  verification and checks the generated report payload contains both test codes
  and the entered value. This passed 3/3 browser scenarios.
- Document idempotency now has a passing corrected-payload test proving a new
  document version is created while the earlier version is preserved.
- The previously skipped PDF browser test is now an explicit opt-in serial
  test for controlled infrastructure runs.

### Still pending by deliberate decision

- Catalogue C1–C4 technical work is implemented and migration-backed, but the
  329-test catalogue import is **BLOCKED pending clinical/business sign-off**.
- Owner/demo-user UAT must be completed using the rotated secrets through the
  approved secret-sharing channel.
- Final external GitHub Actions confirmation remains a post-push gate.
- The old visit-level command aliases and legacy encounter pages remain as
  compatibility routes while active navigation is migrated to the per-test
  command family; this is a follow-up hardening item, not a reason to import
  the catalogue.

The detailed evidence record is in
`docs/audits/20260920_go_live_closure/README.md`.

The approved seven-workstream plan has been executed against the latest `main`
branch (`60fa9ec` at sprint start). The older task tables below are retained as
the original audit record; the status below is the current source of truth.

### Completed in this sprint

- Production hardening: API and worker run in production mode; storage and
  database credentials are no longer hardcoded; restore remains disabled by
  default; Swagger is disabled in production; JWTs no longer carry a copied
  permissions list.
- Operational observability: the Admin Jobs view now reads the four real BullMQ
  queues, filters by tenant, reports real job state, and retries only jobs the
  caller is allowed to access.
- Workflow proof: result entry, invalid transitions, verification, automatic
  report generation, PDF download, tenant isolation, and protected-route
  redirects are live-tested.
- Dependency repair: production dependency findings were reduced from the
  initial 154 to 47. Remaining high/critical findings are confined to the
  non-shipped mobile dependency tree or build-only tooling and are recorded as
  release-risk follow-up; they are not silently treated as fixed.
- Backup and restore safety: a full encrypted backup was created and the
  matching restore dry-run completed successfully. No destructive restore was
  applied to the live database.
- Tenant rollout: `tenant-b.vexel.alshifalab.pk` was provisioned, LIMS enabled
  with an empty catalogue, DNS was already present, and the live Caddy route
  was validated with the API health endpoint.

### Historical remaining list before the 2026-09-20 closure work

- These items are now addressed or superseded by the closure update above.
- The catalogue import and owner UAT remain intentionally open gates.
- The remote GitHub Actions confirmation remains a post-push gate.

---

## 0. How to read this document

- **Owner communication rule** — the owner is not a technology expert. Plans, discussions, decision requests and progress reports must use plain English. Explain any unavoidable technical word in the same sentence, and lead with the impact on laboratory work rather than implementation details.
- **Section 1** — where we stand, the initial blocker list (with the task that fixes each), and the decisions the owner has already made.
- **Section 2** — the sprint plan at a glance (what happens in what order).
- **Section 3** — every task in detail: the issue (what is wrong, in plain words), the planned solution, and how we know it is finished ("Done when").
- **Section 4** — decisions still needed from the owner.
- **Section 5** — how we will prove it works (testing rules).
- **Section 6** — where the evidence came from, and what has *not* been checked by running the app.

Priority labels used by the earlier audit:
- **P0** = must fix before a real lab can use Vexel. Serious safety/security/clinical risk.
- **P1** = must fix before go-live, but not an emergency.
- **P2** = should fix; improves safety and reliability.

---

## 1. Where we stand

### 1.1 Overall verdict (from the 2026-09-01 audit)

**Historical audit verdict:** LIMS was **NOT READY for production** on
2026-09-01. A single test could be ordered, sampled, resulted, verified,
turned into a PDF and downloaded, but five serious problems (P0) and five
important problems (P1) remained at that point. The mega-sprint execution update
above records the changes and evidence collected after that audit.
Source documents: `docs/discovery/LIMS_PRODUCTION_READINESS_AUDIT.md`, `docs/discovery/LIMS_RELEASE_GAP_LEDGER.md`, `docs/discovery/_work/LIMS_AGENT_FINDINGS.md`, and `docs/catalog/build/v2/workdetails.md` (catalogue work).

### 1.2 Initial blocker list (from the audit, with the task that fixes each one)

This is the original list of 13 release gaps, exactly as the audit recorded them (IDs come from `docs/discovery/LIMS_RELEASE_GAP_LEDGER.md`). The last column shows where each one is handled in this plan, so nothing is lost.

**P0 — must be fixed before any real lab uses Vexel (5)**

| ID | Problem in plain words | Why it matters | Fixed by |
|---|---|---|---|
| LIMS-P0-001 | The public server runs in "development style": a well-known administrator login works, secret keys are fixed defaults, and the API documentation page is public. | Anyone could get in and read or change lab data. | T0.1 (Sprint 0) |
| LIMS-P0-002 | A visit with several tests can be verified and reported after only one test has a result. | A patient could receive an incomplete report that looks complete. | T2.0–T2.3, T3.1–T3.3, T4.1 (Sprints 2–4) |
| LIMS-P0-003 | The audit-log screen lets the caller choose which lab's records to read. | One lab could read another lab's records. | T1.3, T1.4 (Sprint 1) |
| LIMS-P0-004 | Important actions change the data first and write the audit record afterwards; if the record fails, the change stays unrecorded. | Unrecorded clinical or admin changes. | T1.2 (Sprint 1) |
| LIMS-P0-005 | The security check for software packages fails: 2 critical, 75 high, 45 moderate, 5 low findings. | Known security holes in the software we depend on. | T0.2 (Sprint 0, runs alongside the others) |

**P1 — must be fixed before go-live (5)**

| ID | Problem in plain words | Why it matters | Fixed by |
|---|---|---|---|
| LIMS-P1-005 | If a report PDF fails to render, Vexel carries on quietly and staff have no reliable retry. The two browser tests for this are skipped. | A verified patient can be left without a report. | T4.4 (Sprint 4) — live status + retry (D9) |
| LIMS-P1-006 | The job-monitoring screen watches a queue nothing uses, not the four queues that do the work. | Failures are invisible and cannot be retried safely. | T5.2 (Sprint 5) |
| LIMS-P1-007 | The routine that fingerprints a report's data can treat different data as the same. | The wrong PDF could be reused for a different report. | T4.6 (Sprint 4) |
| LIMS-P1-008 | The verification screen says "auto-publish started", but reports actually wait for a manual publish. | Staff think a report is available when it is not. | T4.5 (Sprint 4) — verify auto-generates and publishes (D10) |
| LIMS-P1-009 | The "LIMS module on/off" switch is checked in only some places. | A lab with LIMS switched off could still use parts of it. | T5.1 (Sprint 5) |

**P2 — should be fixed; improves safety and reliability (3)**

| ID | Problem in plain words | Why it matters | Fixed by |
|---|---|---|---|
| LIMS-P2-010 | Refreshing a login checks every stored session one by one with a slow test. | Slows down as sessions grow; can be used to overload the server. | G5 (Sprint 8) |
| LIMS-P2-011 | New documents start as "RENDERING" instead of the documented "QUEUED". | Confusing status monitoring. | G6 (Sprint 8) |
| LIMS-P2-012 | Automated tests give false confidence: one-lab-only checks, skipped failure tests, and a multi-test test that passes while the bug exists. | Defects pass the automatic checks unnoticed. | G1, G2 (Sprint 8); the multi-test rewrite starts alongside Sprint 3 |

**Other gaps found after the audit (added 2026-09-20)** — these are not in the original 13 but also block a complete, correct go-live:
- Result-entry bugs found by reading code (R1–R9, Sprint 6).
- Catalogue features Vexel cannot hold yet (C1–C12; C1–C4 in Sprint 7, the rest later).
- Overlapping old and new command families (G4, Sprint 8) and immutable document history (G7).

### 1.3 Decisions already made by the owner

| # | Decision | Date |
|---|---|---|
| D1 | **Everything works per test, not per visit.** Sample collection, result entry, verification and printing all happen at the level of each ordered test. The visit status is only a summary of its tests. | 2026-09-20 |
| D2 | **Sampling is tracked per test.** Each test has its own sample status (including rejection). Tests may still physically share a tube underneath. | 2026-09-20 |
| D3 | **One verification permission for now.** Anyone with the verify permission can verify any test. No per-department rules yet. | 2026-09-20 |
| D4 | **A cancelled test does not stop the visit.** The rest of the visit carries on and can complete without it. | 2026-09-20 |
| D5 | **Cancelling a test reduces the invoice automatically and creates a manual-refund entry.** | 2026-09-20 |
| D6 | **Printing defaults to ALL verified tests, every time** — whether or not they were printed before. The print screen shows a checklist of all verified tests, all ticked by default. The operator may untick tests already printed, or print a single test. Reason: "print" only opens a PDF in a new tab; Vexel cannot know whether paper really came out (printer jam, forgot to print, computer crash). | 2026-09-20 |
| D7 | **Profile tests such as CBC, LFT etc. always print alone on their own page**, even if that leaves empty space. This is controlled by a per-test **Single Page** option in Test Details (as shown for the CBC configuration). | 2026-09-20 |
| D8 | The old advice "delete the 208 blank reference-range rows" is **withdrawn** — those ranges are a real requirement and must be kept. | 2026-09-20 |
| D9 | **Live report progress after verify.** Right after verify the screen shows "Building report…" then Completed, or Failed with a Retry button, in the same flow. | 2026-09-20 |
| D10 | **Verification always generates the report automatically** (build + publish). No separate generate/publish buttons. Printing stays a separate operator action. | 2026-09-20 |
| D11 | **Verification stays saved even if the report fails to build.** The report then shows Failed with a Retry button. The verifier's work is never lost because of a PDF problem. | 2026-09-20 |

---

## 2. Sprint plan at a glance

Each sprint is meant to be small enough to test on its own. Sprints are in priority order. Sprint length is not fixed here — sizes are S (small), M (medium), L (large).

| Sprint | Theme | Main outcome | Closes |
|---|---|---|---|
| **S0** | Emergency containment | Public login/secrets exposure closed; dependency risk understood | P0-001, start P0-005 |
| **S1** | Safety foundation | Audit trail is trustworthy and tenant-safe; rules written down; two-tenant test setup ready | P0-004, P0-003, spec updates |
| **S2** | Per-test core | Database + one place that works out visit status + per-test sampling | Part of P0-002 |
| **S3** | Per-test verification & cancellation | Verify/return/cancel per test; old shortcuts removed | Rest of P0-002 |
| **S4** | Per-test reports & printing | Verified-tests checklist print, "PARTIAL" label, print-alone pages, failure/retry, safe document hashing | P1-005, P1-007, P1-008 |
| **S5** | Platform correctness | Module gate everywhere; real job monitoring | P1-006, P1-009 |
| **S6** | Result-entry correctness | Fix wiring bugs (after confirming by running the app) | Suspected bugs R1–R9 |
| **S7** | Catalogue features + import | Reference text, paragraph type, heading rows; dry-run then real import | Catalogue gaps C1–C4 |
| **S8** | Proof & go-live readiness | Two-tenant E2E, clean-server setup, backup/restore proof, user acceptance testing | P2 items, go-live gate |
| **Later** | Advanced catalogue features | Structured ranges, age in days, pregnancy/cycle, critical values, etc. | Catalogue gaps C5–C12 |

Dependencies to respect:
- S1 (safe audit writing) comes **before** S2–S4, because every new command written in S2–S4 must be built on it. Otherwise the work is done twice.
- S0 can run in parallel with anything; it is deployment/security work, not feature work.
- S6 must start with "confirm by running the app" — those bugs were found by reading code only.
- S7 import must not happen until reference-text support exists (otherwise 208 empty range rows would be created and the legacy wording lost).

### P0/P1 execution tracker

> Coordination status: **IN PROGRESS** as of 2026-09-20. This table is the
> handoff source of truth for agents working in parallel. A task may move to
> `PASS` only with its stated “Done when” evidence committed and linked here.

| Task | Priority | Status | Dependency | Evidence / completion note |
|---|---|---|---|---|
| T0.1 Production security | P0 | IN PROGRESS | Server owner + maintenance window | — |
| T0.2 Dependency security | P0 | IN PROGRESS | Runtime dependency triage | — |
| T1.1 Workflow/specification lock | P0 prerequisite | PASS | Owner decisions D1–D10 | `docs(lims): lock per-test workflow decisions` |
| T1.2 Atomic audit writes | P0 | IN PROGRESS | Transaction-aware audit helper | — |
| T1.3 Audit tenant isolation | P0 | IN PROGRESS | T1.4 fixtures; OpenAPI + SDK | — |
| T1.4 Two-tenant test fixtures | P0 prerequisite | IN PROGRESS | Disposable Tenant A/B data | — |
| T2.1 Per-test data model | P0 | IN PROGRESS | T1.2; safe migration | — |
| T2.2 Encounter-status derivation | P0 | IN PROGRESS | T2.1 | — |
| T2.3 Per-test sample commands | P0 | IN PROGRESS | T1.2; T2.1–T2.2; OpenAPI + SDK | — |
| T3.1 Per-test verification/return | P0 | IN PROGRESS | T1.2; T2.1–T2.2; OpenAPI + SDK | — |
| T3.2 Per-test cancellation/refund | P0 | IN PROGRESS | T1.2; T2.1–T2.2; pro-rata paid credit policy | — |
| T3.3 Retire visit-level shortcuts | P0 | IN PROGRESS | T2.3; T3.1–T3.2 consumer migration | — |
| T4.1 Verified-test partial reports | P0 | IN PROGRESS | T2–T3; document payload changes | — |
| T4.2 Verified-test print checklist | P1 supporting | IN PROGRESS | T4.1; OpenAPI + SDK | — |
| T4.3 Test Details Single Page option | P1 supporting | IN PROGRESS | T4.1; owner test list | — |
| T4.4 Live document status and retry | P1 | PASS | Real job registry; OpenAPI + SDK | Live injected failure → retry → rendered proof; audit evidence in closure record |
| T4.5 Verify auto-generates and publishes | P1 | PASS | T4.1; T4.4 | Live workflow and document pipeline tests pass |
| T4.6 Versioned canonical document hash | P1 | PASS | Historical documents retain v1 hashes; new hashes are v2 domain-separated | `3494661`; canonical vectors pass |
| T5.1 Central LIMS module gate | P1 | IN PROGRESS | LIMS route inventory | — |
| T5.2 Real queue observability/retry | P1 | IN PROGRESS | Queue registry; T1.4 fixtures | — |

---

### Result-entry and catalogue execution tracker

> The owner has approved the work below to start. `IN PROGRESS` means design,
> contract or implementation work can begin now. A task may still wait for a
> preceding task before its final code change is merged.

| Task | Status | What can start now | Dependency / note |
|---|---|---|---|
| T6.0 Live result-entry confirmation | PASS | Start the local stack and run the agreed numeric, choice-list, yes/no, range and PDF checks. | Public deployment Playwright result-entry suite passed 5/5; PDF output passed in failure/retry proof. |
| T6.1 Result-entry foundation | IMPLEMENTED — awaiting migration/live verification | Parameter-level formats, choices, defaults, omissions (`*`), flags and server validation are implemented. | Migration `20260920090000_result_entry_foundation` must be applied. |
| T6.2 Result-entry UI and PDF repair | IMPLEMENTED — awaiting PDF build/live verification | Operator entry, omission handling, arrow flags, paragraph/date fields and PDF payload changes are implemented. | TypeScript checks pass; .NET PDF build is blocked locally (see §6). |
| T6.3 Formula and future analyser foundation | IMPLEMENTED — awaiting migration/live verification | Formula result source/provenance and analyser-ready data models are implemented; no listener or auto-release is enabled. | Formula inputs are limited to the same test. |
| C1 Reference-text ranges | IMPLEMENTED — awaiting migration/live verification | Reference text is stored, returned, imported from workbook notes and included in result range display. | Needed before catalogue import. |
| C2 Paragraph result format | IMPLEMENTED — awaiting PDF build/live verification | Multi-line result entry and PDF payload support are implemented. | Requires PDF-service build verification. |
| C3 Heading rows | IMPLEMENTED — awaiting PDF build/live verification | Heading Parameters are non-entry rows and are emitted as PDF section headings. | Requires PDF-service build verification. |
| C4 Date result format | IMPLEMENTED — awaiting migration/live verification | Date picker entry and server date validation are implemented. | Calculated/formula Parameters are handled by T6.3. |
| Catalogue workbook import | WAITING | Prepare source workbook while C1–C4 are built. | Dry-run/real import starts only after C1–C4 pass. |
| Advanced catalogue features C5–C12 | WAITING | — | Starts after go-live unless a clinical requirement brings one forward. |

---

## 3. Detailed tasks

Format for each task:
**Issue** = what is wrong · **Solution** = what we will do · **Done when** = how we know it is finished · **Size** = S/M/L.

---

### SPRINT 0 — Emergency containment

#### T0.1 — Public deployment is open to anyone (P0-001)
- **Issue:** The public server runs in "development style". A well-known administrator login works from the internet. Secret passwords/keys are fixed or fall back to defaults. The API documentation page (Swagger) is public. Anyone who finds this could read or change lab data.
- **Solution:**
  1. Change the administrator and all seeded account passwords; disable the known accounts.
  2. Replace the secret keys (login tokens, database, file storage) with new random ones kept **outside** the code repository.
  3. Sign out every existing session (old tokens must stop working).
  4. Switch the server to production mode, and make it **refuse to start** if a secret is missing (no silent defaults).
  5. Stop printing passwords into logs; hide or protect the Swagger page.
  6. Review server/audit logs for any suspicious access already made.
- **Done when:** the old known login fails from outside; old tokens fail; a scan of the repo finds no real secrets; the server refuses to start with a missing secret; Swagger is closed or protected; a written log-review note exists.
- **Size:** M. **Needs:** whoever controls the server; a short planned downtime for restarting the database and file storage.

#### T0.2 — Vulnerable software packages (P0-005)
- **Issue:** The security check (`pnpm audit --prod`) fails: 2 critical, 75 high, 45 moderate and 5 low findings. Some are in parts that really run (for example the Excel-reading library in the Admin app, and packages installed with the API).
- **Solution:**
  1. Sort the findings into: really runs in production / only used when building / only in the mobile app (not shipped).
  2. Upgrade or replace the packages that really run and are dangerous; for anything that cannot be fixed, write down why the risk is acceptable and how it is limited.
  3. Add an automatic check in CI (the automatic build) that fails when new critical/high problems appear.
- **Done when:** the audit shows zero critical and zero un-explained high findings in production code; the CI check is active; each accepted risk is written down with a reason.
- **Size:** L (depends on how many upgrades break things). Can run in parallel with other sprints.

---

### SPRINT 1 — Safety foundation

#### T1.1 — Write the workflow rules down (spec update)
- **Issue:** No written rule says how partial results, cancelled tests and per-test verification should behave. That is why the code drifted and nobody could tell whether the "verify after one test" behaviour was intended.
- **Solution:** Update `docs/specs/LIMS_WORKFLOWS.md` and `docs/specs/LOCKED_DECISIONS.md` with decisions D1–D7 above, plus the visit-status rules:
  - The visit status is **calculated** from its tests; no command sets it directly.
  - Cancelled tests are ignored when deciding whether a visit is complete.
  - A visit is "complete" only when every non-cancelled test is verified.
- **Done when:** both documents are updated and the owner has read and agreed to them.
- **Size:** S.

#### T1.2 — Audit trail is written *after* the change, not together with it (P0-004)
- **Issue:** When staff do something important (verify, publish, cancel…), Vexel first changes the data and **then** tries to write the audit record. If writing the audit record fails, the change stays and there is no record of it. In a lab, an unrecorded verification is a compliance and legal problem.
- **Solution:** Make the change and its audit record succeed or fail **together** (one all-or-nothing step). Provide one shared helper so every command uses it. Apply it first to the commands touched by this plan (sampling, results, verify, cancel, publish), then to the rest.
- **Done when:** a test that deliberately breaks the audit write shows that the change is rolled back, for every important command.
- **Size:** M. Must be done before S2–S4.
- **Files to look at:** `apps/api/src/audit/*`, `apps/api/src/verification/verification.service.ts`, `apps/api/src/results/results.service.ts`, `apps/api/src/encounters/encounters.service.ts`.

#### T1.3 — The audit log can be read across labs (P0-003)
- **Issue:** The audit list endpoint accepts a `tenantId` from whoever calls it (`apps/api/src/audit/*.controller.ts`). A user of one lab could ask for another lab's audit records. "Tenant-admin" also holds the `audit.read` permission.
- **Solution:** The lab (tenant) always comes from the logged-in session on the server, never from the request. Keep a **separate** platform-only endpoint for super-admins to see across labs, clearly protected. Update the API contract (`packages/contracts/openapi.yaml`) and regenerate the SDK.
- **Done when:** a two-lab test shows that user A cannot see lab B's audit records, even by guessing IDs or passing another `tenantId`.
- **Size:** S–M.

#### T1.4 — Two-lab test setup
- **Issue:** Existing tests only use one lab, so they cannot prove that labs are separated from each other.
- **Solution:** Create a reusable test setup with two labs, each with users and data. Use it in T1.3 and every later isolation test.
- **Done when:** the setup exists and T1.3's test uses it.
- **Size:** M.

---

### SPRINT 2 — Per-test core (first half of P0-002)

#### T2.0 — Background: the issue in plain words (P0-002)
A patient visit has, say, two tests: CBC and Lipid Profile. Today:
1. The technician enters the CBC result.
2. Vexel marks the **whole visit** "resulted".
3. The verifier approves, and the **whole visit** becomes "verified".
4. A report is produced. Lipid Profile is still "ordered" with no result — but the visit says "verified" and the report has no warning that a test is missing.

The audit confirmed this in the database. It comes from **three places** that flip the visit too early:
1. The old visit-level `:verify` command — `apps/api/src/encounters/encounters.service.ts` (`verify`, around line 440): marks all resulted tests verified and sets the visit "verified".
2. The `submit-and-verify` shortcut — `apps/api/src/results/results.service.ts` (`submitAndVerify`): sets the visit "verified" after one test.
3. The report builder — `apps/api/src/documents/documents.service.ts` (`generateFromEncounter`): always builds one report from the whole visit.

Also the old visit-level `:result` command (`encounters.service.ts` `enterResult`) moves the whole visit after one test.

What already works and will be reused: per-test result **save** and **submit** exist (`results.service.ts`) and already record "partial_resulted"; each test (`LabOrder`) already has its own status and result status; the newer verification page already only verifies submitted tests.

#### T2.1 — Give every test its own sample, verification and report fields
- **Issue:** Today samples are tracked per **sample type per visit** (`SpecimenItem`), not per test. Verification who/when is stored only on result rows, not on the test. There is no per-test rejection reason.
- **Solution:** Add to each ordered test (`LabOrder` in `apps/api/prisma/schema.prisma`):
  - sample status: pending → collected → received, or rejected (with reason, who, when),
  - a link to the physical tube record where tests share one,
  - verified by / verified at,
  - cancel reason and who (cancel reason already exists).
  Write a database migration that also fills in these fields for existing tests so nothing breaks. Every table keeps its `tenantId` and tenant-scoped rules.
- **Done when:** migration applies cleanly on a copy of live data; existing visits still open correctly; tenant rules unchanged.
- **Size:** M.

#### T2.2 — One place that works out the visit status
- **Issue:** Many code paths set the visit status by hand, and they disagree.
- **Solution:** Write one function that calculates the visit status from its tests (ignoring cancelled ones), and call it after every command. Nothing else may write the visit status. Suggested rules:
  - all tests cancelled → cancelled;
  - none collected → lab ordered/registered;
  - some collected/received → sampling in progress;
  - some results in → partially resulted;
  - all non-cancelled tests verified → verified/complete;
  - published/printed state follows reports (see S4).
- **Done when:** unit tests cover every combination (including cancelled and rejected tests); a search of the code finds no other place that sets the visit status.
- **Size:** M.

#### T2.3 — Per-test sample commands
- **Issue:** Collect/receive commands work on the whole visit or on a tube type, not on a single test. No way to reject one test's sample (e.g. "insufficient volume") without holding up the others.
- **Solution:** New commands (contract first, in `openapi.yaml`, then `pnpm sdk:generate`):
  - collect sample for a test,
  - receive sample for a test,
  - reject sample for a test (with reason).
  Each writes an audit record (using T1.2), returns "409 conflict" for an invalid move, and updates the visit status through T2.2. Collecting a shared tube marks all tests on that tube collected. Update the sample-collection screen (`apps/operator/.../lims/sample-collection/page.tsx`) to show one row per test.
- **Done when:** a test collects/receives/rejects one of two tests and the other is unaffected; invalid moves return 409; audit records exist.
- **Size:** M.

---

### SPRINT 3 — Per-test verification & cancellation (rest of P0-002)

#### T3.1 — Verify or return individual tests
- **Issue:** The verification command verifies **all** submitted tests in one click, so the verifier cannot pick tests. Also the old paths (T2.0) flip the whole visit.
- **Solution:** The verifier selects which tests to approve, or sends specific tests back for correction with a reason. The verify permission covers every test (decision D3). Store who verified each test and when. The visit status follows through T2.2. Update the verification screens (`apps/operator/.../lims/verification/...`).
- **Done when:** a verifier can approve test A only; test B stays "resulted"; a second person can later approve test B; verifying a test with no submitted result returns 409.
- **Size:** M.

#### T3.2 — Cancel a single test (decisions D4, D5)
- **Issue:** Only the whole visit can be cancelled today. There is no way to cancel one test, and no link from a cancelled test to money.
- **Solution:** New "cancel this test" command with a reason. Effects, all in one all-or-nothing step: the test becomes cancelled; the invoice is reduced by that test's amount; a **manual refund entry** is created if money was already paid; an audit record is written; the visit status is recalculated (the rest continues).
- **To investigate first:** how the billing tables (`Invoice`, `CashTransaction`, `LabOrder` amounts) and the "refund" concept work today, so the invoice reduction and refund entry fit the existing design.
- **Done when:** cancelling one test of two reduces the invoice by the right amount, creates the refund entry when paid, leaves the other test able to complete, and the visit completes without the cancelled test.
- **Size:** M–L (depends on billing findings).

#### T3.3 — Remove the old visit-level shortcuts
- **Issue:** The old commands `:result`, `:verify`, `:collect-specimen`, `:receive-specimen` and `submit-and-verify` still exist and still flip the whole visit. Some screens and about 10 automated tests still use them.
- **Solution:**
  1. Move the 4 operator pages and all tests that use the old commands to the new per-test commands.
  2. Remove (or make harmless) the old commands. `submit-and-verify` becomes "submit + verify **this one test** only".
  3. Update the API contract and regenerate the SDK.
- **Done when:** a search finds no code that verifies or results the whole visit at once; all tests pass on the new commands.
- **Size:** M.
- **Files to look at:** `apps/operator/src/app/(protected)/lims/encounters/[id]/{results,receive,verify,sample}/page.tsx`, `apps/e2e/tests/**` (10 files call `:verify`).

---

### SPRINT 4 — Per-test reports & printing

#### T4.1 — Reports built from verified tests, clearly labelled partial (D1, D6)
- **Issue:** One report is always built from the whole visit, including tests that are not done. It gives no warning.
- **Solution:** A report contains **only verified tests**. If other tests are still pending it is stamped **"PARTIAL – pending: <test names>"** (both PDF templates in `apps/pdf/Program.cs`). Each report records exactly which tests it covers. The document identity (`tenantId, encounterId, docType, templateVersion, payloadHash`) still applies, so re-printing the same set does not create duplicates.
- **Done when:** with 1 of 2 tests verified, the report shows only that test and the PARTIAL stamp; after both are verified, the report has both and no stamp; PDF contents are asserted in tests.
- **Size:** L.

#### T4.2 — Print screen with a checklist (D6)
- **Issue:** Printing is one button for the whole visit. Vexel cannot tell whether paper was actually printed, so operators can lose tests after a printer problem.
- **Solution:** The print screen lists **all verified tests, all ticked by default**. The operator may untick tests that were already printed, or print one test alone. Vexel does **not** record "printed" as a fact (it cannot know). Any "printed earlier" note is only a hint and never hides a test from the list. Each print builds a fresh report from the ticked tests.
- **Done when:** the default print contains all verified tests, including ones printed before; unticking removes only those tests; printing one test works.
- **Size:** M.

#### T4.3 — Profile tests always print alone (D7)
- **Issue:** The catalogue already has a "print alone" flag (`printAlone` in `apps/api/prisma/schema.prisma`; admin checkbox in the catalogue test page). But the PDF only starts a new page **before** such a test (`apps/pdf/Program.cs` around lines 399 and 807). The next test then prints on the same page as CBC.
- **Solution:**
  1. Expose a per-test **Single Page** checkbox/toggle in the Test Details configuration screen, matching the existing CBC configuration shown in the reference image. Persist it as the catalogue `printAlone` value.
  2. In the PDF service, add a page break **after** a Single Page test as well as before it (both templates), so it always sits alone even when space is left over.
  3. Make sure per-test reports (T4.1/T4.2) preserve and honor the setting.
  4. In the v2 catalogue workbook add the Single Page/print-alone column and turn it on for the agreed list of profile tests (CBC, LFT, RFT, Lipid Profile, …). **The owner confirms the list** (see open decision O3).
- **Done when:** the Test Details screen can enable/disable Single Page for an individual test; the saved value survives reload/export/import; a PDF with CBC followed by another test shows CBC alone on its page and the next test on a new page; and the flag is set correctly after catalogue import.
- **Size:** S (PDF) + S (catalogue).

#### T4.4 — Live report status after verify, failure and retry (P1-005) — decision D9
- **Issue:** If the PDF fails to render, Vexel treats it as "best effort" and carries on. A verified patient can be left without a report and staff have no reliable way to retry. The two browser tests for this are skipped.
- **Solution:** Right after the verifier presses verify, the same screen shows the report progress live: **"Building report…" → "Completed"** (with a link to open it) **or "Failed" with a Retry button**. Retry is an audited command. Behind the scenes the PDF is still made by the background worker, so the screen checks the status every second or two until it finishes. Design rule (decision D11): the **verification itself is saved immediately and stays saved even if the report fails**, so the verifier's work is never lost; a failed report simply shows Failed + Retry. Enable and fix the two skipped tests.
- **Done when:** after verify the screen shows building → completed; a forced failure shows Failed and Retry works; the report then renders, publishes and downloads; the two skipped tests run and pass.
- **Size:** M.

#### T4.5 — Verification automatically generates and publishes the report (P1-008) — decision D10
- **Issue:** The verification screen says "auto-publish started", but the lab report deliberately stays "RENDERED" until someone publishes it manually, so the message is false and staff need an extra step.
- **Solution:** **Verification always means report generation.** When tests are verified, the system automatically builds and publishes the report for **all verified tests of that visit** (this fits D6 and the partial-report rule of T4.1: verify test A → report with A marked PARTIAL; verify test B → new report with A and B). Remove the separate "generate report" and "publish" buttons from the LIMS flow. The only manual step left is **print** (T4.2). The message on screen is replaced by the live status of T4.4. If a verified test is later returned for correction, the old published report is kept in history and a new version is created when it is verified again (see G7).
- **Done when:** one click on Verify results in a published report with no further button press; a browser test verifies a test and asserts the published document, the audit records and the visit status; no "publish"/"generate" button remains in the LIMS screens.
- **Size:** M (includes removing the manual publish path and updating the tests that call it).

#### T4.6 — Document identity (hash) can collide (P1-007)
- **Issue:** The routine that turns report data into a fixed fingerprint (`apps/api/src/documents/canonical.ts`) treats some different values as the same and does not escape text. Two different reports could get the same fingerprint, so the wrong PDF might be reused.
- **Solution:** Adopt a proper, versioned canonical form and add fixed test examples (numbers vs text, null, special characters, Unicode). Decide how old documents keep their old fingerprint.
- **Done when:** golden test vectors pass; collision examples are distinguished.
- **Size:** M.

---

### SPRINT 5 — Platform correctness

#### T5.1 — "LIMS module on/off" is only partly enforced (P1-009)
- **Issue:** The `module.lims` switch is checked in some places (visits, document generation) but not consistently in results, verification, samples, downloads and reports. A lab with LIMS switched off could still use parts of it. The rule says the **backend** decides, never the screen.
- **Solution:** One central check on all LIMS routes, with a short, explicit list of exceptions for shared features.
- **Done when:** a two-lab test (LIMS on vs off) shows every LIMS route refuses the disabled lab.
- **Size:** M.

#### T5.2 — Job monitoring watches the wrong queue (P1-006)
- **Issue:** The `/jobs` screen watches a queue named "jobs" that nothing uses. The four queues that really do the work are invisible, and retry is not tenant-safe.
- **Solution:** Show the real queues (PDF, imports, exports, etc. — see `apps/worker/src`), restrict each lab to its own jobs, hide sensitive payload contents, and make retry an audited command.
- **Done when:** tests show a lab sees and retries only its own jobs across all real queues.
- **Size:** M.

---

### SPRINT 6 — Result-entry correctness

> **All items here were found by reading code, not by running the app.** First task is to run each one and confirm; fix only what is really broken.

#### Sprint 6 design decision — result-entry settings belong to the Parameter

The reusable **Parameter** is the single place that defines how a result is entered. A test only chooses which parameters it contains and their display order. This prevents the same parameter from behaving differently in different screens.

Each Parameter must hold its result-entry setup:
- result format: number, whole number, choice list (for example Negative / Positive / Borderline), yes/no, short text, paragraph/multi-line text, or date;
- decimal places and unit for numbers;
- allowed choices for a choice list;
- starting behaviour: empty, pre-filled choice/value, or editable standard text;
- whether the value is required;
- whether a comment is permitted or required;
- the applicable normal and critical reference limits.

Safety rule: a pre-filled value is visibly marked as a starting value. It must be confirmed or deliberately changed before submission; Vexel must not silently treat it as a result entered by the worker.

#### Sprint 6 decisions finalised — result-entry gap closure

These decisions are locked for the result-entry repair. Engineers must implement them consistently in the database, API contract, Admin catalogue, operator screen, import/export and PDF report.

| # | Final decision | Plain-English effect |
|---|---|---|
| RE1 | **Parameter-level setup is the source of truth.** | Each reusable Parameter defines how its result is entered. A test only includes Parameters and chooses their display order. |
| RE2 | **Supported result formats are number, choice list, yes/no, short text, paragraph and date.** | A worker sees the appropriate box: number field, dropdown, yes/no selector, short line, large multi-line report box, or date picker. A whole number is a number with zero decimal places. |
| RE3 | **Choice-list values are a real ordered list.** | Values such as Negative / Positive / Borderline are saved and exchanged as a list, never as unreliable comma-separated text. |
| RE4 | **A Parameter defines its starting behaviour.** | It may open empty, with a visibly pre-filled choice/value, or with editable standard report text. |
| RE5 | **Draft and submission are different.** | When a worker saves, every empty manual Parameter is automatically recorded as an intentional omission (`*`) rather than an unknown blank. A worker may later replace it with a real value. Submission is allowed only when every required Parameter has a real value or is intentionally omitted. |
| RE6 | **Vexel validates results on the server.** | The system, not only the screen, checks number format, decimal places, permitted choices, yes/no values, required fields and that the Parameter belongs to the selected test. |
| RE7 | **Vexel calculates result warnings on the server.** | High, Low and Critical warnings use the stored numeric limits, including negative values. A missing range never means “Normal.” |
| RE8 | **The applied range and warning are saved with the result.** | A later catalogue change cannot silently change an already-entered or already-published patient result. |
| RE9 | **Normal and critical ranges are configured at Parameter level and selected by patient facts.** | Vexel selects the appropriate range using the patient’s age and sex. Conflicting active ranges must be rejected rather than guessed. |
| RE10 | **PDFs show only a real warning.** | No warning is printed as blank or “no reference range”; High, Low and Critical are clearly shown; paragraphs wrap and remain readable. |
| RE11 | **Manual and analyser-entered results use the same safety rules.** | A future machine connection cannot bypass validation, review, verification, tenant separation or the audit history. |
| RE12 | **Empty values automatically become `*` when saved.** | An empty manual field means “do not report this Parameter” unless the worker later enters a real value. Vexel records this as an intentional omission, not as the literal laboratory result `*`. A worker may also type `*` directly. |
| RE13 | **An intentionally omitted Parameter stays available for later entry, but is excluded everywhere else.** | It remains visible on the result-entry screen with the `*` marker so a worker can update it later. It does not appear in the verifier’s result list, does not print on the PDF, and does not count as a missing required value. The audit history still records who omitted it and when. |
| RE14 | **A test with every Parameter omitted cannot be submitted as a normal result.** | The worker must instead use the proper cancel / sample-rejection / absent-result process, so an empty test cannot look completed. |
| RE15 | **Flag printing is configurable for each Parameter.** | Admin can choose whether High, Low and Critical warnings appear beside that Parameter on the PDF. This setting changes display only; Vexel still calculates and stores the warning for safety. |
| RE16 | **Flags use simple coloured arrows.** | High is a red upward arrow, Low is a blue downward arrow, and Critical is a prominent red alert arrow. “Normal” has no arrow. |
| RE17 | **A Parameter may be manual or formula-calculated.** | A formula Parameter is read-only for the worker. It shows its calculated value immediately whenever one of its named input Parameters changes. Its formula, input fields, unit and decimal places are configured in the Parameter catalogue and are fully traceable. |

#### Still to decide later (not a blocker for the Sprint 6 repair)

- Which Parameters receive a standard pre-filled phrase, and which require the worker to actively confirm it.
- The laboratory’s exact critical-result escalation procedure: visible warning only, acknowledgement, telephone notification, or all three.
- Formula/calculated results and the approved formula for each applicable Parameter.
- The exact analyser models, their RS-232/network format, and their approved Instrument-to-Parameter mappings.
- The clinical formula and input fields for each formula-calculated Parameter; formula Parameters must not be enabled until the laboratory director approves them.

#### Sprint 6 future readiness — analyser / instrument connectors

Vexel will later be able to receive results from laboratory analysers through an RS-232 serial cable or a network connection. This is **not** permission to auto-publish clinical results now. Sprint 6 must instead create the foundations so manual entry and machine entry use the same Parameter fields and the same safety checks.

Build now:
1. Add an entry-source record to each saved result: `manual` or `instrument`, plus entered/received time and the responsible user or instrument.
2. Preserve the received machine value, unit, analyser flag and result time alongside Vexel's accepted result, so the original machine output can be reviewed.
3. Give each Parameter a stable local code and optional LOINC code. These are the identifiers a future connector uses to find the correct result field.
4. Define an Instrument-to-Parameter mapping record: tenant, analyser, analyser test/code, target Parameter, expected unit, active/inactive status and any approved conversion rule.
5. Define a received-result holding area with a unique message/result identity. A repeated analyser message must not create a second patient result.
6. Match received values to an existing order by barcode/specimen/order number and Parameter mapping. An unmatched value stays in a visible review queue; it must never be attached by guesswork.
7. Put machine values through exactly the same type, required-value, range, critical-value and audit checks as manual values.

Do later, after live analyser validation and laboratory sign-off:
- RS-232/network listener service;
- support for common analyser messages (ASTM and HL7 laboratory-result messages);
- automated matching and auto-release/auto-verification;
- critical-value notifications and analyser quality-control workflows.

**Done when for this foundation:** a future connector can send a value only to a mapped Parameter; duplicate or unmatched messages are safe; every accepted machine value remains traceable to its original message; and no machine result bypasses result validation, verification, tenant isolation or audit history.

#### T6.0 — Confirm by running the app
Run the operator result screen with a numeric, a dropdown ("enum"/coded) and a yes/no parameter; save a parameter with allowed values in Admin; save a range with critical limits; record what really happens for R1–R9. **Size:** S.

| Ref | Suspected issue (plain words) | Planned fix |
|---|---|---|
| R1 | The API calls types `numeric`/`enum`; the operator screen looks for `number`/`select`. So numbers show as plain text, dropdowns never appear, and automatic high/low marking never fires. (`apps/api/src/results/results.service.ts` ~l.269; operator results pages.) | Use one vocabulary everywhere (contract, API, screen). |
| R2 | The list of allowed choices is stored in inconsistent ways (text in DB, array in contract, comma text in admin form, raw text in import). Saving from Admin probably fails. | Choose one format (a list) and use it in database, contract, admin, import and workbook. |
| R3 | The default value is set on the parameter but never sent to the result screen, so nothing is pre-filled. | Include the Parameter-level starting behaviour in the response and mark a pre-filled value as needing confirmation. |
| R4 | The server accepts any text for any result type; decimal places and "required" are never checked. The old visit-level result route checks nothing at all. | Validate by result type on the server (also removed by T3.3 for the old route). |
| R5 | The "critical" flag is never produced; the flag routine re-reads the range text and cannot read negative numbers; text results get no flag. | Build a proper flag evaluator that uses the stored numbers and the critical limits. |
| R6 | When several ranges exist, the wrong one may win (a parameter-wide range beating a test-specific one). Stored ranges are never re-checked. | Pick the most specific range; define when to re-resolve. |
| R7 | The Admin range form sends fields the database does not have, so some saves probably fail. | Align the form with the schema. |
| R8 | The printed report shows "Normal" for empty flags on text/choice results; flags are not coloured; long text wraps badly. | Fix the PDF templates. |
| R9 | The old visit-level result path accepts anything without validation. | Removed with T3.3. |

**Implementation rule for `*`:** on every save, the API converts an empty editable manual field (or a literal `*`) to an explicit `omitted` state with the actor and time; it must not store `*` as the ordinary result value. The returned result detail keeps the Parameter visible and marks it omitted so the worker can replace it with a real value later. Verification queries and PDF generation exclude omitted Parameters consistently.

**Implementation rule for flags:** add a Parameter-level “Print flag on report” setting. When enabled, the PDF shows `↑` for High, `↓` for Low, and a clearly stronger red `↑!` for Critical. When disabled, the warning remains in Vexel for safety and audit purposes but is not printed beside that Parameter.

**Implementation rule for formula Parameters:** Formula configuration belongs to the Parameter catalogue, alongside result format and defaults. It contains: a safe approved formula (not executable code), the named input Parameter codes, the output unit, decimal places and rounding rule. The operator screen shows the formula field as read-only and refreshes its displayed value immediately whenever an input changes. At first delivery, inputs must be from the same test. A later extension may use associated tests from the same visit only after clear matching and workflow rules are approved. Vexel saves the formula version, the input values used and the calculated result together. If an input is omitted (`*`) or unavailable, the calculated result is also omitted and is not verified or printed. Cycles (A depends on B while B depends on A) are prohibited. Manual override of a calculated result is prohibited unless a later, audited correction workflow explicitly allows it.

- **Done when:** each item is either confirmed-and-fixed or confirmed-not-a-problem, with a test.
- **Size:** L in total.

---

### SPRINT 7 — Catalogue features and import

The 329-test legacy catalogue is built (`docs/catalog/build/v2/`) but cannot be loaded completely until Vexel can hold what it contains. Full detail: `docs/catalog/build/v2/workdetails.md`.

#### Step 1 features (needed for go-live)

| Ref | Missing feature | Why it is needed | Size |
|---|---|---|---|
| C1 | **Free-text reference text on a range** (new field, e.g. `referenceText`), shown on the result screen and printed. The importer must also read the sheet's `notes` (currently dropped, `apps/api/src/catalog/catalog-import-export.service.ts` `_importReferenceRange` ~l.912–1010) and stop creating empty range rows. | 208 legacy ranges (~102 distinct texts: "Negative", age groups, result bands, hormone tables) cannot be stored today and must not be lost. | M |
| C2 | **Paragraph (long text) result type** with a multi-line box and multi-line printing. | Biopsy/ECG-style narrative reports. | M |
| C3 | **Heading rows** inside multi-parameter tests (e.g. "Differential Count") — skipped during result entry, printed as a sub-title. | Legacy tests use empty "parameters" as headings; a fake parameter shows a useless input box. | M |
| C4 | **Date result type** (and decide about calculated/formula type). | Legacy has Date and Formula types; today both are mapped to plain text/number. | S–M |

#### Import work (after C1–C4)
1. Regenerate the v2 workbook: put the 208 range texts into the reference-text column; mark heading rows; set paragraph/choice types for the 24 tests that have no parameters (agree with the lab); fill the 28 choice lists; add print-alone flags (T4.3); capture active/disabled status.
2. Re-run the workbook checks (`workdetails.md` §9.4).
3. Dry-run import (`POST /catalog/import/workbook?validate=true`) into a **test** lab; fix every error.
4. Real import; export it back and compare with the source workbook.
5. Spot-check in the screens: register a visit, enter results for CBC, Lipid Profile and HB, check ranges/units/order/print.
- **Do not** import the 208 empty range rows before C1 exists.
- **Done when:** dry run has no errors, the round-trip comparison matches, and the spot checks pass.

#### Data clean-up tasks (owner/lab involvement — not code)
| Ref | Task |
|---|---|
| K1 | 18 tests have no sample type — fill later (not a blocker). |
| K2 | 28 choice-type parameters have no option lists — lab director supplies them. |
| K3 | 24 legacy tests have no result fields — decide their result types with the lab. |
| K4 | Parameter quality: 14 unit conflicts, 7 type conflicts, Hematocrit typed as text, duplicate MCV rows in `t2315`/`t2316`, gaps/ties in display order, typos in names. |
| K5 | `isActive` is assumed true for all tests; capture the legacy Active/Disabled status. |
| K6 | Not started: 34 priced "Custom" tests, 2,340 zero-price tests (business decision), Packages → Panels, turnaround times/machines/methods, print templates per test, LOINC codes. |
| K7 | Clinical sign-off by the lab director for the whole catalogue. |

---

### SPRINT 8 — Proof and go-live readiness

| Ref | Task | Done when |
|---|---|---|
| G1 | **Two-lab acceptance test suite** covering documents, results, catalogue, users, jobs and audit. | PASS — live two-tenant acceptance completed against both public tenant domains; the temporary Tenant B fixture is documented and does not include the blocked 329-test import. |
| G2 | **Rewrite the false-positive multi-test test.** The current multi-test test passes while the bug exists (`apps/e2e/tests/lims/02-happy-path-multi-parameter.spec.ts`, `09-happy-path-multi-parameter.spec.ts`). | PASS — 3/3 browser scenarios assert every ordered test has a result and the report contains both tests and the entered value. |
| G3 | **Clean-server setup, rollback and restore proof.** Start from an empty server; rotate secrets; roll back; restore from backup on a fresh machine. | PARTIAL/PASS — current-server destructive restore with a safety snapshot, secret rotation, service restart and public health/routing proof passed; a separate fresh machine was not available in this session. |
| G4 | **Old-command cleanup.** Two receive/verify command families still overlap; move all users off the deprecated ones. | PASS for active UI — all encounter navigation now uses the newer per-test family; legacy URLs are redirect-only compatibility routes with no deprecated API calls. Backend aliases remain available only for existing integrations. |
| G5 | **Refresh-token speed (P2-010).** Today login refresh scans every stored token with a slow check, so many sessions slow it down and enable denial-of-service. | PASS for implementation and live behavior — indexed SHA-256 lookup plus bcrypt proof is implemented; normal login/refresh returned 200, replay returned 401, and replay is audited. A high-volume load test remains operational follow-up. |
| G6 | **Document lifecycle wording (P2-011).** Documents start as RENDERING instead of the documented QUEUED. | PASS — one agreed state machine in code, contract and docs. |
| G7 | **Immutable document history** after corrections/amendments. | PASS — API test proves a corrected payload creates a new document version and does not overwrite the earlier version. |
| G8 | **User acceptance testing** with a real operator and a real verifier. | Written sign-off. |

Advanced catalogue features (**later**, after go-live):
C5 expected-text results (e.g. "Negative" is normal) · C6 named result bands (Negative/Borderline/Positive) · C7 age in days/weeks/months (and the `ageMin = 0` stored-as-empty bug) · C8 pregnancy/trimester/cycle-phase/menopause qualifiers · C9 inclusive vs exclusive bounds and negative bounds · C10 critical/panic values with an alert · C11 structured ranges on the printed report · C12 specimen-specific ranges and per-parameter interpretation notes.

---

## 4. Decisions still needed from the owner

| Ref | Question | Suggestion |
|---|---|---|
| O1 | Go-ahead to start approved work? | **DECIDED:** owner approved all tasks marked `IN PROGRESS` in the execution trackers. |
| O2 | Who controls the server for T0.1 (password/secret rotation and restart window)? | Name a person and a time window. |
| O3 | Which tests are "print alone"? | Engineers propose a list from the 329 tests (CBC, LFT, RFT, Lipid Profile, Urine R/E, any test with many parameters); owner confirms. |
| O4 | Will other people (not the owner) test and give lab sign-off? | Name the lab director / senior technologist for K7 and G8. |
| O5 | How should the refund entry look for cancelled tests that were only partly paid? | Decide after T3.2 investigation of the billing code. |

---

## 5. Testing rules for all work above

These follow the project's own rules (`CLAUDE.md`):

- **Contract first:** change `packages/contracts/openapi.yaml` first, then run `pnpm sdk:generate`. Frontends only use the generated SDK.
- **Every command writes an audit record** and, when the move is not allowed, returns **409**.
- **Every table/query is tenant-scoped.**
- **Before finishing UI work:** `npx tsc --noEmit` and `npx next lint` in `apps/admin` and `apps/operator`; `pnpm ui:color-lint`.
- **Before finishing API work:** `pnpm --filter @vexel/api test`; SDK regenerated with no drift.
- **Key test scenarios for the per-test workflow (G2):**
  1. Two tests, verify one → visit stays in progress; report says PARTIAL and lists the pending test.
  2. Verify both → visit complete; report has both and no PARTIAL stamp.
  3. Reject one sample → other test continues.
  4. Cancel one test → invoice reduced, refund entry created, visit completes without it.
  5. Two different users verify different tests.
  6. Verify a test with no result → 409.
  7. Print with everything ticked includes tests printed before; unticking removes only those.
  8. CBC (print alone) prints alone on its page; the next test starts a new page.
  9. Break the audit write on purpose → the change is rolled back.
  10. User in lab A cannot see lab B's audit records, results or documents.

---

## 6. Evidence and limits

- P0/P1/P2 findings come from the audit dated **2026-09-01** and were spot-checked against the current code on 2026-09-20 (audit endpoint still accepts a client `tenantId`; the three visit-level shortcuts in T2.0 exist as described). No code commits since then.
- **Not run:** the app was not started for this review. Anything in Sprint 6 (R1–R9) and the exact multi-test behaviour beyond the audit's runtime proof must be confirmed by running the app.
- **Current verification blocker (2026-09-20):** API, Admin and Operator TypeScript checks pass; API tests pass (37 suites, 270 tests); SDK generation passes. The PDF C# project could not be built because the `dotnet` command is not installed in this workspace. Install the .NET SDK or run the PDF build in the Docker image before marking PDF-related Sprint 6/C2/C3 tasks `PASS`.
- Billing (T3.2) and the exact PDF page-break change (T4.3) have been read only lightly; sizes may change once investigated.
- Related documents: `docs/discovery/LIMS_PRODUCTION_READINESS_AUDIT.md`, `docs/discovery/LIMS_RELEASE_GAP_LEDGER.md`, `docs/discovery/_work/LIMS_AGENT_FINDINGS.md`, `docs/catalog/build/v2/workdetails.md`, `docs/specs/LIMS_WORKFLOWS.md`.
