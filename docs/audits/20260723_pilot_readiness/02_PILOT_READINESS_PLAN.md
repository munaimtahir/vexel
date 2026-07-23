# Vexel — Plan to Pilot

**Date:** 2026-07-23 (updated same day after scope clarification)
**Based on:** `01_TECHNICAL_AUDIT.md` in this folder.
**Status:** Plan only — no implementation has been done as part of this pass (by explicit choice: this session was scoped to audit + plan, not build). Each phase below is sized so a future session can execute it directly.

**Scope clarification added in this revision:** "pilot-ready" for LIMS means the *complete* patient cycle — registration through report printing — must be verified working end-to-end on the live system, not just present in code. It also now explicitly includes (a) verifying or building the backup system, and (b) a new LIMS operational-reports (MIS) capability that did not exist in the original audit scope: patient history, date-wise registration counts, worklist-by-status, a reports list, and receipt/encounter status lookup.

The plan is ordered by dependency, not by importance — you cannot validate anything until the stack is back up, so that comes first regardless of how small the remaining code gaps are.

## Execution process (confirmed)

- **Quality gate per phase.** Each phase below ends with a **Quality Gate**, not just an "exit criteria" description — a concrete, checkable pass/fail bar. Before moving to the next phase: run the gate's checks. If it fails, stop, fix the root cause, and re-run the gate — repeat until it passes. Do not advance on a failing gate and do not skip a gate to save time.
- **No stopping between phases.** Work continues autonomously through all phases once started; there is no per-phase check-in with the user required. The gates themselves are the checkpoint mechanism — a failing gate is what causes a pause (to fix), not a request for permission to proceed.
- **Git workflow: commit directly to `main` after each phase's gate passes.** No PRs, no feature branches, matching the docs workflow already used. Each phase's commit should land only after its gate is green.
- **CI/testing cadence:** fast checks (`tsc --noEmit`, lint, `pnpm --filter @vexel/api test`) run as part of every phase's gate where relevant. The full Playwright `apps/e2e` suite is **not** run repeatedly per phase — it runs once, as part of Phase 2's gate, against the live stack; any issues found there get fixed and the suite re-run until green, rather than wiring it into every phase.

---

## Phase 0 — Bring the stack back up (blocking everything else)

1. `docker compose up -d` from `/home/munaim/srv/apps/vexel` and watch for the Redis-race failure that killed it last time — confirm `depends_on` health-check ordering for `api`/`worker` against `redis` in `docker-compose.yml`, add a `restart: unless-stopped` policy if not already present so a transient race self-heals instead of leaving the stack dark for weeks.
2. Confirm data survived: check `vexel_pgdata` / `vexel_minio_data` mount correctly and existing tenant/demo data is intact (`psql` row counts, MinIO bucket listing) before doing anything else.
3. **Out of scope — do not touch.** Caddy configuration is managed outside this workstream; `vexel.alshifalab.pk` stays the live production target. Work here stops at "the stack is healthy and responding correctly on its internal ports" — routing is not something this plan changes.
4. Re-verify the four "Live endpoints" claims in `AGENTS.md` §"Live endpoints verified" against the real public URL this time (not `127.0.0.1:9021`) and update AGENTS.md with the corrected, honestly-dated status.
5. Decide and document *why* it went down, so it doesn't recur silently — at minimum, add an uptime check (even a simple external ping/cron hitting `/api/health` and alerting on failure) since there is currently no monitoring that would have caught a 7-week outage.

**Quality Gate 0 (must all pass before Phase 1):**
- [ ] `curl` to API health endpoint (internal port) returns `200 {"status":"ok"}`.
- [ ] Admin and Operator apps both reachable and demo-credential login succeeds on each.
- [ ] Data integrity confirmed: tenant/demo row counts in Postgres match pre-outage expectations; MinIO buckets list correctly.
- [ ] Confirmed no real patient data exists yet (pre-pilot state) — recorded explicitly, since this fact is relied on later in Phase 4.
- [ ] AGENTS.md corrected with honestly-dated, re-verified status.
- [ ] Uptime check in place and confirmed firing correctly (e.g. deliberately stop a container briefly and confirm the alert fires, then restart it).
- If any check fails: stop, diagnose (e.g. re-check the Redis boot-race), fix, re-run the full gate. Commit to `main` only once all boxes are checked.

---

## Phase 1 — Close the two known code gaps

