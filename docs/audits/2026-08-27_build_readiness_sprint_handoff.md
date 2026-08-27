# Build-Readiness Remediation Sprint — Handoff (2026-08-27)

Paused mid-sprint at explicit user request, to allow a restart or a different
agent to pick up cleanly. This document is the source of truth for what's
done, what's in flight, and what's left, as of commit **`e3f89fd`** on `main`
(pushed to `origin/main`).

## Original scope

A 7-workstream build/pilot-readiness remediation covering: baseline+backup,
CI repair, document-workflow compliance, auth/audit gaps, production tenant
ingress (Caddy), Admin/workflow verification, and ops hardening. Full
requirements are in the user's original sprint brief (not duplicated here —
see the conversation that started this work, or ask the user to re-paste it).

## Environment facts worth knowing before continuing

- **This host runs shared production Caddy.** `/etc/caddy/Caddyfile` also
  routes live traffic for unrelated products (PlayGrowth, MedPrep, EasyUI,
  radreport, bill, qcall, pgsims, fmu-platform). Vexel's block lives in an
  imported `runtime/proxy/vexel.Caddyfile`, but **any `caddy reload` or
  `caddy adapt` mistake risks other companies' live sites**, not just Vexel.
  Treat every Caddy change as requiring an explicit human confirmation before
  reload — prepare and `caddy adapt`-validate (syntax-check only) but do not
  reload without sign-off.
- Docker Compose stack is live at `/home/munaim/srv/apps/vexel`, all 8
  services (postgres, redis, minio, api, worker, pdf, admin, operator)
  currently report `healthy`.
- `.env` at repo root is real production config (gitignored, correctly never
  committed). It was modified live this sprint — see below.
- Backups: `runtime/backups/full/` has a real history plus a fresh
  `pre-jwt-rotation-20260825_071304.dump` (pg_dump) taken before the JWT/
  restore-flag changes below.

## Done and verified this sprint

All committed to `main` and pushed. Each commit message has full rationale;
this is just the index.

1. **`57d801f` — CI repair.** CI had been failing on every push: a
   `pnpm typecheck` step was added to `.github/workflows/ci.yml` with no
   backing script anywhere in the repo. Added real `tsc --noEmit` scripts to
   api/admin/operator/worker/sdk + a turbo task; wired CI to also run
   SDK-freshness, `ui:color-lint`, admin/OpenAPI parity, a full build, and
   SDK tests. Also fixed a real `pnpm.overrides` bug (declared in a non-root
   workspace package.json — silently ignored by pnpm), added
   `no-restricted-imports` (axios, `@prisma/client`) to admin/operator
   eslint configs, and fixed a pre-existing `ui:color-lint` violation.

2. **`f90a849` — live production safety fixes + health checks.**
   - **Critical, already applied live (not a commit — `.env` is
     gitignored):** rotated `JWT_SECRET` off a known placeholder value
     (`ci-test-jwt-secret-not-for-production-use-only`) that was live in
     production — this was a full auth-bypass vulnerability (anyone who
     knew that well-documented string could forge tokens for any
     tenant/user). New value is a freshly generated 128-char random secret,
     never displayed after an accidental first print (which was caught and
     discarded — a second value was generated and written directly to
     `.env` without printing).
   - `VEXEL_ALLOW_RESTORE` was `true` live in `.env` and defaulted to `true`
     in `docker-compose.yml`, contradicting documented policy
     (`docs/ops/BACKUPS.md`: default `false`). Both flipped to `false`.
   - Admin/operator had `healthcheck: disable: true`; worker had none. Added
     `/api/health` routes to admin/operator and a heartbeat-backed liveness
     endpoint to worker. Root-caused two subtle Docker networking issues:
     Next's standalone server binds to `process.env.HOSTNAME`, which Docker
     auto-sets to the container's short ID (resolves only to the
     container's own IP, not loopback) — fixed with explicit
     `HOSTNAME=0.0.0.0`; and `localhost` resolves to `::1` first in this
     Alpine image while Next only binds IPv4 — fixed by pointing
     healthchecks at `127.0.0.1` explicitly.
   - All 8 compose services confirmed `healthy` live on the stack.

