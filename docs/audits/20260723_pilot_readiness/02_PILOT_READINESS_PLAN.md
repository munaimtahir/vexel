# Vexel — Plan to Pilot

**Date:** 2026-07-23 (updated same day after scope clarification)
**Based on:** `01_TECHNICAL_AUDIT.md` in this folder.
**Status:** Plan only — no implementation has been done as part of this pass (by explicit choice: this session was scoped to audit + plan, not build). Each phase below is sized so a future session can execute it directly.

**Scope clarification added in this revision:** "pilot-ready" for LIMS means the *complete* patient cycle — registration through report printing — must be verified working end-to-end on the live system, not just present in code. It also now explicitly includes (a) verifying or building the backup system, and (b) a new LIMS operational-reports (MIS) capability that did not exist in the original audit scope: patient history, date-wise registration counts, worklist-by-status, a reports list, and receipt/encounter status lookup.

The plan is ordered by dependency, not by importance — you cannot validate anything until the stack is back up, so that comes first regardless of how small the remaining code gaps are.

---

## Phase 0 — Bring the stack back up (blocking everything else)

1. `docker compose up -d` from `/home/munaim/srv/apps/vexel` and watch for the Redis-race failure that killed it last time — confirm `depends_on` health-check ordering for `api`/`worker` against `redis` in `docker-compose.yml`, add a `restart: unless-stopped` policy if not already present so a transient race self-heals instead of leaving the stack dark for weeks.
2. Confirm data survived: check `vexel_pgdata` / `vexel_minio_data` mount correctly and existing tenant/demo data is intact (`psql` row counts, MinIO bucket listing) before doing anything else.
3. Re-add `vexel.alshifalab.pk` (and its `api.`/asset routes as needed) to `/home/munaim/srv/proxy/caddy/Caddyfile`, matching the pattern of the other apps already routed there (lims.alshifalab.pk etc.), then `caddy reload`.
4. Re-verify the four "Live endpoints" claims in `AGENTS.md` §"Live endpoints verified" against the real public URL this time (not `127.0.0.1:9021`) and update AGENTS.md with the corrected, honestly-dated status.
5. Decide and document *why* it went down, so it doesn't recur silently — at minimum, add an uptime check (even a simple external ping/cron hitting `/api/health` and alerting on failure) since there is currently no monitoring that would have caught a 7-week outage.

**Exit criteria:** `curl https://vexel.alshifalab.pk/api/health` returns `200 {"status":"ok"}` from outside the host, and a human can log into both apps with the documented demo credentials.

---

## Phase 1 — Close the two known code gaps

1. **Cash/financial module.** Decide: is `apps/api/src/cash/` supposed to exist as a dedicated module, or is `CashTransaction` handled inline inside `encounters.service.ts`? Trace `encounters:collect-due` / `:apply-discount` end-to-end to confirm which. If nothing writes `CashTransaction` rows today, that's a correctness gap for any pilot that touches money — implement it or explicitly descope payments from the pilot. This is on the critical path for "complete patient cycle" if the pilot lab collects payment at registration/reporting (most labs do), so treat it as blocking, not optional.
2. **`logs` module.** Confirm what backs `GET /system-logs` (no service file was found). If it's a legitimate passthrough to another module's data, document that; if it's returning stub/empty data, decide whether the pilot needs a real technical log viewer and build it or descope it. (This is the *technical/audit* log viewer — separate from the new LIMS operational reports in Phase 3.)
3. Clean up the two known pieces of tech debt while you're in the area (small, low-risk, don't block the above):
   - Delete the legacy unnamespaced redirect-stub routes in `apps/operator` (`/worklist`, `/results`, `/verification`, `/patients`, etc.) now that `/lims/*` fully covers them.
   - Delete the dead `jobs` stub queue in `apps/worker/src/main.ts` (the `setTimeout(100)` one with no producer).
   - Fix the inline `style={{}}` usage in `apps/admin/src/app/(protected)/branding/page.tsx` to use CSS variables, per the project's own lint rule.

---

## Phase 2 — Complete patient-cycle readiness (the core pilot requirement)

This is the requirement that actually defines "pilot-ready": every step of the lab's daily patient cycle must work, live, without gaps, for a real staff member to rely on it. Verify each step explicitly — don't just confirm the code exists (the audit already did that); confirm it *works* on the running system:

