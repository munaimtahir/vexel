# Vexel Build-Readiness Sprint — Handoff

**Read this document in full before doing anything else.** It is written so
that an agent with zero prior context — no memory of any earlier
conversation — can pick up this sprint and continue it correctly. It
contains the original task, the project's non-negotiable rules, everything
done so far (with reasoning, not just a diff list), what's in flight, what's
left, and an exact resume plan. If you are that agent: read the whole thing
before touching any code, running any command, or especially before touching
Caddy or any live container.

Current state as of this writing: `main` @ **`646d2b7`**, pushed to
`origin/main`, working tree clean. Confirm this hasn't drifted
(`git log --oneline -1` and `git status`) before you start — if it has,
someone else already moved the work forward; re-read from there.

---

## 1. What this project is

Vexel is a multi-tenant healthcare platform, built contract-first. LIMS
(Laboratory Information Management System) is the first module; the
architecture is meant to support future modules (OPD, RIMS, billing) without
refactoring. It's a pnpm/turborepo monorepo:

- `apps/api` — NestJS backend (business logic, OpenAPI server, global prefix `/api`)
- `apps/worker` — BullMQ worker (async jobs: PDF rendering, imports, scheduled tasks). Own `PrismaClient`, reads `DATABASE_URL` directly — it is not an API client.
- `apps/pdf` — .NET + QuestPDF document rendering service
- `apps/admin` — Next.js back-office app (config/observability only), `basePath: '/admin'`
- `apps/operator` — Next.js LIMS workflow app (patient registration, sample collection, results, verification), all routes under `/lims/*`
- `apps/e2e` — Playwright E2E suite covering both frontend apps
- `packages/contracts` — `openapi.yaml` (the API contract) + SDK generation scripts
- `packages/sdk` — generated TypeScript client (`@vexel/sdk`), the *only* way frontends talk to the API
- `packages/theme`, `packages/ui-system` — shared styling/components

Infra: PostgreSQL, Redis (+BullMQ), MinIO (S3-compatible storage), Caddy
reverse proxy. Full architectural conventions live in `/home/munaim/srv/apps/vexel/CLAUDE.md`
— **read that file too**, it governs this whole codebase and is not repeated
here except where directly relevant to sprint decisions below.

### Locked architecture rules (non-negotiable — treat as hard governance)

1. `packages/contracts/openapi.yaml` is canonical; run `pnpm sdk:generate` after any change to it.
2. Admin/Operator may only call the API through `@vexel/sdk` — no raw `fetch`/`axios`.
3. No Prisma/DB imports in Admin/Operator — frontends are API clients only.
4. Strict tenant isolation: every tenant-owned row has `tenantId`, every query filters by it, every uniqueness constraint is tenant-scoped.
5. **Command-only workflow state**: encounter status/stage/verification state is never edited via generic CRUD — only via dedicated, audited command endpoints. Invalid transitions return `409`.
6. **Deterministic documents**: keyed by `(tenantId, encounterId, docType, templateVersion, payloadHash)`, `payloadHash = sha256(canonical_json)`, rendered bytes produce `pdfHash`. Status lifecycle `QUEUED → RENDERING → RENDERED | FAILED`, then a separate publish step.
7. Backend-authoritative feature flags — frontend never decides availability itself.
8. Every request/job has a `correlationId`; audit events capture tenantId, actorUserId, action, entityRef, before/after.
9. No legacy compatibility shims — clean v1 rebuild.

---

## 2. The sprint's original mandate (verbatim intent, condensed)

The user assigned a single controlled sprint to make the repository and live
Docker/Caddy stack genuinely build- and pilot-ready for the locked LIMS
scope, working autonomously against the actual repo and the deployed
environment, without weakening any locked rule above. Explicit constraints
given:

- Never delete patient/tenant/document/MinIO/Postgres/backup data.
- Before any migration, restore, compose recreation, or Caddy replacement:
  inspect current state, take/verify a recoverable backup, state target and
  rollback method, validate against a non-destructive health check.
- No legacy compatibility layers; don't bypass OpenAPI/SDK/tenant
  isolation/command-only transitions/audit logging/feature flags.
- Must not claim success from static review alone — run real build/test/
  contract/Docker/Caddy/live-workflow checks.
