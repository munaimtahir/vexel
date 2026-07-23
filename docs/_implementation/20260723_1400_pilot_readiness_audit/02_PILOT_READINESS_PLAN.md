# Vexel — Plan to Pilot

**Date:** 2026-07-23
**Based on:** `01_TECHNICAL_AUDIT.md` in this folder.
**Status:** Plan only — no implementation has been done as part of this pass (by explicit choice: this session was scoped to audit + plan, not build). Each phase below is sized so a future session can execute it directly.

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

## Phase 1 — Close the two real code gaps

1. **Cash/financial module.** Decide: is `apps/api/src/cash/` supposed to exist as a dedicated module, or is `CashTransaction` handled inline inside `encounters.service.ts`? Trace `encounters:collect-due` / `:apply-discount` end-to-end to confirm which. If nothing writes `CashTransaction` rows today, that's a correctness gap for any pilot that touches money — implement it or explicitly descope payments from the pilot.
2. **`logs` module.** Confirm what backs `GET /system-logs` (no service file was found). If it's a legitimate passthrough to another module's data, document that; if it's returning stub/empty data, decide whether the pilot needs a real log viewer and build it or descope it.
3. Clean up the two known pieces of tech debt while you're in the area (small, low-risk, don't block the above):
   - Delete the legacy unnamespaced redirect-stub routes in `apps/operator` (`/worklist`, `/results`, `/verification`, `/patients`, etc.) now that `/lims/*` fully covers them.
   - Delete the dead `jobs` stub queue in `apps/worker/src/main.ts` (the `setTimeout(100)` one with no producer).
   - Fix the inline `style={{}}` usage in `apps/admin/src/app/(protected)/branding/page.tsx` to use CSS variables, per the project's own lint rule.

---

## Phase 2 — Prove it live (this is where the stale prior "PASS" verdicts get re-earned)

The existing truthmap/logs/feature-flags/PDF-worker/auth-classification PASS verdicts are good *code* evidence but were only ever validated against a local docker-compose stack. Once Phase 0 is done:

1. Run the full `apps/e2e` suite (`pnpm --filter @vexel/e2e test`, then `e2e:smoke`, `e2e:lims`, `e2e:tenancy`, `e2e:security`) against the now-live stack and record pass/fail — this has apparently never been run in CI at all (the only workflow is manual-trigger-only).
2. Manually walk the golden path once as a human would: register patient → order test → collect specimen → enter result → verify → publish document → download PDF, on the actual public URL, for both a normal role and a cross-tenant check to confirm isolation holds live, not just in unit tests.
3. Re-run the OPD golden path too if OPD is going to be part of the pilot scope (see Phase 4 decision) — it's more built than AGENTS.md suggested, but wasn't independently live-verified in this audit.
4. Correct the stale "tested on production" claim in `docs/_implementation/20260529_0300_feature_flags_logs_runtime_proof/01_SUMMARY.md` (or annotate it) so future readers don't repeat the mistake AGENTS.md made.

**Exit criteria:** a fresh, dated verdict doc exists that says PASS/FAIL against the *public* URL, not localhost.

---

## Phase 3 — Put a real safety net under `main`

1. Wire `manual-e2e.yml` (or a new workflow) to run automatically on `pull_request`/`push` to `main` — at minimum lint + `tsc` + API unit tests on every PR; the full Docker+Playwright run can stay a slower/manual/nightly job if resource cost is a concern, but *something* should gate merges automatically. Right now nothing does.
2. Add a scheduler for `ops-backup` (a simple BullMQ repeatable job or external cron hitting the existing backup job endpoint) — the backup *code* is solid, but nothing currently triggers it periodically.
3. Backfill test coverage for the zero-spec backend modules that matter most for a pilot: `results`, `verification`, `sample-collection`, `patients` (these are the modules on the pilot's actual daily critical path — `jobs`/`logs`/`roles` are lower priority).

---

## Phase 4 — Scope the pilot itself

This is a product decision, not a technical one, but the audit gives you the inputs:

- **LIMS core is the safe pilot scope** — it's the most complete, most tested, and most architecturally locked-down part of the app.
- **OPD is a real option, not just a "future module"** — it's substantially built (13 wired pages, real contract, command-only pattern followed). If there's appetite, it could plausibly be included, but it wasn't independently live-verified here and has less test coverage than LIMS.
- **Billing/cash needs the Phase 1 gap closed first** if the pilot will touch money at all (OPD billing invoices/payments exist and look built; LIMS-side cash collection is the module with the actual gap).
- Recommend explicitly writing down pilot scope (which modules, which tenant(s), how many users) in a short doc before Phase 0 finishes, so Phase 2's live verification walks exactly the paths the pilot will use.

---

## Suggested sequencing

Phase 0 must go first (nothing else is checkable without it). Phase 1 and the tech-debt cleanup can happen in parallel with Phase 0 (they're pure code changes, no live stack needed). Phase 2 depends on both 0 and 1. Phase 3 can start any time but should land before real pilot users touch `main` regularly. Phase 4 (scope decision) should happen early — ideally before Phase 2's live verification, so that pass verifies the right thing.