1. **Patient registration** — new patient, existing-patient lookup by mobile number, MRN assignment.
2. **Order tests** — select tests/panels against the live catalog, confirm pricing appears correctly if pricing is part of the pilot.
3. **Receipt generation at registration** — confirm the registration receipt prints/downloads correctly (this was flagged in AGENTS.md as depending on a polling loop that can be flaky if the worker is slow — re-verify timing live, not just that it eventually works).
4. **Specimen collection** — collect + receive specimen, barcode flag behavior if used.
5. **Sample worklist** — confirm newly collected specimens actually appear (AGENTS.md previously noted only encounters created *after* a specific fix would show up — confirm this is no longer an issue on current data).
6. **Result entry** — enter results per ordered test, confirm save vs. submit behavior, confirm late-entry lock behavior (locked fields stay locked, empty fields remain editable) if that's in scope.
7. **Verification** — verifier queue, verify action, return-for-correction path (test both the happy path and the correction/rejection path — a pilot will hit both).
8. **Publish + generate report** — confirm the lab report document renders correctly, hash-verifies, and downloads.
9. **Print the final report** — this is the step the audit didn't independently confirm: walk through actually printing (not just downloading) the PDF as lab staff would at the counter, on the real printer/workflow intended for the pilot site. Confirm formatting (headers, logo/branding if used, parameter tables, reference ranges, signature block) looks correct on paper, not just on screen.
10. **Cross-check with a second tenant** — repeat steps 1–9 as / against a second tenant to confirm nothing leaks across tenant boundaries live, not just in unit tests.

Also fold in the previously-planned live re-verification work:
11. Run the full `apps/e2e` suite (`pnpm --filter @vexel/e2e test`, then `e2e:smoke`, `e2e:lims`, `e2e:tenancy`, `e2e:security`) against the now-live stack and record pass/fail — this has apparently never been run in CI at all.
12. Correct the stale "tested on production" claim in `docs/_implementation/20260529_0300_feature_flags_logs_runtime_proof/01_SUMMARY.md` (or annotate it) so future readers don't repeat the mistake AGENTS.md made.

**Exit criteria:** a real staff member (or a very close simulation) can take one patient through registration → printed report, twice, on two different tenants, with no manual workarounds, and a fresh dated verdict doc records this as PASS/FAIL against the *public* URL.

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

**Financial (if payments are in pilot scope, see Phase 1)**
- Daily collection / cash report — total collected, by payment mode, by staff member who collected it
- Outstanding/due payments report — patients with unpaid balances
- Discounts report — discounts applied, by whom, with any approval trail
- Test-wise / panel-wise revenue report

**Management / statistical (usually Admin-facing, not Operator)**
- Test volume report — most/least ordered tests and panels, by day/week/month
- Referring-doctor report — test volume attributable to each referring physician (common for lab-doctor referral relationships)
- Monthly/periodic statistical summary — a rollup combining several of the above for management review
- Tenant/branch comparison, if the pilot ever spans more than one site

**Recommendation:** don't build all of these for a first pilot. Once Phase 2 (core cycle) is proven, sit down with actual pilot lab staff and confirm which of the above they genuinely need day one vs. later — the user's original five plus "pending/aging worklist" and "daily cash collection" are the most likely true day-one essentials based on how labs typically operate; the rest (TAT analytics, referring-doctor stats, productivity reports) are usually valuable but not blocking for a pilot.

### 3b. Verify the reporting/document design system before deciding how to build these

The audit found a real, working template-design tool: **Admin → Templates → Studio** (`apps/admin/src/app/(protected)/templates/studio/[id]/page.tsx`), a visual block-based editor (header, demographics, parameter-table, narrative, graph-scale, signature blocks, etc.) with full CRUD, versioning, activate/archive, and preview, feeding the same deterministic PDF renderer used for lab reports and receipts. This needs to be understood, later, before deciding how to build the new operational reports:

- Confirm what Template Studio is actually designed for today — it looks built for *clinical documents* (one-record-per-patient documents like `LAB_REPORT`/`RECEIPT`), not tabular/list-style MIS reports (e.g. "all patients registered this week" is a table of many rows, a different shape of document).
- Decide whether the new operational reports in 3a should: (a) reuse Template Studio/the block renderer if it can represent tables reasonably, (b) use a simpler, separate tabular export mechanism (on-screen table + CSV/PDF export, no visual template design needed), or (c) need a new lightweight "list report" building block added to the existing template system so both worlds share one design tool.
- Verify whether the existing PDF service (`apps/pdf`) can already render a generic tabular layout well, or whether tabular reports are better served client-side (e.g. render as an HTML table in the Operator/Admin UI with a "print" and "export CSV" button, no server PDF render needed at all — often the pragmatic choice for MIS reports vs. formal clinical documents).