1. **Cash/financial module — build it complete, not descoped (confirmed decision).** `apps/api/src/cash/` is an empty directory today despite a live `CashTransaction` Prisma model and `encounters:collect-due` / `:apply-discount` commands referencing it. Trace what those commands currently do (likely writing encounter fields directly without a proper transaction ledger) and build out a real cash/payments module: transaction ledger (who collected, how much, payment mode, linked encounter/receipt), discount handling with a record of who applied it, and the data this needs to feed the financial reports added to Phase 3 (daily collection, outstanding dues, discounts, revenue). This is on the critical path for "complete patient cycle" and is blocking, not optional.
2. **`logs` module.** Confirm what backs `GET /system-logs` (no service file was found) — this is the low-level technical/system log viewer (server errors, request traces), distinct from the workflow-level activity reports now added to Phase 3. Fix it if it's stubbed; it's lower priority than the workflow log reports but should still work.
3. Clean up the two known pieces of tech debt while you're in the area (small, low-risk, don't block the above):
   - Delete the legacy unnamespaced redirect-stub routes in `apps/operator` (`/worklist`, `/results`, `/verification`, `/patients`, etc.) now that `/lims/*` fully covers them.
   - Delete the dead `jobs` stub queue in `apps/worker/src/main.ts` (the `setTimeout(100)` one with no producer).
   - Fix the inline `style={{}}` usage in `apps/admin/src/app/(protected)/branding/page.tsx` to use CSS variables, per the project's own lint rule.

**Quality Gate 1 (must all pass before Phase 2):**
- [ ] Cash module implemented: `:collect-due` / `:apply-discount` write real `CashTransaction` records; unit tests cover collection, discounting, and the ledger read path.
- [ ] `GET /system-logs` confirmed backed by real data (fixed if it was stubbed).
- [ ] Dead routes/queue removed; branding page inline styles converted to CSS variables.
- [ ] `pnpm --filter @vexel/api test` green (full suite, including new cash tests).
- [ ] `npx tsc --noEmit` clean in `apps/api`, `apps/admin`, `apps/operator`.
- [ ] `npx next lint` clean in `apps/admin`, `apps/operator`.
- If any check fails: stop, fix, re-run the full gate. Commit to `main` only once all boxes are checked.

---

## Phase 2 — Complete patient-cycle readiness (the core pilot requirement)

This is the requirement that actually defines "pilot-ready": every step of the lab's daily patient cycle must work, live, without gaps, for a real staff member to rely on it. Verify each step explicitly — don't just confirm the code exists (the audit already did that); confirm it *works* on the running system:

1. **Patient registration** — new patient, existing-patient lookup by mobile number, MRN assignment.
2. **Order tests** — select tests/panels against the live catalog, **pricing confirmed in scope**: verify prices display correctly at order time and flow correctly into the receipt and the new cash module (Phase 1).
3. **Receipt generation at registration** — confirm the registration receipt prints/downloads correctly (this was flagged in AGENTS.md as depending on a polling loop that can be flaky if the worker is slow — re-verify timing live, not just that it eventually works).
4. **Specimen collection** — collect + receive specimen, barcode flag behavior if used.
5. **Sample worklist** — confirm newly collected specimens actually appear (AGENTS.md previously noted only encounters created *after* a specific fix would show up — confirm this is no longer an issue on current data).
6. **Result entry** — enter results per ordered test, confirm save vs. submit behavior, **late-entry lock confirmed in scope**: filled fields lock after submission, empty fields must remain editable — verify both halves of this explicitly.
7. **Verification** — verifier queue, verify action, return-for-correction path (test both the happy path and the correction/rejection path — a pilot will hit both).
8. **Publish + generate report** — confirm the lab report document renders correctly, hash-verifies, and downloads.
9. **Verify the printable PDF** — confirm the rendered PDF looks correct and print-ready (headers, logo/branding if used, parameter tables, reference ranges, signature block, sane page size/margins). Actual physical printing at the pilot site is outside this session's scope — this step verifies the PDF is print-ready, not a physical print test.
10. **Tenant isolation sanity check (non-blocking)** — since the pilot itself is scoped to a single tenant, this is a lighter technical check, not a pilot gate: confirm a second (test) tenant cannot see the pilot tenant's data, reusing existing tenancy test coverage rather than a full second walkthrough.