3. **`da2047f` — document-workflow compliance fix.** The worker's
   `document-render.processor.ts` was auto-publishing `LAB_REPORT` documents
   immediately after rendering **and directly flipping `Encounter.status` to
   `'published'`** via a raw `updateMany` — bypassing the audited,
   permission-gated `POST /encounters/:id:publish-report` command
   (`EncountersService.publishReport`) entirely, and violating the
   command-only workflow state rule. This wasn't just a rule violation: it
   silently defeated the manual verification-gated publish step, since by
   the time an operator opened the existing Operator UI publish page
   (`/lims/encounters/[id]/publish`), the report was already published.
   Fixed by removing `LAB_REPORT` from the worker's `AUTO_PUBLISH_TYPES` and
   deleting the `Encounter.updateMany` block entirely — the compliant path
   (`DocumentsService.publishDocument` + `EncountersService.publishReport` +
   its controller route + SDK method + Operator publish page) **already
   existed** and is now the only way a lab report gets published.
   `RECEIPT`/`OPD_INVOICE_RECEIPT`/`OPD_PRESCRIPTION` keep auto-publishing —
   they don't gate any Encounter transition, so this isn't a compliance
   issue, and changing it would break the live registration-receipt UX.

4. **`e3f89fd` — CI-blocking test portability bug.** Even after the CI gate
   itself was fixed, pushes kept failing on `Run API Unit Tests`.
   Root cause: `ops-backup.retention.spec.ts` had a hardcoded fallback path
   (`/home/munaim/srv/apps/vexel/runtime`) — it only ever passed locally
   because dev happened to run on this exact machine; on the GitHub Actions
   runner that path doesn't exist → `EACCES`. Fixed by giving the test its
   own `os.tmpdir()` directory and a fresh `require()` after setting
   `VEXEL_RUNTIME_DIR` (the module reads it into a const at import time, so
   mutating `process.env` after import has no effect). The production
   safety guard itself (artifact must be under the real runtime dir, no
   `/tmp/` exception) was deliberately left untouched — the fix exercises it
   correctly instead of loosening it.

All 4 commits individually verified: `pnpm install --frozen-lockfile` →
prisma generate → sdk-freshness → lint → color-lint → admin/openapi parity →
typecheck → build → API tests (33/33 suites, 236/236 tests) → SDK tests
(2/2 suites, 5/5 tests), all green locally, with `VEXEL_RUNTIME_DIR`
explicitly unset to replicate CI's environment.

