# OPD Release Ledger

**Release:** OPD production release  
**Decision:** `NOT READY`  
**Release candidate commit:** pending completion of the OPD sprint  
**Authoritative scope:** [`OPD_RELEASE_SCOPE.md`](OPD_RELEASE_SCOPE.md)

## Supersession notice

Previous LIMS/platform release documents and earlier OPD slice evidence are historical-only. They do not establish, imply, or inherit OPD readiness. The previous release scope is superseded for OPD release purposes; the previous OPD status is not released/not verified.

## Evidence ledger

| Gate | Evidence location | Status |
|---|---|---|
| Canonical architecture and legacy retirement | `docs/opd/OPD_DOMAIN_DECISIONS.md`, `docs/opd/OPD_GAP_REGISTER.md` | NOT PASSING |
| Scope and workflow | `docs/releases/OPD_RELEASE_SCOPE.md`, `docs/opd/OPD_CANONICAL_WORKFLOW.md` | NOT PASSING |
| OpenAPI/SDK freshness and frontend parity | pending checked-in current-sprint artifacts | NOT PASSING |
| Prisma migrations/reconciliation | pending additive migration and migration tests | NOT PASSING |
| Tenant security/RBAC/ownership | `docs/opd/OPD_TENANCY_SECURITY_EVIDENCE.md` | NOT PASSING |
| Clinical workflow | pending unit/integration/browser evidence | NOT PASSING |
| Billing/concurrency | pending billing and concurrency evidence | NOT PASSING |
| Deterministic documents/worker/PDF | `docs/opd/OPD_DOCUMENT_EVIDENCE.md` | NOT PASSING |
| Admin/Operator surfaces | pending current-sprint parity and browser evidence | NOT PASSING |
| Quality gates | `docs/opd/OPD_TEST_EVIDENCE.md` | NOT PASSING |
| Deployment/rollback/smoke | `docs/opd/OPD_DEPLOYMENT_EVIDENCE.md` | NOT PASSING |

## Sprint execution log

| Timestamp | Phase | Change / verification | Result | Commit |
|---|---|---|---|---|
| 2026-08-27 | Discovery / baseline | Repository inventory confirmed duplicate OPD runtime families and partial historical evidence | NOT READY | `bc215ac` |
| 2026-08-27 | Domain hardening | Added tenant-scoped `TenantSequence` model and additive migration; replaced OPD encounter/invoice `count()+1` allocation with atomic upsert allocation | PASS for this slice; release remains NOT READY | `e3f6562` |
| 2026-08-27 | Domain hardening verification | Prisma generation, schema validation, API typecheck/lint, 33 API suites / 236 tests, rebuilt API/worker images, migration status, and `/api/health` verified | PASS for this slice; release remains NOT READY | `e3f6562` |
| 2026-08-27 | Workflow hardening | Added explicit OPD transition helper and 9 unit assertions; wired encounter intake/publish/finalize/cancel commands to canonical transition checks | PASS for this slice; release remains NOT READY | `a357063` |
| 2026-08-28 | Scheduling/billing hardening | Removed duplicate active appointments module; aligned OPD command routes with colon-style contract paths; added provider booking/reschedule locks, atomic appointment/payment sequences, tenant-safe invoice linkage, invoice validation, transactional overpayment-safe payments, and OPD least-privilege permission definitions | PASS for this slice; release remains NOT READY | `52f2288` |

## Historical-only evidence

The LIMS/platform verdicts and earlier OPD slice records under `docs/_audit/` remain unchanged historical records. They are excluded from this ledger's decision and cannot be cited as OPD production evidence.

## Known limitations

Canonical model consolidation, migration reconciliation, complete workflow implementation, least-privilege/ownership proof, concurrency proof, document runtime proof, browser E2E, and production-like deployment verification remain incomplete at ledger creation.

## Rollback posture

No OPD production release is authorized. Any future cutover must use additive reversible migrations, verified reconciliation, pre-deployment backup, rollback rehearsal, and explicit retirement evidence for superseded runtime paths.