Also fold in the previously-planned live re-verification work:
11. Run the full `apps/e2e` suite once (`pnpm --filter @vexel/e2e test`, then `e2e:smoke`, `e2e:lims`, `e2e:tenancy`, `e2e:security`) against the now-live stack, fix whatever it finds, and re-run until green — per the agreed approach, this is a single consolidated e2e pass, not a per-phase run.
12. Correct the stale "tested on production" claim in `docs/_implementation/20260529_0300_feature_flags_logs_runtime_proof/01_SUMMARY.md` (or annotate it) so future readers don't repeat the mistake AGENTS.md made.

**Quality Gate 2 (must all pass before Phase 3) — this is the core pilot-readiness gate:**
- [ ] Steps 1–9 above all walked through live and pass, on the single pilot tenant, ending in a verified print-ready PDF.
- [ ] Pricing displays and flows correctly end-to-end (order → receipt → cash ledger).
- [ ] Late-entry lock behavior verified both ways (locked stays locked, empty stays editable).
- [ ] Return-for-correction path verified, not just the happy path.
- [ ] Tenant isolation sanity check passes.
- [ ] Full `apps/e2e` suite green (after fixing anything it finds).
- [ ] Stale "tested on production" claim corrected.
- [ ] A fresh, dated verdict doc records PASS against the live stack.
- If any check fails: stop, fix the root cause, re-run the full gate (including a fresh e2e pass if the fix touched tested code). Commit to `main` only once all boxes are checked.

---

## Phase 3 — LIMS operational reports (new capability — not previously scoped)

The audit found `/lims/reports` today only lists **published documents** (filterable by date preset and doc type), and the `system-logs` viewer is a technical/audit-trail tool. Neither of these is the day-to-day operational reporting a lab actually runs on. This is genuinely new work, not a gap-fill — plan it as such (new backend queries + at least one new Operator screen, possibly an Admin screen too for cross-tenant/management view). **Nothing in this phase is to be built or verified now — this is scope-definition for later work**, per explicit instruction: finalize the catalog and design approach, execute later.

### 3a. Standardized LIMS report catalog

The user's five examples (patient history, date-wise registration, worklist-by-status, reports list, receipt status lookup) are the starting point, not the full list. Below is a fuller catalog of reports that are standard/expected in commercial LIMS products, organized by category, to be reviewed and trimmed to what this pilot actually needs — not all of these are necessarily in scope, but they should be *considered* rather than discovered later as gaps:

**Front-office / registration**
- Daily/date-range registration report (patient count, list, filterable by referring doctor, tenant/branch if applicable) — *user's example*
- Patient search / master list with demographics and visit count
- Patient history / cumulative report (all visits, tests, results, documents for one patient) — *user's example*
- Duplicate-patient / possible-merge report (same mobile number or name+DOB registered multiple times)

**Workflow / operations**
- Worklist by status (ordered / collected / result-pending / result-entered / pending-verification / verified / published) — *user's example*
- Pending/incomplete tests report, with aging (how long each has been sitting in its current status — this is the natural next step once status is trackable, and usually the single most-used report in a working lab)
- Turnaround-time (TAT) report — time from order (or collection) to verification/publish, per test or department, average/median, and a flagged list of cases that breached an expected TAT
- Rejected / recollected specimen report, with rejection reasons
- Verifier/operator productivity — results entered or verified per staff member per day (useful for staffing, also doubles as an accountability report)
- Cancelled/voided encounters report, with reason

**Reports & documents**
- Reports list / register (published documents) — *user's example*, largely exists already
- Receipt / encounter status inquiry by ID — *user's example*, backend mostly exists already
- Reprint / re-download log (who reprinted which report, when — relevant for audit and for detecting document tampering concerns)
- Critical/abnormal result log — results flagged outside reference range, with notification/acknowledgement trail (a standard patient-safety report in real LIMS; whether this pilot needs it depends on whether critical-value flagging exists in the results module at all — needs checking)

**Workflow / activity log reports (confirmed in-scope, added per explicit request)**
This is a first-class category, not an afterthought: a complete, patient/encounter-centric view of every workflow action, built on top of the existing `AuditEvent` trail rather than the low-level technical `system-logs` viewer.
- **Encounter/case timeline report** — for one encounter, the full chronological action log: registered → ordered → collected → received → result entered → verified → published → (payment/discount events), each with actor, timestamp, and before/after where relevant. This is the "complete log report related to workflow" for a single case.
- **Staff activity report** — everything one staff member did in a date range (registrations handled, specimens collected, results entered, verifications performed, payments collected) — useful for shift handover and accountability.
- **Status-change/exception report** — every return-for-correction, cancellation, and void across a date range, with reason and actor — the "what went wrong and who touched it" report.
- **System-wide workflow activity feed** — a filterable, searchable feed across all encounters/tenants (Admin-facing) combining the above, essentially an operational audit browser built for readability rather than raw log dumps.

