# Vexel current-state baseline

Evidence snapshot: 2026-09-01 UTC. This document records executable truth before audit documentation was added.

## Repository

| Item | Current evidence |
|---|---|
| Branch | `main`, tracking `origin/main` |
| HEAD | `1ffda42e90a77ed86d87486ad0ac7a12dc35e477` — `docs(opd): refresh readiness evidence after hardening` |
| Initial worktree | Clean (`git status --short --branch` showed only `## main...origin/main`) |
| Historical conflict | The supplied `AGENTS.md` handoff names `2287b59`; it is stale relative to current Git truth. |
| Workspace | pnpm 9 monorepo: API, worker, PDF, Admin, Operator, E2E, Mobile scaffold, contracts, SDK, theme, UI system |
| Migrations | 33 directories; PostgreSQL reports 33 completed and 0 incomplete/rolled-back migrations |
| Generated output | SDK freshness regenerated with no diff. Live Playwright/tsbuildinfo outputs are tracked transient artifacts. |

No application code was changed or deleted. Audit commands created normal test records in the live `system` tenant. One OPD audit request changed invoice `4eba4c9b-c203-4043-a64e-76ea54678eff` from DRAFT to ISSUED and generated PUBLISHED receipt document `3abc09b0-06b7-487b-883c-fd104a81e4a8`; it was deliberately not rolled back. Build/test artifacts modified by tools were restored to their initially clean Git state.

## Runnable system

All eight Compose services were `running (healthy)`: PostgreSQL, Redis, MinIO, API, worker, PDF, Admin, and Operator. `/api/health/deep` returned `200` with DB, Redis, worker, PDF, storage, and queue all `ok`. The public site and `/api/health` were reachable; Caddy currently routes `/api/*`, `/pdf/*`, `/admin*`, MinIO document paths, and the Operator catch-all correctly.

The runtime is not a production configuration: API and worker use `NODE_ENV=development`; Compose embeds Postgres/MinIO/storage credentials and provides a fallback JWT secret; MinIO uses `latest`; Swagger is publicly reachable; and repository-known demo/super-admin credentials authenticate against the public API. Only one tenant (`system`) exists, so true two-tenant runtime isolation was not available.

## Quality-gate results

| Gate | Result |
|---|---|
| SDK freshness | PASS |
| Workspace lint | PASS with numerous React hook dependency warnings |
| Workspace typecheck | PASS, 6 tasks |
| Production build | PASS, 5 tasks; Next generated 45 Admin and 24 Operator static pages, plus dynamic routes |
| API unit tests | PASS, 33 suites / 257 tests |
| SDK tests | PASS, 2 suites / 5 tests |
| Full Playwright | PASS with qualifications: 120 passed, 3 skipped, 0 failed |
| Dependency audit | FAIL: 127 vulnerabilities — 2 critical, 75 high, 45 moderate, 5 low |

The skipped Playwright tests are both render-failure/retry cases and tenant creation. The passing multi-test LIMS test encodes clinically incorrect aggregate behavior and must not be treated as release evidence.

## Deployment and CI baseline

- Push/PR CI runs SDK freshness, lint, color lint, Admin/OpenAPI parity, typecheck, build, API tests, and SDK tests.
- Real-stack E2E is manual only. It contains inconsistent health URLs/ports relative to current Compose and excludes mobile.
- CI has no dependency-vulnerability gate and no release-critical skip gate.
- Persistent PostgreSQL and MinIO volumes exist; backup/restore code and historical evidence exist, but this audit did not perform a destructive restore apply.
- `apps/mobile` is a mock-driven scaffold, excluded from root build/lint/typecheck and from deployment.

## Evidence and reproducibility

Principal commands included `git status/log/branch`, `docker compose ps`, public/local `curl` health probes, migration queries, `pnpm check:sdk-freshness`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, API/SDK Jest, full Playwright, runtime Swagger/OpenAPI route comparison, Prisma/schema searches, and `pnpm audit --prod --audit-level high`.

Detailed lane work products are preserved in [`_work/LIMS_AGENT_FINDINGS.md`](_work/LIMS_AGENT_FINDINGS.md), [`_work/OPD_AGENT_FINDINGS.md`](_work/OPD_AGENT_FINDINGS.md), and [`_work/ORPHAN_AGENT_FINDINGS.md`](_work/ORPHAN_AGENT_FINDINGS.md).
