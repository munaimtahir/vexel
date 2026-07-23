# Vexel — Pilot-Readiness Technical Audit

**Date:** 2026-07-23
**Scope:** Full repository (apps/api, apps/worker, apps/pdf, apps/admin, apps/operator, apps/e2e, infra/deploy), cross-checked against prior self-authored audits in `docs/_implementation/` and `docs/_verification/` (all dated 2026-05-28/29).
**Method:** Static code review + doc cross-check, performed by parallel read-only research passes. No code was changed. `apps/api` unit tests were executed (mocked DB); nothing else was executed live because the stack is currently down (see §1).

---

## 1. Deployment reality — the headline finding

`AGENTS.md` states the app is **"LIVE"** at `https://vexel.alshifalab.pk` with a verified stack. This is **no longer true**:

- `docker compose ps -a` shows all `vexel-*` containers (`api`, `admin`, `operator`, `worker`, `pdf`, `postgres`, `redis`, `minio`) as **`Exited (255)` since ~7 weeks ago** (last commit `2026-05-29`, today `2026-07-23`).
- The API container's last logs show a boot-order race: `Error: connect ECONNREFUSED <redis-ip>:6379` — it tried to connect to Redis before Redis was ready and never recovered/restarted.
- `vexel.alshifalab.pk` **is not present at all** in the Caddy reverse-proxy config (`/home/munaim/srv/proxy/caddy/Caddyfile`) — no route exists for it today. A direct TLS probe to that hostname fails at the handshake (`tlsv1 alert internal error`).
- **Good news:** the Docker named volumes (`vexel_pgdata`, `vexel_minio_data`, plus an apparent second-attempt pair `vexel2_pgdata`/`vexel2_minio_data`) still exist. Data is very likely intact; this looks like an operational lapse, not data loss.

A second, independent staleness issue was found in the prior audit trail: `docs/_implementation/20260529_0300_feature_flags_logs_runtime_proof/01_SUMMARY.md` claims its tests ran "on the active production-grade environment at `https://vexel.alshifalab.pk`." The underlying evidence files actually show every call went to `http://127.0.0.1:9021` (a local docker-compose stack). That prose claim is inaccurate self-reporting, separate from the current outage.

**Net effect:** every PASS/GO verdict in the prior audit set (truthmap, logs, feature flags, PDF/worker retry, auth classification) was validated against a **local docker-compose stack**, not the public domain. That evidence remains structurally valid as a baseline for code correctness, but nothing in the repo currently proves the app works as deployed, because nothing is currently deployed.

---

## 2. Backend (`apps/api`) — NestJS

**Overall: strong.** 25 controllers, 274 route handlers, mapped against 203 OpenAPI path entries; spot checks show consistent contract alignment using the `:command` colon-suffix convention. 54 Prisma models, correctly tenant-scoped except for legitimately global tables (Tenant root, join tables, blueprints, worker heartbeat).

**Tests:** `pnpm --filter @vexel/api test` → **29 suites / 210 tests, all passing** (mocked Prisma, no live DB needed), run in ~90s during this audit. Coverage is uneven: catalog (6 spec files), documents (4), ops (3), templates (3) are well covered; **jobs, logs, opd, patients, results, roles, sample-collection, users, verification have zero spec files.**

**Governance rules from CLAUDE.md — verified, not just asserted:**
- Command-only workflow (rule 5): confirmed. `encounters.controller.ts` exposes only reads (`GET`) and colon-suffixed commands (`:order-lab`, `:collect-specimen`, `:receive-specimen`, `:result`, `:verify`, `:publish-report`, `:cancel`, `:collect-due`, `:apply-discount`). No PATCH/PUT anywhere on encounters.
- Feature flags (rule 7): confirmed tenant-scoped and backend-authoritative — `feature-flags.service.ts` keys every read/write off `tenantId`, audits every mutation.
- No TODO/FIXME/HACK/"not implemented" markers anywhere in `apps/api/src` — clean of explicit incomplete-work flags.