**Financial (confirmed in-scope — full payment module being built per Phase 1)**
- Daily collection / cash report — total collected, by payment mode, by staff member who collected it
- Outstanding/due payments report — patients with unpaid balances
- Discounts report — discounts applied, by whom, with any approval trail
- Test-wise / panel-wise revenue report
- Payment/discount events feed — every collection and discount as an auditable list (feeds the workflow/activity reports above too, since payment actions are workflow actions)

**Management / statistical (usually Admin-facing, not Operator)**
- Test volume report — most/least ordered tests and panels, by day/week/month
- Referring-doctor report — test volume attributable to each referring physician (common for lab-doctor referral relationships)
- Monthly/periodic statistical summary — a rollup combining several of the above for management review
- Tenant/branch comparison, if the pilot ever spans more than one site

**Recommendation:** don't build all of these for a first pilot. Once Phase 2 (core cycle) is proven, sit down with actual pilot lab staff and confirm which of the above they genuinely need day one vs. later. Confirmed day-one essentials so far: the user's original five, the full workflow/activity log category (encounter timeline, staff activity, exception report — explicitly requested), and the financial reports (since the payment module is being built complete, not descoped). "Pending/aging worklist" is strongly recommended to join that list — it's usually the single most-used report in a working lab. The remaining items (TAT analytics, referring-doctor stats, productivity reports, tenant comparison) are valuable but not blocking — confirm with pilot staff later.

### 3b. Verify the reporting/document design system before deciding how to build these

The audit found a real, working template-design tool: **Admin → Templates → Studio** (`apps/admin/src/app/(protected)/templates/studio/[id]/page.tsx`), a visual block-based editor (header, demographics, parameter-table, narrative, graph-scale, signature blocks, etc.) with full CRUD, versioning, activate/archive, and preview, feeding the same deterministic PDF renderer used for lab reports and receipts. This needs to be understood, later, before deciding how to build the new operational reports:

- Confirm what Template Studio is actually designed for today — it looks built for *clinical documents* (one-record-per-patient documents like `LAB_REPORT`/`RECEIPT`), not tabular/list-style MIS reports (e.g. "all patients registered this week" is a table of many rows, a different shape of document).
- Decide whether the new operational reports in 3a should: (a) reuse Template Studio/the block renderer if it can represent tables reasonably, (b) use a simpler, separate tabular export mechanism (on-screen table + CSV/PDF export, no visual template design needed), or (c) need a new lightweight "list report" building block added to the existing template system so both worlds share one design tool.
- Verify whether the existing PDF service (`apps/pdf`) can already render a generic tabular layout well, or whether tabular reports are better served client-side (e.g. render as an HTML table in the Operator/Admin UI with a "print" and "export CSV" button, no server PDF render needed at all — often the pragmatic choice for MIS reports vs. formal clinical documents).

This is explicitly a **verification task for later, not now** — the point of noting it here is so that when this phase starts, the first step is "go understand Template Studio and the PDF pipeline before choosing an implementation approach," not "assume a new system is needed from scratch."

**Quality Gate 3 (must all pass before Phase 4/5 are considered complete — Phase 3 can run in parallel with Phase 4):**
- [ ] Report catalog trimmed to the confirmed day-one set (five original examples + workflow/activity log category + financial reports + pending/aging worklist).
- [ ] Design approach for tabular reports decided (Template Studio reuse vs. table+export vs. new block type) and documented.
- [ ] Each confirmed report built, backed by a real endpoint (no mock data), and manually verified to return correct data against the pilot tenant.
- [ ] `pnpm --filter @vexel/api test` green, `tsc`/`lint` clean in both frontend apps.
- [ ] Lab management can, without asking IT, answer: "how many patients did we register last Tuesday," "which tests are pending right now and how long have they been waiting," "what's this patient's full history," "what did we collect in cash today," "what's the status of receipt #X," and "show me the full activity timeline for this case."
- If any check fails: stop, fix, re-run the full gate. Commit to `main` only once all boxes are checked.

---

## Phase 4 — Backup system: verify, then build only what's missing

The audit found real backup *code* (`apps/worker/src/ops-backup.processor.ts`: full backup, tenant export, restore-dry-run, restore-apply, healthcheck, retention via `OPS_BACKUP_RETENTION_DAYS`, restore gated behind `VEXEL_ALLOW_RESTORE=false`) — but no evidence it has ever actually been *run and proven* on this system, and no automatic scheduler triggers it.