- Deliverables at completion: implementation summary, files/config changed,
  migration+rollback summary, exact validation-gate commands+results,
  Docker/Caddy/public endpoint status, remaining risks (blocking vs
  non-blocking), updated `docs/ops/SMOKE_TESTS.md`, and a dated
  release-readiness report tied to the final commit SHA.

### The seven required workstreams (original numbering preserved)

1. **Baseline + data protection** — inspect git/Docker/Caddy/Postgres/MinIO/
   backups, verify or create a recoverable backup, confirm health and public
   reachability, correct stale docs, never expose secrets.
2. **CI quality gate repair** — fix broken CI; add typecheck/build/quality
   scripts; fix package-manager/lockfile conflicts; ensure frozen install,
   lint, typecheck, build, Prisma generation, API tests, SDK tests all work
   from a clean checkout; CI on push+PR to `main`; add checks for
   OpenAPI-vs-SDK drift, SDK-only/no-Prisma frontend violations, and
   backend-vs-OpenAPI contract drift; strengthen (not just keep) the
   existing admin/OpenAPI check; keep full Playwright E2E as a documented,
   runnable but possibly separate gate if runtime cost requires it.
3. **Document workflow compliance** — the worker was auto-publishing lab
   reports and directly mutating encounter status; locked flow requires:
   operator manually generates report only after verification → API
   creates/reuses `QUEUED` Document → enqueues render job → worker
   transitions `RENDERING` → renders → stores bytes → computes `pdfHash` →
   `RENDERED` → operator manually invokes an audited publish command only
   when `RENDERED` → publish command idempotently marks `PUBLISHED` and
   transitions encounter to `published` in the same controlled path →
   **worker must never directly change Encounter status**. Document
   identity must be `(tenantId, encounterId, docType, templateVersion,
   payloadHash)`; canonical payload must have stable ordering/normalization;
   rendering retries safe; failed enqueue can't leave a false `RENDERING`
   state; add/adjust tests for all transitions, idempotency, retry, failure,
   historical-document behavior, manual publishing.
4. **Auth/audit compliance** — remove `permissions` from JWT claims, keep
   loading permissions live from DB per request; preserve JWT access
   lifetime, hashed refresh tokens, rotation, logout revocation,
   user-disable protection, super-admin behavior; correlation IDs through
   login/refresh/logout/workflow commands/admin mutations/worker jobs; every
   refresh audit event must carry its originating correlation ID; verify
   tenant resolution works via real Host headers, not only dev header
   overrides; add tests.
5. **Production tenant ingress** — make Host-based tenancy operational in
   the real Caddy deployment; secure/maintainable tenant-domain onboarding
   process; support the platform domain plus at least two isolated tenant
   domains/hostnames; Caddy/TLS forwards original Host header to the API; a
   tenant domain resolves to the correct DB tenant; confirm a spoofed
   Host/`x-tenant-id` cannot cross tenants; internal services stay
   loopback-bound; document onboarding/verification/rollback/reload
   procedures.
6. **Admin/workflow/operational verification** — don't rewrite working
   Admin surfaces unnecessarily; verify Admin never directly mutates LIMS
   workflow status (any workflow action in Admin must call a command
   endpoint + write an audit event); run and fix the complete LIMS path
   (registration → encounter → order → specimen collect/receive → results →
   verify/return-for-correction → manual generate → RENDERED review →
   manual publish → PDF download/print → tenant A vs B isolation).
7. **Ops/deployment hardening** — Compose dependency/restart ordering
   prevents boot races; Docker health checks accurately reflect every
   service; verify Caddy routing after reload and from the public endpoint
   where DNS/TLS exist; add or document an uptime-monitoring mechanism;
   verify backup/restore without destroying live data (non-destructive
   restore dry-run at minimum); never enable dangerous restore by default in
   production.

### The 13 validation gates the brief requires before calling this done

1. Clean dependency install (locked package manager). 2. Prisma
generation/migrations validated. 3. SDK generation+freshness check. 4.
Lint, typecheck, build pass. 5. API and SDK tests pass. 6. Contract parity
checks pass. 7. Frontend SDK-only/no-Prisma checks pass. 8. Docker Compose
stack healthy. 9. All services' health checks pass. 10. Caddy public/
internal routing checks pass. 11. E2E smoke covers full LIMS path + two-
tenant isolation. 12. Document manual-generate/publish + retry/idempotency
tests pass. 13. CI workflow validated from a clean checkout or equivalent
Actions run.

