# Pending Tasks Reconciliation

> Note: No single authoritative `TASKS.md` matching prompt expectation was found. Reconciliation is based on specs, structure lock docs, implemented code, and executed checks.

## Done
- Contract + SDK pipeline established and enforced.
- Core LIMS API surfaces implemented.
- Admin/Operator core route groups and shells implemented.
- CI governance checks wired.
- Deterministic document schema fields and worker pipeline implemented.

## Partial
- End-to-end runtime validation in current local environment.
- Document engine strict deterministic behavior under all fallbacks/failures.
- OPD maturity (present but still in progressive rollout state).
- Frontend warning debt cleanup.

## Not started / weakly started
- Mobile app production-ready integration (currently mock/TODO heavy).
- Unified, evidence-linked task tracker as authoritative source of completion truth.

## Drifted / unclear
- Documentation narrative of readiness versus local reproducible runtime truth in this pass.
- Deterministic PDF claim versus fallback behavior semantics.

## Blocked
- Full runtime verification blocked by inactive local stack during this discovery run.

## Phase OPD — KMVP

- [x] OPD contract added
- [x] OPD doctor master added
- [x] Prisma schema + migration for OPD added
- [x] OPD feature flags added
- [x] Create registration command
- [x] Record intake command
- [x] Publish prescription command
- [x] OPD registration UI
- [x] OPD intake UI
- [x] OPD doctor notes + prescription UI
- [x] Immediate print-after-publish flow
- [x] OPD prescription document template + payload builder
- [ ] OPD integration tests
- [ ] OPD E2E happy path passes
