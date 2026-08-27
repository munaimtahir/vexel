# Vexel Build-Readiness Sprint — Release Readiness Report

**Date:** 2026-08-27
**Final commit:** `90a6720` on `main`, pushed to `origin/main`
**Prior handoff this session resumed from:** `SPRINT_HANDOFF.md` (repo root), state at `646d2b7`

This report is the closing deliverable for the sprint described in
`SPRINT_HANDOFF.md`. It covers everything done in the resume pass that
took the sprint from `646d2b7` to `90a6720`: implementation summary, files/
config changed, migration/rollback summary, the 13 validation-gate results,
current Docker/Caddy/public-endpoint status, and remaining risks (blocking
vs non-blocking).

---

## 1. Implementation summary

Eight commits, in order:

| Commit | Summary |
|---|---|
| `c5cf937` | Removed dead `permissions` claim from signed JWTs; threaded `correlationId` through `/auth/refresh` into its audit log (brief item 4, fully closed). |
| `7c8b188` | `init: true` (tini) for api/worker/pdf/admin/operator — proper signal handling/zombie reaping as PID 1. |
| `e56034a` | **Production incident fix**: `vexel.alshifalab.pk` had zero live routes in the shared Caddy config (unrelated pre-existing drift, not caused by this sprint). Restored routing with explicit human confirmation before the reload. Full writeup in `docs/ops/INCIDENTS.md`. |
| `f0afa30` | Fixed a stale container name in `ops/healthcheck.sh` (19/19 now, was 18/19); extended the scheduled uptime monitor to also check the public endpoint (it had a blind spot that missed the `e56034a` outage entirely); exercised the restore dry-run path live against a real backup artifact. |
| `6df75f2` | Closed two Compose boot-race gaps (`worker`→`minio`, `operator`→`api`); verified with a real `docker compose down && up` cold cycle. |
| `90a6720` | Fixed stale "auto-published" UI copy and a mislabeled "Force publish" button on the Operator publish page — found via a genuine (non-flaky) E2E failure. |

Plus the live LIMS path + tenant-isolation verification (brief item 6,
§6b) and the Admin workflow-mutation audit (§6e), both done via direct
API/DB verification rather than a code change (nothing non-compliant was
found in either).

## 2. Files and config changed

**Application code:**
- `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.controller.ts`
- `apps/operator/src/app/(protected)/lims/encounters/[id]/publish/page.tsx`

**Infra/ops:**
- `docker-compose.yml` (`init: true` ×5, `minio`/`api` depends_on additions)
- `ops/healthcheck.sh`, `ops/monitoring/health-check.sh`
- `.gitignore` (new state file)
- `/etc/caddy/Caddyfile` (live host file, **not in this repo** — see §4)
- `runtime/proxy/vexel.Caddyfile` (doc-comment correction only)

**Docs:**
- `docs/ops/INCIDENTS.md` (new)
- `docs/ops/UPTIME_MONITORING.md` (new)
- `docs/ops/SMOKE_TESTS.md` (document-pipeline and tenant-isolation sections rewritten to match verified live behavior)
- `SPRINT_HANDOFF.md` (progress tracked throughout)
- This file.

**Live-environment-only (not in git, by design — see `SPRINT_HANDOFF.md` §3):**
- `.env`: `VEXEL_ALLOW_RESTORE` toggled `false→true→false` in a controlled
  window to exercise the restore dry-run, ended back at `false`.
- `/etc/caddy/Caddyfile`: Vexel's site block restored (see `docs/ops/INCIDENTS.md`).

## 3. Migration and rollback summary

No Prisma schema migrations were made this pass. Two live-environment
changes had explicit rollback paths, both already exercised back to their
safe state:

1. **Caddy config**: backed up to
   `/etc/caddy/Caddyfile.bak.20260827_213548_pre-vexel-restore` before
   editing. Rollback: `cp` that file back over `/etc/caddy/Caddyfile` and
   `sudo caddy reload`. Not needed — the fix succeeded and was verified.