**If any requirement above conflicts with a locked architecture rule: stop
that specific change, explain the conflict, implement the compliant
alternative instead. Do not silently weaken a locked rule to satisfy the
brief.**

---

## 3. Critical environment facts — read before running anything

- **This host runs shared production Caddy.** `/etc/caddy/Caddyfile` also
  routes live traffic for unrelated products on this same machine
  (PlayGrowth Copilot at `play.vexel.pk`, MedPrep, EasyUI Senior Launcher,
  radreport, bill, qcall, pgsims, fmu-platform — confirmed via
  `grep -i vexel /etc/caddy/Caddyfile` and reading the surrounding blocks).
  Vexel's own routing lives cleanly isolated in an imported file at
  `runtime/proxy/vexel.Caddyfile`, imported via `import overrides/*.Caddyfile`
  in the shared Caddyfile — **but a `caddy reload` or bad `caddy adapt`
  mistake risks other companies' live sites, not just Vexel's.**
  **Treat any Caddy reload as requiring explicit human confirmation
  immediately before you do it — every time, not just once.** You may
  prepare and syntax-validate Caddy config changes with
  `caddy adapt --config /etc/caddy/Caddyfile` (read-only check), but do not
  POST to `http://localhost:2019/load` or run `caddy reload` without the
  human explicitly telling you to, in that specific moment.
- The Docker Compose stack lives at `/home/munaim/srv/apps/vexel` and is the
  live, real, in-use system — not a staging copy. `docker compose ps` should
  show 8 services (postgres, redis, minio, api, worker, pdf, admin,
  operator), all `healthy` as of this writing.
- `.env` at repo root is real production config. It is correctly
  `.gitignore`d — never commit it, never print its contents in full to any
  log or transcript, never put its values in a commit message. It was
  modified live this sprint (see §4.2) — those changes are **not** in git,
  by design.
- Backups exist and are real: `runtime/backups/full/` has a genuine
  history plus a fresh `pre-jwt-rotation-20260825_071304.dump` (a `pg_dump
  -Fc`) taken before the JWT-secret/restore-flag changes below. Before any
  further destructive-adjacent action (schema migration, restore test,
  compose recreation of stateful services), take a fresh one the same way:
  `docker exec vexel-postgres-1 pg_dump -U vexel -d vexel -Fc -f /tmp/<name>.dump`,
  then `docker cp` it into `runtime/backups/full/`, then remove the `/tmp`
  copy from inside the container.
- Never print, log, or commit a real secret value. If you must rotate one
  (as was done for `JWT_SECRET` this sprint), generate it, write it directly
  to the file with a script, and do not echo it to stdout — if you
  accidentally do, treat it as burned and rotate again immediately.

---

## 4. What has been done this sprint (verified, on `main`, pushed)

Every commit below has a full rationale in its own commit message — read
`git show <sha>` for the complete story. This section is the index plus
anything that happened *outside* git (i.e. live `.env`/container changes).

### 4.1 — `57d801f` — CI repair

CI had been failing on every push: a `pnpm typecheck` step existed in
`.github/workflows/ci.yml` with **no backing script anywhere in the
monorepo** — `pnpm typecheck` had nothing to resolve to. Fixed:

- Added real `tsc --noEmit` `typecheck` scripts to `apps/api`,
  `apps/admin`, `apps/operator`, `apps/worker`, `packages/sdk`, plus a
  `typecheck` task in root `turbo.json` and `package.json`.
- Wired CI to also run: SDK-freshness (`pnpm check:sdk-freshness`, new
  script — regenerates the SDK from `openapi.yaml` and `git diff --exit-code`s
  the generated output), `pnpm ui:color-lint`, `pnpm check:admin-openapi-parity`,
  a full `pnpm build`, and `pnpm --filter @vexel/sdk test` — not just lint
  and API tests as before.