This is explicitly a **verification task for later, not now** — the point of noting it here is so that when this phase starts, the first step is "go understand Template Studio and the PDF pipeline before choosing an implementation approach," not "assume a new system is needed from scratch."

**Exit criteria (once this phase is actually executed):** lab management can, without asking IT, answer "how many patients did we register last Tuesday," "which tests are still pending for which patients right now, and how long have they been waiting," "what's the full history for this patient," "what did we collect in cash today," and "what's the status of receipt #X" — from within the app, using a reporting mechanism whose design was deliberately chosen (reusing Template Studio, a simple table+export, or a new shared building block) rather than defaulted into.

---

## Phase 4 — Backup system: verify, then build only what's missing

The audit found real backup *code* (`apps/worker/src/ops-backup.processor.ts`: full backup, tenant export, restore-dry-run, restore-apply, healthcheck, retention via `OPS_BACKUP_RETENTION_DAYS`, restore gated behind `VEXEL_ALLOW_RESTORE=false`) — but no evidence it has ever actually been *run and proven* on this system, and no automatic scheduler triggers it.

1. **Verify what exists, live, before building anything new:**
   - Trigger a real full backup job via the Ops endpoints/Admin UI and confirm it actually produces a usable artifact (not just a "job completed" status).
   - Trigger `restore-dry-run` and confirm it reports something meaningful against the real backup produced above.
   - If safe to do in a non-production/staging copy, actually attempt `restore-apply` once, end-to-end, to prove the backup is genuinely restorable — a backup that has never been restored is unproven. Do **not** run this against the live pilot database without a tested rollback plan.
   - Confirm retention (`OPS_BACKUP_RETENTION_DAYS`) actually prunes old backups as expected.
2. **Only if the above reveals real gaps, build them.** Based on the audit, the one confirmed gap is scheduling: nothing currently triggers backups periodically ("schedule execution is external" per `docs/ops/BACKUP_POSTURE.md`, and no BullMQ repeatable job exists). Add a scheduler (BullMQ repeatable job or external cron hitting the existing backup endpoint) so backups run automatically, not just on-demand.
3. Document the verified backup/restore procedure in `docs/ops/BACKUP_POSTURE.md` with the actual proof (dates, artifact checks) rather than leaving it as an aspirational description.

**Exit criteria:** a dated doc exists showing a real backup was taken, a real restore-dry-run (and ideally a real restore) succeeded against it, and backups now run on an automatic schedule without manual triggering.

---

## Phase 5 — Put a real safety net under `main`

1. Wire `manual-e2e.yml` (or a new workflow) to run automatically on `pull_request`/`push` to `main` — at minimum lint + `tsc` + API unit tests on every PR; the full Docker+Playwright run can stay a slower/manual/nightly job if resource cost is a concern, but *something* should gate merges automatically. Right now nothing does — this is how a 7-week outage went unnoticed.
2. Backfill test coverage for the zero-spec backend modules that matter most for the pilot's daily critical path: `results`, `verification`, `sample-collection`, `patients`, and the new reports module from Phase 3 once built.

---

## Phase 6 — Confirm final pilot scope

- **LIMS core (Phases 0–5 above) is the required pilot scope** per this revision — "complete readiness" was explicitly requested, so treat the full patient cycle, backups, and operational reports as in-scope, not optional extras.
- **OPD remains a separate decision** — it's more built than AGENTS.md previously suggested (13 wired pages), but it's not part of the "complete LIMS readiness" requirement unless explicitly added. Recommend keeping it out of the initial pilot unless there's a specific need, since including it would roughly double the live-verification and reporting work in Phases 2–3.
- Confirm which tenant(s) and how many users will actually pilot, so Phase 2's live verification and Phase 3's reports are checked against the real pilot data shape, not just demo data.

---

## Suggested sequencing

Phase 0 must go first. Phase 1's code-gap fixes can happen in parallel with Phase 0. Phase 2 (full patient-cycle live verification) depends on both 0 and 1, and is the core pilot-readiness gate — nothing should be called "pilot-ready" before Phase 2 passes. Phase 3 (new reports) should start only after Phase 2 confirms the core cycle is solid, since the reports are built on top of that data. Phase 4 (backup) can run in parallel with Phases 1–3 — it's independent of the patient-cycle work. Phase 5 (CI safety net) can start any time but should land before pilot users are relying on the system day-to-day. Phase 6 (final scope confirmation) should happen early, informally, even though it's listed last — it determines exactly what Phases 2–3 need to verify/build.