2. **`VEXEL_ALLOW_RESTORE`**: flipped to `true` in a controlled window to
   exercise the restore dry-run, immediately reverted to `false` and
   re-verified (`api`/`worker` recreated both times, confirmed `409` on a
   restore attempt afterward). Two pre-emptive `pg_dump` safety snapshots
   were taken this pass:
   `runtime/backups/full/pre-restore-dryrun-20260827_214226.dump` and the
   pre-existing `pre-jwt-rotation-20260825_071304.dump` from the prior
   session — neither was needed, both remain available.

No production data was deleted, migrated, or restored this pass.

## 4. Validation gates — all 13, live results

| # | Gate | Command | Result |
|---|---|---|---|
| 1 | Clean dependency install | `pnpm install --frozen-lockfile` | ✅ lockfile up to date |
| 2 | Prisma generation | `pnpm prisma generate` (in `apps/api`) | ✅ client generated |
| 3 | SDK freshness | `pnpm check:sdk-freshness` | ✅ no drift vs `openapi.yaml` |
| 4 | Lint, typecheck, build | `pnpm lint && pnpm typecheck && pnpm build` | ✅ 3/3, 6/6, 5/5 tasks succeeded (operator lint warnings are pre-existing `react-hooks/exhaustive-deps`, non-blocking) |
| 5 | API and SDK tests | `pnpm --filter @vexel/api test`, `pnpm --filter @vexel/sdk test` | ✅ 33/33 suites, 236/236 tests; ✅ 2/2 suites, 5/5 tests |
| 6 | Contract parity | `pnpm check:admin-openapi-parity` | ✅ 164 endpoint references, 63 files, PASS |
| 7 | Frontend SDK-only/no-Prisma | `pnpm ui:color-lint` + `no-restricted-imports` ESLint rule (`57d801f`) enforced live in gate 4's lint run | ✅ PASS |
| 8 | Docker Compose stack healthy | `docker compose ps` after a full `down && up -d` | ✅ 8/8 services healthy |
| 9 | All services' health checks | `bash ops/healthcheck.sh` | ✅ 19/19 |
| 10 | Caddy public/internal routing | `ops/healthcheck.sh`'s Caddy section + manual `curl` | ✅ (was failing at session start — see `docs/ops/INCIDENTS.md`, now fixed and verified) |
| 11 | E2E smoke: full LIMS path + two-tenant isolation | `pnpm --filter @vexel/e2e e2e:smoke`, then full `pnpm --filter @vexel/e2e test` | ✅ 41/41 smoke; ✅ 121/121 non-skipped in the full suite after the `90a6720` fix (was 120/121 before — see §5) |
| 12 | Document manual-generate/publish + retry/idempotency | Live API walkthrough (§6b) + `06-document-pipeline.spec.ts` (3/3) | ✅ RENDERED-then-manual-publish, idempotent republish, PDF download all confirmed live on a fresh record |
| 13 | CI workflow, clean-checkout-equivalent | `gh run list --branch main` | ✅ every push this session green, including the final commit (`90a6720`, run `33120741643`) |

**All 13 gates pass as of `90a6720`.**

## 5. Current status

- **Docker Compose**: 8/8 services healthy (`postgres`, `redis`, `minio`,
  `api`, `worker`, `pdf`, `admin`, `operator`), verified via both a
  per-service recreate cycle and a full cold `down && up`.
- **Caddy / public endpoint**: `https://vexel.alshifalab.pk/api/health`,
  `/admin`, and `/` (operator) all return `200`. This was **broken at the
  start of this session** (see `docs/ops/INCIDENTS.md`) — the fix and
  verification are the single highest-impact item in this pass.