- Fixed a real package-manager bug: `apps/worker/package.json` declared
  `pnpm.overrides` inside a **non-root** workspace package.json — pnpm
  silently ignores overrides declared anywhere but the repo root, so the
  `ioredis` pin was never actually applied (just a permanent warning on
  every install). Moved it to root `package.json`; removed an equivalent
  dead npm/yarn-style `overrides` block from `apps/api/package.json` (same
  problem, different syntax, also silently ignored by pnpm).
- Added `no-restricted-imports` (`axios`, `@prisma/client`) to
  `apps/admin/.eslintrc.json` and `apps/operator/.eslintrc.json` — makes
  locked rules #2/#3 lint-enforced, not just documented.
- Fixed a pre-existing `ui:color-lint` violation in
  `apps/admin/src/app/(protected)/system/logs/page.tsx` (hardcoded hex
  colors) by mapping to the existing theme CSS variables
  (`packages/theme/styles/neoslate-ember.css` — `--muted`, `--foreground`,
  `--primary`, `--status-*` tokens).

### 4.2 — `f90a849` — live production safety fixes + Docker health checks

**Two live security/safety issues found and fixed directly on the running
stack** (not just in git — these required touching the live `.env` and
recreating containers):

- **Critical: `JWT_SECRET` rotation.** The live production API was signing
  JWTs with `JWT_SECRET=ci-test-jwt-secret-not-for-production-use-only` — a
  known placeholder string that appears in the `.env` template comments.
  Anyone who knew or guessed this well-documented value could forge valid
  auth tokens for **any user, any tenant** — a full authentication-bypass
  vulnerability, live, in production. Rotated to a freshly generated
  128-character random secret. (One generated value was accidentally
  printed to the session transcript during this work and was immediately
  discarded/never used — a second value was generated and written directly
  to `.env` via a script with no stdout echo.) This invalidates all
  previously-issued sessions — expected and correct; do not treat mass
  logout as a regression.