**Live CI status as of pause:** the run for `e3f89fd` was still
`in_progress` on GitHub Actions when the session was paused
(`gh run list --branch main` to check; run started
2026-08-27T20:33:46Z). **First thing on resume: check whether that run
went green.** If it didn't, the failure log (`gh run view <id>
--log-failed`) is the next debugging entry point — do not assume the CI
fix is fully proven until a run on this exact commit completes
successfully.

## In progress, not yet applied (identified, root-caused, fix known)

**JWT claims / refresh audit correlationId (brief item 4).** Investigated but
no code changed yet:

- `apps/api/src/auth/auth.service.ts`: `JwtPayload` interface includes
  `permissions: string[]`, and both `login()` and `refresh()` embed the live
  permissions array into the signed JWT. This should be removed —
  `apps/api/src/auth/jwt.strategy.ts`'s `validate()` **already** re-derives
  permissions fresh from the DB on every request and never reads
  `payload.permissions`, so removing the claim is a pure hardening/size
  cleanup with **zero functional impact** (confirmed by reading
  `jwt.strategy.ts` in full — it ignores that field already).
- `refresh()` in the same file does not even accept a `correlationId`
  parameter, and its `auth.token_refresh` audit event is written with no
  `correlationId` at all — unlike `login()` and `logout()`, which both
  thread it through correctly. The controller
  (`apps/api/src/auth/auth.controller.ts`) doesn't extract the
  `CORRELATION_ID_HEADER` in its `refresh` handler either.

**Exact remaining edit** (not yet made):
1. `auth.controller.ts`: add `@Headers(CORRELATION_ID_HEADER) correlationId?: string`
   to the `refresh` handler, pass it to `this.authService.refresh(token, correlationId)`.
2. `auth.service.ts`: change `refresh(refreshTokenRaw: string)` to
   `refresh(refreshTokenRaw: string, correlationId?: string)`, pass it into
   the `auth.token_refresh` audit log call.
3. Remove `permissions` from `JwtPayload` and both `sign()` payload objects
   in `login()`/`refresh()`. Leave `roles` and `isSuperAdmin` — the brief
   only calls out `permissions`, and `jwt.strategy.ts` already treats
   `isSuperAdmin` as DB-authoritative regardless of the claim.
4. Check `apps/api/src/auth/__tests__/auth.service.spec.ts` for any
   assertion on `payload.permissions` in the signed token and update if
   present (not yet checked).
5. Re-run `pnpm --filter @vexel/api test` (expect 33/33, 236/236 still) and
   typecheck before committing.

Estimated: **20–30 minutes** of focused work — this is a small, well-scoped,
low-risk change with the investigation already done.

## Not started (full remaining scope from the original brief)

Roughly in descending order of remaining risk/size:

1. **Production tenant ingress (Caddy)** — brief item 5. Needs: a
   tenant-domain onboarding process, at least two isolated tenant
   domains/hostnames working end-to-end, confirmation that Host header
   reaches the API unmodified, confirmation a spoofed Host/`x-tenant-id`
   cannot cross tenants, and documented onboarding/rollback. **Given the
   shared-Caddy risk noted above, this needs a live human checkpoint before
   any reload** — likely the single highest-risk remaining item.
   Estimated: **3–5 hours**, mostly because it requires real domains/DNS to
   test against and a human in the loop for each reload.

2. **Live two-tenant Caddy + LIMS path E2E verification** — brief items 5/6.
   Running the complete LIMS path (registration → order → specimen →
   results → verify → generate → RENDERED review → manual publish → PDF
   download → tenant A/B isolation) against the live stack, not just unit
   tests. Some of this (manual publish specifically) is newly-fixed by
   `da2047f` and hasn't been walked end-to-end live yet — recommend doing
   this before anything else, since it's the actual proof the document-
   workflow fix works outside of unit tests.
   Estimated: **1–2 hours** for a careful manual walkthrough, or more if
   Playwright E2E (`@lims`, `@tenancy`, `@security` grep tags) needs
   fixing to actually pass — current `e2e` CI run history shows it's been
   failing (`gh run list` shows a failed `e2e` workflow run from
   2026-08-24) and hasn't been investigated this sprint.

3. **JWT/auth item above** — 20–30 min (see previous section).

4. **Ops hardening remainder** — brief item 7. Partially done (health
   checks, restore-flag default). Still open: verify Compose
   depends_on/restart ordering fully prevents boot races (spot-checked, not
   exhaustively tested), an uptime-monitoring mechanism or documented
   external health-check integration (nothing added this sprint), and an
   actual non-destructive restore dry-run exercised end-to-end (backups
   exist and are real, but a dry-run restore hasn't been executed this
   sprint — only a fresh pg_dump snapshot was taken as a safety net).
   Estimated: **1–2 hours**.

5. **Admin verification (brief item 6)** — confirming Admin never mutates
   LIMS workflow status directly (spot-checked via the compliance fix above,
   not exhaustively audited across every Admin page) and that every Admin
   workflow action calls a command endpoint + writes an audit event.
   Estimated: **1 hour** for a targeted grep-and-read audit; longer if
   violations are found.

6. **Deliverables** — the brief's final "Deliverables" checklist (migration/
   rollback summary, exact validation-gate commands+results, updated
   `docs/ops/SMOKE_TESTS.md`, a dated release-readiness report tied to the
   final commit SHA) — not assembled yet. This is mostly writing, drawing on
   everything above.
   Estimated: **1 hour**, best done last once the above is settled.

## Total estimated remaining work

**Roughly 7–11 hours** of focused engineering time to complete the full
original scope, dominated by the Caddy/tenant-ingress item (which needs real
DNS/domains and a human checkpoint, not just engineering time) and live E2E
verification. The JWT/auth cleanup is the only remaining item that's both
small and fully self-contained — good candidate for whoever resumes this to
knock out first.

## How to resume

1. Check CI status for `e3f89fd` first (`gh run list --branch main --limit 1`).
   If red, read the failure log before doing anything else — don't assume
   the CI-fix commits are fully proven.
2. Do the JWT/refresh-correlationId fix (self-contained, spec'd above).
3. Walk the live LIMS path manually against the running stack to confirm
   the document-workflow fix (`da2047f`) actually works end-to-end, not just
   in unit tests — this is the highest-value cheap check before tackling
   anything bigger.
4. Then take on Caddy/tenant-ingress, ops hardening, and Admin audit in
   whatever order the user prefers — none of them block each other.
5. Assemble the deliverables doc last.

Do not reload Caddy or touch `/etc/caddy/Caddyfile` /
`/home/munaim/srv/proxy/caddy/*` without explicit human confirmation
immediately before doing so — this host serves other live products through
the same Caddy instance.