- **CI**: green on every push this session, `main` @ `90a6720`.
- **E2E**: full Playwright suite (`operator`+`admin` projects,
  `@nightly`-excluded) passes 121/121 non-skipped (2 deliberately
  `test.skip`'d, unrelated to this pass). One genuine (non-flaky) failure
  was found and fixed mid-session (`90a6720`) — stale UI copy/button label
  left over from before the `da2047f` compliance fix, which happened to
  also break an E2E selector. One separate flake was observed later in
  the same file group (`admin/03-users-roles.spec.ts` — "seeded users
  appear in users list") caused by this session's own repeated full-suite
  runs pushing seeded demo accounts off the default (unpaginated, newest-
  first) users list page — a test-data-hygiene issue in the E2E suite
  itself, not an application bug. Non-blocking; see §6.

## 6. Remaining risks

### Blocking (for a genuine multi-tenant production rollout — not for continued single-tenant/demo use)

- **§6a — Production tenant ingress is not done.** The platform currently
  serves one real Caddy-routed domain (`vexel.alshifalab.pk`, mapped to
  the `system` tenant) plus one `*.localhost` dev-only tenant (`Tenant B`,
  not internet-reachable). The brief's requirement — platform domain plus
  at least two independently onboarded, internet-reachable tenant
  domains, with a documented onboarding/rollback procedure exercised
  end-to-end — genuinely needs real DNS records and a human decision
  about which second domain to provision; it cannot be simulated or
  completed by an agent alone. Everything *else* the item asks for is
  already confirmed working: Host header reaches the API unmodified
  through Caddy, a Host correctly resolves to its DB tenant, a spoofed
  `Host` or `x-tenant-id` cannot cross tenants (all live-verified in
  §6b/§4.9), and internal services stay loopback-bound (unchanged,
  already true). **This is the one item this report cannot mark done.**

### Non-blocking

- **E2E test-data hygiene**: repeated full-suite runs accumulate
  `e2e-*`/`test.vexel.*` users and encounters with no cleanup, which can
  push seeded demo data off default (unpaginated) list views and cause
  test flakes like the one noted in §5. Recommend either a teardown hook
  or search-based assertions instead of "visible on page 1" assertions.
  Not a product defect — the application itself has no such limitation
  (list endpoints are paginated correctly); this is purely a test-authoring
  gap.
- **Caddy overrides-import convention**: `runtime/proxy/vexel.Caddyfile`'s
  header comment used to claim an `import overrides/*.Caddyfile`
  mechanism that never actually existed on the live host — this
  contributed to how Vexel's block could be silently dropped with no
  fallback (§4.8/`docs/ops/INCIDENTS.md`). The comment now describes
  reality (manual sync required); formalizing an actual working
  overrides-import convention on the shared host would close this gap
  properly, but touches the shared Caddyfile for ~20 other products and
  needs a deliberate, separately-scoped change — not done this pass.
- **Uptime monitor has no external alerting.** `ops/monitoring/health-check.sh`
  (now checking both internal and public endpoints) only logs locally; it
  doesn't page or notify anyone. Documented as a known follow-up in
  `docs/ops/UPTIME_MONITORING.md`.
- **`docs/ops/BACKUPS.md`-documented Admin UI restore flow** (Admin → Ops
  → Restore → Dry Run) was exercised via direct API call, not by
  clicking through the actual Admin UI page. The underlying command is
  identical either way (same endpoint, same guard), so this is a
  low-risk verification gap, not an unverified code path.

## 7. Sprint completion status against the original 7 workstreams

1. Baseline + data protection — done (prior session, `f90a849`/`da2047f`/`e3f89fd`, this session's incident response).
2. CI quality gate repair — done (prior session `57d801f`, all gates reconfirmed green this session).
3. Document workflow compliance — done (prior session `da2047f`; this session added live proof on a fresh record plus fixed the last stale UI trace of the old behavior).
4. Auth/audit compliance — done (this session, `c5cf937`).
5. Production tenant ingress — **partially done**; the parts requiring only engineering effort are done and verified, the part requiring real DNS/a human decision is not (§6, blocking item).
6. Admin/workflow/operational verification — done (this session, §6b/§6e).
7. Ops/deployment hardening — done (this session: boot-race fixes, uptime monitor gap, restore dry-run, healthcheck script fix).