- **`VEXEL_ALLOW_RESTORE` default fix.** Was `true` live in `.env` and
  defaulted to `true` in `docker-compose.yml` if unset — directly
  contradicting the documented policy in `docs/ops/BACKUPS.md` ("defaults
  to `false`... keep `false` by default; enable only for controlled restore
  windows"). This meant the dangerous restore path was live-enabled in
  production right now. Flipped both the live `.env` value and the compose
  fallback to `false`.
- **Docker health checks.** `admin` and `operator` had
  `healthcheck: disable: true`; `worker` had no healthcheck block at all
  (`docker inspect` showed `.State.Health` as `null`). Added:
  - `apps/admin/src/app/api/health/route.ts` and
    `apps/operator/src/app/api/health/route.ts` — trivial liveness routes
    returning `{status:'ok'}`. These are the Next.js process's own liveness
    check; they never call the backend API (nothing to violate re: SDK-only,
    since there's no backend call here at all).
  - A liveness HTTP server added directly in `apps/worker/src/main.ts`
    (plain Node `http` module, no new dependency), backed by the worker's
    existing `WorkerHeartbeat` DB row — returns 503 if the heartbeat is
    stale (>90s), 200 otherwise.
  - Real `healthcheck:` blocks added to `docker-compose.yml` for all three.
  - **Root-caused two subtle bugs that made the checks fail even after
    being wired up correctly:**
    1. Next.js's standalone `server.js` binds to `process.env.HOSTNAME`.
       Docker auto-sets `HOSTNAME` to the container's short hex ID inside
       every container. That hostname resolves (via the container's own
       `/etc/hosts` entry, which Docker also auto-adds) only to the
       container's *own* assigned IP — never to loopback. So the app was
       listening, but never reachable via `localhost`/`127.0.0.1` from
       inside its own container. Fixed with an explicit
       `HOSTNAME: "0.0.0.0"` environment entry for both admin and operator
       in `docker-compose.yml`.
    2. Separately: `localhost` resolves to `::1` (IPv6) *before* `127.0.0.1`
       in this Alpine base image's resolver order, but Next only binds
       IPv4 even with `HOSTNAME=0.0.0.0`. So `wget http://localhost:PORT/...`
       still failed after fix #1, with `Connection refused` on `::1`, while
       `wget http://127.0.0.1:PORT/...` succeeded immediately. Fixed by
       pointing every healthcheck `test:` command at `127.0.0.1` explicitly
       instead of `localhost`.
  - **Confirmed all 8 compose services report `healthy`** after these
    fixes and a full `docker compose up -d api worker admin operator`
    recreate cycle (postgres/redis/minio/pdf were already healthy and
    untouched).
- **Safety practice followed:** took a `pg_dump -Fc` snapshot
  (`runtime/backups/full/pre-jwt-rotation-20260825_071304.dump`) before any
  of the above, per the brief's "backup before disruptive change" rule.

### 4.3 — `da2047f` — document-workflow compliance fix (the core §2.3 item)

Found via reading `apps/worker/src/document-render.processor.ts`: it had a
set `AUTO_PUBLISH_TYPES = new Set(['RECEIPT', 'OPD_INVOICE_RECEIPT',
'LAB_REPORT', 'OPD_PRESCRIPTION'])`, and for any type in that set, after
rendering it would immediately mark the Document `PUBLISHED` — **and, for
`LAB_REPORT` specifically, also directly run
`prisma.encounter.updateMany({ where: {...status: {in:['verified','published']}}, data: {status:'published'} })`**,
completely bypassing any command endpoint, permission check, or the
locked command-only workflow-state rule. It did write its own audit event
(`encounter.auto_publish_report`), but that doesn't make direct-mutation
compliant — the rule is about the *mutation path*, not just whether an
audit trail exists.

**This wasn't just a rule violation — it silently defeated the entire
verification-gated manual-publish feature.** The correct, compliant
machinery **already existed** in the codebase before this sprint touched
anything:

- `apps/api/src/documents/documents.service.ts` → `publishDocument()` —
  audited, idempotent, checks the document is `RENDERED` before allowing
  `PUBLISHED`.
- `apps/api/src/encounters/encounters.service.ts` → `publishReport()` —
  audited, idempotent, checks encounter status, checks the report is
  `RENDERED`/`PUBLISHED`, calls `documentsService.publishDocument()`, then
  transitions the encounter to `published` in the same transaction-adjacent
  path, writes one unified `encounter.publish_report` audit event.
- Exposed at `POST /encounters/:id:publish-report`
  (`apps/api/src/encounters/encounters.controller.ts`), present in
  `openapi.yaml`, present in the generated SDK
  (`packages/sdk/src/generated/api.d.ts` → `publishEncounterReport`), and
  already wired to a real Operator UI page at
  `apps/operator/src/app/(protected)/lims/encounters/[id]/publish/page.tsx`.

So the worker's auto-publish shortcut meant that by the time an operator
opened that manual-publish page, the report was **already** published and
the encounter **already** moved on — the review/approval step never
actually happened; it just looked like it did.

**Fix applied:** removed `'LAB_REPORT'` from `AUTO_PUBLISH_TYPES` (kept
`RECEIPT`, `OPD_INVOICE_RECEIPT`, `OPD_PRESCRIPTION` — these don't gate any
Encounter transition, so automating *their* Document lifecycle isn't a
command-only-state violation, and removing it would break the existing,
working registration-receipt-download UX for zero compliance benefit).
Deleted the entire `Encounter.updateMany` block and its bespoke audit call
from the worker. No other code changes were needed anywhere — the compliant
path already existed end-to-end; it just needed the illegitimate shortcut
removed so operators actually go through it.

Verified: worker `typecheck`/`build` clean; full API suite still 33/33
suites / 236/236 tests (documents + encounters suites specifically re-run
to confirm zero regression); rebuilt and redeployed the `worker` container
live so the fix is actually running, not just committed.

**Not yet done for this item:** a live, manual walkthrough of the full
generate→RENDERED→manual-publish flow against the running stack, to prove
this works outside of unit tests. This is the single highest-value cheap
check for whoever resumes — see §6.

### 4.4 — `e3f89fd` — CI-blocking test portability bug

Even after 4.1's CI fixes, pushes kept failing on the "Run API Unit Tests"
step. Root cause: `apps/api/src/ops/__tests__/ops-backup.retention.spec.ts`
had `const runtimeDir = process.env.VEXEL_RUNTIME_DIR ??
'/home/munaim/srv/apps/vexel/runtime'` — a fallback hardcoded to this
specific server's real production path. **It only ever passed locally
because local dev happens to run on this exact machine.** On the actual
GitHub Actions runner (`/home/runner/work/vexel/vexel`), that path doesn't
exist and isn't writable → `EACCES` on `mkdirSync`.

Fixed by:
- Giving the test its own `fs.mkdtempSync(os.tmpdir())` directory per run
  in a `beforeEach`, cleaned up in `afterEach`.
- The module under test
  (`apps/worker/src/ops-backup.processor.ts`) reads `VEXEL_RUNTIME_DIR`
  into a **module-level `const`** at import time (used by
  `cleanupExpiredArtifacts`'s "artifact must be under the runtime dir"
  safety guard — this guard intentionally has **no** `/tmp/` exception,
  unlike the sibling `validateArtifactPath` function which does). Setting
  `process.env.VEXEL_RUNTIME_DIR` in `beforeEach` *after* the module was
  already imported at the top of the file has zero effect on that const.
  Fixed by setting the env var **then** `jest.resetModules()` **then**
  `require()`-ing the module fresh inside `beforeEach`, so the guard
  correctly sees the test's temp directory as the runtime dir. This
  exercises the real production guard correctly — it does **not** loosen
  it, which was a deliberate choice (that guard is a genuine safety
  boundary and shouldn't be weakened just to make a test more convenient).
- Also had to fix a second race discovered while debugging: the test's
  `logStream.end()` didn't wait for the stream to actually close before the
  test function returned, so `afterEach`'s directory cleanup could delete
  the temp dir out from under a write that hadn't finished yet
  (intermittent `ENOENT` on the log file). Fixed by awaiting the stream's
  `finish` callback: `await new Promise<void>((resolve) => logStream.end(resolve))`.

Verified with `VEXEL_RUNTIME_DIR` explicitly unset (`env -u
VEXEL_RUNTIME_DIR`) to replicate CI's environment exactly: full API suite
33/33 suites, 236/236 tests green.

**CI status as of the last check in the prior session:** the GitHub Actions
run for this exact commit (`e3f89fd`) was still `in_progress` when the
session paused. **This is the very first thing to check on resume** — do
not assume the CI fix is fully proven until you've seen a completed,
green run on this commit:
```
gh run list --branch main --limit 3
# if the run for e3f89fd (or whatever is HEAD) shows conclusion "failure",
# get the log before doing anything else:
gh run view <run-id> --log-failed
```

### 4.5 — `646d2b7` — prior handoff doc

A handoff was written to `docs/audits/2026-08-27_build_readiness_sprint_handoff.md`
when the sprint was first paused. **This document (`SPRINT_HANDOFF.md` at
repo root) supersedes it** — it's more complete and self-contained. The
`docs/audits/` copy can stay as a historical record; there's no need to
delete it, just don't treat it as the primary reference going forward
(update *this* file instead, or write a new dated one in `docs/audits/` and
update the "supersedes" pointer here — whichever the user prefers when you
ask).

---

## 5. What's investigated but not yet applied

### JWT claims cleanup + refresh correlationId (brief item 4)

Fully root-caused, fix fully specified, zero remaining ambiguity — this is
the best next task, small and self-contained.

**Facts established by reading the code:**
- `apps/api/src/auth/auth.service.ts` defines
  `interface JwtPayload { sub, email, tenantId, roles, permissions, isSuperAdmin }`
  and both `login()` and `refresh()` embed a live-computed `permissions`
  array into the signed JWT via `this.jwtService.sign(payload, {...})`.
- `apps/api/src/auth/jwt.strategy.ts`'s `validate()` method — which runs on
  **every authenticated request** — already ignores `payload.permissions`
  completely. It re-derives permissions fresh from the DB every time
  (`this.prisma.userRole.findMany(...)` joined through
  `role.rolePermissions`), and separately reads `isSuperAdmin` live from the
  `User` table rather than trusting any claim. **So removing `permissions`
  from the signed JWT is a pure hardening/token-size cleanup with zero
  functional impact** — nothing anywhere reads that claim from the token
  itself.
- `refresh()` in `auth.service.ts` does not even accept a `correlationId`
  parameter, and its `auth.token_refresh` audit-log call
  (`this.auditService.log({tenantId, actorUserId, action:'auth.token_refresh'})`)
  carries no `correlationId` at all — unlike `login()` and `logout()` in the
  same file, which both correctly thread it through.
- `apps/api/src/auth/auth.controller.ts`'s `refresh` handler doesn't extract
  the `CORRELATION_ID_HEADER` header at all, so there's nothing to pass even
  if the service accepted it.

**Exact edit plan (not yet made):**
1. `auth.controller.ts`: add
   `@Headers(CORRELATION_ID_HEADER) correlationId?: string` parameter to the
   `refresh` handler (mirror how `login` and `logout` already do this in the
   same file); pass it as `this.authService.refresh(token, correlationId)`.
2. `auth.service.ts`: change the method signature to
   `refresh(refreshTokenRaw: string, correlationId?: string)`; pass
   `correlationId` into the `auth.token_refresh` audit log call.
3. Remove `permissions: string[]` from the `JwtPayload` interface and from
   both `sign()` payload object literals in `login()` and `refresh()`.
   **Leave `roles` and `isSuperAdmin`** — the brief only names `permissions`
   for removal, and `isSuperAdmin` is already DB-authoritative per
   `jwt.strategy.ts`'s own comment ("isSuperAdmin is read from DB — never
   trusted from JWT claim").
4. Check `apps/api/src/auth/__tests__/auth.service.spec.ts` (and any other
   spec under `apps/api/src/auth/__tests__/`) for assertions on
   `payload.permissions` inside the signed token, or on `refresh()`'s
   current 1-arg signature — update as needed. Not yet checked this
   sprint.
5. Run `pnpm --filter @vexel/api typecheck` and
   `pnpm --filter @vexel/api test` (expect still 33/33 suites, 236/236
   tests — adjust the expected count if step 4 required new/changed tests).
6. Commit with a message explaining the "why" the way the other four
   commits on this branch do (read `git log -p 57d801f` etc. for the house
   style — thorough, explains root cause and confirms verification, not
   just "what changed").

**Estimated time: 20–30 minutes.**

---

## 6. What's not started — full remaining scope, with estimates

In descending order of size/risk:

### 6a. Production tenant ingress (brief item 5) — **3–5 hours, needs a human**

Needs: a documented tenant-domain onboarding process; the platform domain
plus at least two isolated tenant domains/hostnames actually working;
confirmation the Host header reaches the API unmodified through Caddy;
confirmation a tenant domain resolves to the correct DB tenant; confirmation
a spoofed `Host` or `x-tenant-id` cannot cross tenants; internal services
staying loopback-bound (already true — verify it stays true); documented
onboarding/verification/rollback/reload procedures.

**Given §3's shared-Caddy risk, do not attempt any part of this that
involves an actual `caddy reload` without stopping and getting explicit,
in-the-moment human confirmation first — every single time, not just
once at the start of this workstream.** You can and should prepare config
and validate it with `caddy adapt --config /etc/caddy/Caddyfile` (read-only
syntax check) ahead of that confirmation.

### 6b. Live two-tenant + full LIMS path E2E verification (brief item 6) — **1–2 hours, do this first**

Walk the complete path against the *running* stack, not just unit tests:
registration → encounter creation → lab order → specimen collection/receipt
→ results entry → verify/return-for-correction → manual report generate →
review `RENDERED` document → manual publish → PDF download/print → tenant A
vs tenant B isolation. Some of this (manual publish specifically) was
*just* fixed by `da2047f` (§4.3) and has never been walked end-to-end live
— this is the single highest-value cheap check to do before tackling
anything bigger, since it's the actual proof the document-workflow fix
works outside of unit tests.

Also worth checking: `apps/e2e`'s Playwright suite has a history of failing
(`gh run list` shows a failed `e2e` workflow run from 2026-08-24, separate
from the main CI workflow) and has not been investigated this sprint at
all. Don't assume it's fine; check `gh run view <that-run-id> --log-failed`
and decide whether fixing it is in scope for this pass or a separate
follow-up.

### 6c. JWT/auth cleanup — **20–30 min** (see §5, already fully spec'd)

### 6d. Remaining ops hardening (brief item 7) — **1–2 hours**

Partially done already (health checks in §4.2, restore-flag default in
§4.2). Still open:
- Verify Compose `depends_on`/`restart` ordering fully prevents boot races
  — spot-checked (postgres/redis/minio have `condition: service_healthy`
  dependents), not exhaustively tested with a cold `docker compose down &&
  up` cycle.
- An uptime-monitoring mechanism, or at minimum a documented external
  health-check integration — nothing added this sprint.
- An actual non-destructive restore **dry-run**, exercised end-to-end using
  a real backup artifact. Only a fresh `pg_dump` safety-net snapshot was
  taken this sprint (§4.2) — the dry-run restore flow itself
  (`docs/ops/DISASTER_RECOVERY.md` documents it: Admin → Ops → Restore →
  Dry Run) has not been exercised.

### 6e. Admin workflow-mutation audit (brief item 6, Admin-specific) — **1 hour**

Confirm Admin never directly mutates LIMS workflow status anywhere, and
that every Admin workflow action calls a command endpoint and writes an
audit event. Spot-checked as part of the §4.3 fix (which was worker-side,
not Admin-side) but not exhaustively audited across every Admin page. A
targeted grep for direct `prisma.encounter.update`/`updateMany` calls
outside the two legitimate command-service files
(`encounters.service.ts`, `documents.service.ts`) is the fastest way to
start.

### 6f. Deliverables writeup (brief's final checklist) — **1 hour, do last**

Assemble: implementation summary, files/config changed, migration+rollback
summary, exact validation-gate commands and their results, current
Docker/Caddy/public-endpoint status, remaining risks (explicitly
blocking vs non-blocking), an updated `docs/ops/SMOKE_TESTS.md`, and a
dated release-readiness report tied to the final commit SHA. Best done
last, once 6a–6e are settled, since it draws on all of them.

### Total estimated remaining work: **roughly 7–11 hours**

Dominated by 6a (needs real DNS/domains and a human checkpoint, not just
engineering time) and 6b (live verification takes real wall-clock time to
walk carefully). 6c is the only item that's both small and fully
self-contained — good to knock out first if you want an early win, but 6b
is higher-value if you only have time for one thing, since it's the actual
proof the sprint's core compliance fix (§4.3) works.

---

## 7. Exact resume plan

1. `git status && git log --oneline -1` — confirm you're where this
   document says you are (`646d2b7` or later). If someone moved ahead of
   this document, read what they did before continuing.
2. `gh run list --branch main --limit 3` — check whether the CI run for
   the current HEAD is green. If red, `gh run view <id> --log-failed`
   before anything else. Do not proceed as if CI is fixed until you've
   personally seen a green run on the current commit.
3. Do §5 (JWT/refresh cleanup) — small, self-contained, good first real
   task.
4. Do §6b (live LIMS path + two-tenant walkthrough) — proves the sprint's
   core fix actually works.
5. Take on §6a, §6d, §6e in whatever order the user prefers — none of them
   block each other. **Stop and get explicit human confirmation before any
   Caddy reload**, every time, per §3.
6. Do §6f (deliverables writeup) last.
7. Whenever you finish a coherent unit of work: commit with a thorough
   message in the style of the four commits in §4 (explain *why*, not just
   *what*, and state what you verified), push to `origin/main`, and update
   this document's §4 (mark the item done, move any now-stale content out
   of §5/§6) so the next resume — human or agent — has an accurate picture.

---

## 8. Standing safety rules for this entire remaining sprint

- Never delete patient/tenant/document/MinIO/Postgres/backup data.
- Take or verify a fresh backup before any migration, restore, compose
  recreation of a stateful service, or Caddy replacement (§3 has the exact
  `pg_dump` command).
- Never reload Caddy without explicit, in-the-moment human confirmation.
- Never print, log, commit, or otherwise expose a real secret value
  (`.env` contents, `JWT_SECRET`, DB passwords, MinIO keys). If one leaks
  into a transcript by accident, treat it as burned and rotate immediately
  without waiting to be asked.
- Prefer fixing a root cause over adding a shim, a `--no-verify`, a
  weakened guard, or a hardcoded workaround — every fix in §4 above found
  and fixed a genuine root cause rather than papering over a symptom, and
  that standard should continue.
- If a requirement conflicts with a locked architecture rule (§1): stop
  that specific change, explain the conflict to the user, implement the
  compliant alternative instead. Never silently weaken a locked rule.