**Gaps found:**
| Item | Status | Detail |
|---|---|---|
| `apps/api/src/cash/` | **Empty directory** | `CashTransaction` Prisma model exists and `encounters:collect-due` / `:apply-discount` are live financial commands, but no controller/service implements a dedicated cash domain. Either this logic lives inline elsewhere (needs confirming) or the model is unused dead schema — either way it's a real gap between data model and code that should be resolved before any pilot that touches payments. |
| OPD schema duplication | **Tech debt** | Two parallel generations of OPD models coexist: an older `OPDVisit/OPDVitals/OPDClinicalNote/OPDPrescription` set and a newer `OpdEncounter/OpdVital/OpdNote/OpdEncounterPrescription/OpdPrescriptionItemKmvp/OpdCommandLog` set. Looks like an in-progress migration that was never cleaned up. Not currently breaking anything, but a maintenance/confusion risk. |
| `logs` module | **Thin/stub-like** | Single `@Get()` route, **zero service files**. Needs confirming where `/system-logs` data actually comes from before relying on it operationally. |
| `jobs` module | **Thin** | Controller has no direct Prisma references; likely delegates to a shared queue service, but this wasn't confirmed. Not contract-missing, just under-tested (0 specs). |

---

## 3. Frontend — `apps/operator` (LIMS) and `apps/admin`

**Overall: more complete than AGENTS.md currently claims.** `npx tsc --noEmit` passes with **0 errors** in both apps. SDK-only compliance is clean: no `fetch(`/`axios` usage outside the sanctioned `lib/api-client.ts` transport wrapper in either app, and zero Prisma imports.

**Operator (`/lims/*`):** every canonical route (`worklist`, `registrations/new`, `encounters/[id]` and its sub-actions, `sample-collection`, `results` + `[orderedTestId]`, `verification` + `[encounterId]`, `payments`, `reports`, `print/[id]`, `account`) is real and SDK-wired, not placeholder. AGENTS.md's "not tested end-to-end, should be validated" notes on results/verification are stale — the code is complete; what's actually missing is *live* validation, not the code.

**Legacy dead routes:** a set of unnamespaced duplicates (`/worklist`, `/results`, `/verification`, `/patients`, etc.) still exist as 8-line client-side redirect stubs to their `/lims/*` equivalents. Harmless today, but they violate the CLAUDE.md rule against unnamespaced top-level routes and should be deleted.

**OPD (`/opd/*`):** **AGENTS.md's "architecture ready, no features built" claim is stale.** 13 real pages exist (worklist, encounters, appointments, visits, billing, provider availability), all SDK-wired against real `Opd*` contract schemas. This is a substantially built module, not a stub — worth knowing before scoping "pilot," since it means OPD could plausibly be included or explicitly deferred, but it's not "not started."

**Admin branding:** also stale in AGENTS.md ("not wired") — `branding/page.tsx` is fully wired to `GET/PATCH /tenants/{tenantId}/config` with real form fields. One cosmetic caveat: it uses inline `style={{}}` objects, which is a direct violation of the CLAUDE.md "no inline style objects in new code" rule, and one disabled option is explicitly labeled "(coming soon)."

**Multi-order encounters:** also stale — `orderLab` already accepts adding tests to encounters already in `lab_ordered` status, and both order pages loop per-test. This already works.

**Admin app spec coverage:** all 7 MVP capabilities in `docs/specs/ADMIN_APP_SPEC.md` (Dashboard, Tenants, Users & Roles, Feature Flags, Catalog Admin, Audit Explorer, Jobs) have corresponding, wired pages. No gaps found against that spec.

---

## 4. Worker, PDF service, E2E suite, CI

**`apps/worker` (BullMQ):** real queues for `catalog-import`, `catalog-export`, `document-render` (concurrency 3), `ops-backup` (concurrency 1), each with its own error handling; `document-render` explicitly re-throws so BullMQ's native retry (3 attempts, exponential backoff) applies. Has its own `PrismaClient` reading `DATABASE_URL` directly, per the architectural rule. One dead artifact: a legacy `jobs` queue that's just a `setTimeout(100)` stub with no producer calling it — harmless cruft, should be deleted.

