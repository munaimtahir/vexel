# Vexel Health authoritative discovery verdict

Evidence date: 2026-09-01 UTC. Repository/runtime evidence supersedes historical COMPLETE/PASS statements.

## 1. Repository baseline

- Branch/commit: `main` at `1ffda42e90a77ed86d87486ad0ac7a12dc35e477`, equal to `origin/main` at capture.
- Cleanliness: initially clean. Final intended changes are documentation under `docs/discovery/` only.
- Runtime: all eight Compose services healthy; public Caddy route and API health reachable; deep health passed. Runtime is development-style and unsafe for production because known credentials/default secrets are active.
- Gates: SDK freshness, lint, typecheck, build, 257 API tests, 5 SDK tests and 120 Playwright tests passed. Three Playwright tests were skipped. Dependency audit failed with 127 findings.
- Audit mutation disclosure: tests created ordinary live `system` tenant data. The OPD route audit issued invoice `4eba4c9b-c203-4043-a64e-76ea54678eff` and generated PUBLISHED receipt document `3abc09b0-06b7-487b-883c-fd104a81e4a8`; no destructive rollback was attempted.

## 2. LIMS verdict

```text
NOT READY
```

Reason: the public deployment has known credentials/secrets; an incomplete multi-test encounter can be verified and reported; audit reads can cross tenants; clinical mutations can commit without their mandatory audit event; and the production dependency audit fails.

## 3. LIMS production gap

```text
P0: 5
P1: 5
P2: 3
P3: 0
```

P0: public deployment credential/secret exposure; clinically incorrect multi-test verification/report; cross-tenant audit explorer; non-atomic command/audit persistence; failing critical/high dependency security gate.

P1: document failure/retry closure; real tenant-safe jobs visibility; collision-safe canonical JSON; truthful manual-publish UX; complete backend `module.lims` enforcement.

## 4. OPD current state

```text
FUNCTIONALLY IMPLEMENTED BUT NOT RELEASE READY
```

## 5. OPD reality summary

The 29-row capability matrix supports these secondary approximations:

```text
Backend capability:       23/29 (79%) has some implementation
Frontend capability:      12/29 (41%) has a page/action
End-to-end wiring:         8/29 (28%) plausibly wired without a known hard break
Runtime-usable workflow:   6/29 (21%) prerequisite/action capabilities
Automated verification:   8/29 (28%) has any direct attention; full production E2E 0/29
```

OPD walk-in registration and intake foundations are real. Prescription publish crashes on a retired Prisma key; billing UI/backend/OpenAPI are incompatible; appointment commands are malformed; role seed backfill destroys least privilege; and major existing backend capabilities are unreachable from UI.

## 6. OPD release path

1. **Phase A — P0 reconciliation:** lock canonical workflow/finance DTOs; repair prescription versions, billing and appointment routes; regenerate SDK; remove `as any`; correct RBAC seed.
2. **Phase B — clinical integrity:** atomic registration/invoice/appointment linkage; same-tenant clinician ownership; immutable signed note/prescription amendments; repeat vitals and lifecycle reconciliation.
3. **Phase C — backend authority:** canonical feature keys, central backend enforcement, transactional command idempotency, scheduling/concurrency closure.
4. **Phase D — real-mode UI:** appointment/availability/check-in/queue, finalize/cancel, draft/amend, refund/settings, document failure/retry.
5. **Phase E — release proof:** two-tenant non-super-admin RBAC/ownership, walk-in and appointment browser flows through published documents, retry/idempotency/PDF/hash and deployment acceptance.

## 7. Orphan code summary

```text
ACTIVE:                 3
DORMANT-BUT-VALID:      3
REUSABLE:               2
REUSABLE-WITH-REFACTOR: 1
DUPLICATE:              5
SUPERSEDED:             3
INCOMPATIBLE-LEGACY:    4
DEAD:                   4
UNCERTAIN:              1
```

## 8. Reuse opportunities