1. **Verify what exists, live, before building anything new:**
   - Trigger a real full backup job via the Ops endpoints/Admin UI and confirm it actually produces a usable artifact (not just a "job completed" status).
   - Trigger `restore-dry-run` and confirm it reports something meaningful against the real backup produced above.
   - Attempt `restore-apply` once, end-to-end, to prove the backup is genuinely restorable — a backup that has never been restored is unproven. Since there is no real patient data in the system yet (pre-pilot, demo/seed data only), this can be tested directly against the current environment rather than requiring a separate staging copy — but re-confirm there's still no real data immediately before running it, since this assumption expires the moment real pilot data is loaded.
   - Confirm retention (`OPS_BACKUP_RETENTION_DAYS`) actually prunes old backups as expected.
2. **Only if the above reveals real gaps, build them.** Based on the audit, the one confirmed gap is scheduling: nothing currently triggers backups periodically ("schedule execution is external" per `docs/ops/BACKUP_POSTURE.md`, and no BullMQ repeatable job exists). Add a scheduler (BullMQ repeatable job or external cron hitting the existing backup endpoint) so backups run automatically, not just on-demand.
3. Document the verified backup/restore procedure in `docs/ops/BACKUP_POSTURE.md` with the actual proof (dates, artifact checks) rather than leaving it as an aspirational description.

**Quality Gate 4 (can run in parallel with Phases 1–3; must pass before pilot go-live regardless):**
- [ ] Real full backup triggered and produced a usable, inspectable artifact.
- [ ] `restore-dry-run` run and reported meaningful output against that artifact.
- [ ] A real `restore-apply` performed end-to-end and confirmed successful (safe to do now — no real data yet; re-confirmed immediately before running).
- [ ] Retention pruning confirmed working.
- [ ] Automatic scheduler added and confirmed firing (not just present in code).
- [ ] `docs/ops/BACKUP_POSTURE.md` updated with actual dated proof, not aspirational text.
- If any check fails: stop, fix, re-run the full gate. Commit to `main` only once all boxes are checked.

---

## Phase 5 — Put a real safety net under `main`

1. Wire `manual-e2e.yml` (or a new workflow) to run automatically on `pull_request`/`push` to `main` — lint + `tsc` + API unit tests on every push, since there's no PR gate in this workflow (direct-to-main). The full Playwright suite is **not** wired into this automatic gate (per the agreed approach: it runs once, in Phase 2, not repeatedly) — it can be added as a manual/nightly job later, outside this plan's scope.
2. Backfill test coverage for the zero-spec backend modules that matter most for the pilot's daily critical path: `results`, `verification`, `sample-collection`, `patients`, the new `cash` payment module from Phase 1, and the new reports module from Phase 3 once built.

**Quality Gate 5:**
- [ ] Automatic CI runs lint + tsc + API unit tests on every push to `main` and is confirmed working (push a trivial change and watch it run).
- [ ] Newly-added test coverage passes.
- If any check fails: stop, fix, re-run the full gate. Commit to `main` only once all boxes are checked.

---

## Phase 6 — Final pilot scope (confirmed)

- **Scope: complete LIMS module, single tenant.** OPD is explicitly **out** of this pilot. This is the confirmed target — Phases 0–5 above are scoped to deliver exactly this, nothing more, nothing less.
- Phase 2's live verification and Phase 3's reports are checked against this one pilot tenant's real data shape.
- No further scope decision is needed here — this phase is a confirmed constraint the other phases operate under, not an open action item.

---

## Suggested sequencing

Phase 0 must go first. Phase 1's code-gap fixes can happen in parallel with Phase 0. Phase 2 (full patient-cycle live verification, including the single consolidated e2e run) depends on both 0 and 1, and is the core pilot-readiness gate — nothing is called "pilot-ready" before Phase 2's gate passes. Phase 3 (new reports) starts only after Phase 2's gate is green, since the reports are built on top of that data. Phase 4 (backup) runs in parallel with Phases 1–3 — it's independent of the patient-cycle work. Phase 5 (CI safety net) can start any time but should land before the pilot is considered fully ready. Phase 6 (scope) is already confirmed and doesn't block sequencing — it's the constraint the rest of the plan was written against.

Execution proceeds phase by phase without stopping for check-ins; each phase's Quality Gate is the control point — fail it, fix, re-verify, then commit to `main` and move on.