**`apps/pdf` (.NET QuestPDF):** a real, non-trivial renderer (`Program.cs`, ~2,964 lines) covering header/demographics/parameter-table/narrative/graph-scale/signature/disclaimer/section/image-grid blocks, consistent with the recent Template Studio / `GRAPHICAL_SCALE_REPORT` / `HYBRID_TEMPLATE` work in git history. Deterministic document pipeline (rule 6) is genuinely implemented end-to-end: PDF service returns an `X-Pdf-Hash` header, the worker persists it, `payloadHash` canonicalization has dedicated tests. One caveat found directly in code: a `HYBRID_TEMPLATE` graph-scale path has a comment stating "Full integration deferred." A separate proof doc (`docs/_implementation/20260528_2355_pdf_hash_worker_retry_proof/`) independently confirms hash determinism and correct FAILED-state handling on a bad template, but also flags that `issuedAt` on `LAB_REPORT` can shift on repeated verification — a minor, known non-determinism.

**`apps/e2e` (Playwright):** 35 spec files across auth, admin, documents, LIMS, operator, security, tenancy, smoke. Not executed in this audit (needs a live stack). `pnpm --filter @vexel/e2e test` runs everything except `@nightly` across two projects (operator, admin).

**CI (`.github/workflows/`):** **only one workflow exists, `manual-e2e.yml`, and it is `workflow_dispatch`-only — no `push` or `pull_request` trigger.** There is currently **no automatic gate on merges to `main`.** It does gate build/lint/SDK-tests/API-tests/Playwright smoke when run by hand, and there is no deploy workflow at all.

**Backup posture:** `apps/worker/src/ops-backup.processor.ts` implements real full-backup / tenant-export / restore-dry-run / restore-apply / healthcheck jobs, with retention (`OPS_BACKUP_RETENTION_DAYS`, default 30) and restore gated behind `VEXEL_ALLOW_RESTORE=false` by default. `docs/ops/BACKUP_POSTURE.md` itself admits "schedule execution is external in this release" — confirmed: there is no BullMQ repeatable/cron wiring for backups anywhere in the codebase. Backups are on-demand only; periodic execution depends on an external cron trigger that does not exist in this repo.

---

## 5. Prior-audit truthmap summary (verified still consistent)

`docs/_implementation/20260528_2350_truthmap_regeneration/` classifies 262 frontend↔backend↔contract mappings:
- `MVP_ACTIVE`: 215
- `FUTURE_NON_MVP`: 42
- `INTERNAL_SYSTEM`: 5
- `status: COMPLETE`: 262/262 (zero remaining `BROKEN`)

This is consistent with what the fresh backend/frontend passes in this audit found independently — no contradictions surfaced.

---

## 6. Summary verdict

| Layer | Verdict |
|---|---|
| Core LIMS workflow (register → order → collect → result → verify → publish) | **Built and appears complete**, both backend and operator UI, per code review. Not currently runnable to confirm live. |
| Contract discipline, tenant isolation, command-only state, audit trail | **Structurally sound**, verified in code, not just documented. |
| Deterministic documents | **Implemented**, one known minor non-determinism (`issuedAt` on repeat verification). |
| OPD module | **Substantially built**, contrary to stale docs saying otherwise — a scoping decision, not a build gap. |
| Cash/financial domain | **Gap** — schema and commands exist, implementation module is empty. |
| Automated safety net | **Gap** — no CI on push/PR to main; e2e suite exists but is manual-only. |
| Backup automation | **Gap** — implemented on-demand, no scheduler. |
| **Deployment** | **Down.** Nothing is currently running or publicly reachable. This is the actual blocker to "pilot," not missing features. |

The application is much closer to pilot-ready on the *code* axis than the *operational* axis. The single largest gap between "documented as live" and "actually usable by a pilot user today" is that the stack has been stopped for seven weeks and the public route was removed from the proxy config.