- Repair the canonical current OPD implementation; do not rebuild or resurrect retired OPD tables.
- Integrate `PublicShell` into Operator login.
- Evaluate Admin `PermissionGuard` for consistent presentation-level gating.
- Consolidate status rendering on UI-system after mapping parity.
- Reuse Mobile visuals/navigation only after SDK/auth/tenancy/flag/CI integration.

## 9. Removal candidates

High-confidence eventual candidates only: unused old Operator sidebar; broken Admin OPD nav entries; unused theme TS badge export; stale screenshot script; unused Admin utils; tracked live tsbuildinfo/Playwright outputs. No removal occurred. Deprecated commands/routes/flags require migration/access-log evidence first; historical migrations/evidence and the uncertain transfer script are not safe to delete.

## 10. Active architecture violations

1. Public known credentials, fixed/fallback secrets and development mode.
2. Cross-tenant audit query and non-atomic mandatory audit writes.
3. Contract/runtime drift: six canonical normalized routes absent and 46 runtime-only identities.
4. SDK type safety bypassed with OPD `as any` calls.
5. Phantom jobs queue and unmatched storage-test job contract.
6. Partial LIMS/OPD backend feature-flag enforcement and stale aliases.
7. Active legacy catalog/result fields and duplicated Admin access policy.
8. Deprecated workflow commands still consumed by production pages.
9. Collision-prone document canonicalization.
10. OPD least-privilege/clinician-ownership violations.
11. UI shell and route governance violations.

## 11. Unified recommended build order

1. **Emergency release containment:** rotate/revoke public accounts/secrets/tokens; production-mode fail-closed deployment; dependency triage; incident/access-log review.
2. **Shared platform safety:** tenant-scope audit, transactional audit/outbox, two-tenant fixtures, real queue registry/retry, producer-consumer job contracts.
3. **LIMS clinical closure:** per-order aggregate state, canonical receive/verify commands, block incomplete reports, collision-safe versioned document hashing, truthful publish flow.
4. **LIMS acceptance/release:** backend flag matrix, failure/retry and immutable document tests, production bootstrap/backup/restore, operator/verifier UAT. Release LIMS only after all P0/P1 gates pass.
5. **OPD P0 reconciliation in parallel only where isolated:** contract/SDK DTO repair, prescription key/version fix, appointment route fix, RBAC seed correction—without expanding product scope.
6. **OPD clinical/backend closure:** atomic linkage, clinician ownership, immutable amendments, flags, scheduling and command idempotency.
7. **OPD UI closure:** expose already-built APIs through generated SDK and remove dead navigation/stale calls.
8. **OPD acceptance/release:** two-tenant least-privilege browser journeys, deterministic documents/retry, migration/deployment/backup acceptance.
9. **Controlled cleanup:** only after access logs/data profiling/import graphs and full regression gates; preserve uncertain and historical evidence.

## 12. Final platform verdict

```text
VEXEL HEALTH CURRENT STATE

LIMS:
NOT READY

OPD:
FUNCTIONALLY IMPLEMENTED BUT NOT RELEASE READY

PLATFORM ARCHITECTURE:
PARTIALLY COMPLIANT

ORPHAN CODE:
26 material groups: 3 active, 6 reusable/dormant, 5 duplicate, 3 superseded, 4 incompatible-legacy, 4 dead, 1 uncertain; no deletion performed

LIMS NEXT RELEASE ACTION:
Immediately rotate/revoke public known credentials and all fallback infrastructure/JWT secrets, invalidate sessions, and redeploy fail-closed in production mode

OPD NEXT RELEASE ACTION:
Lock and implement the canonical OPD contract slice that repairs prescription version publishing and billing/appointment command paths without `as any`

SAFE TO BEGIN IMPLEMENTATION SPRINT:
YES WITH CONDITIONS
```

Conditions: contain the public security exposure first; treat LIMS P0/P1 closure as release priority; allow OPD work only on the isolated reconciliation slice above; make no destructive orphan cleanup until prerequisite evidence exists.
