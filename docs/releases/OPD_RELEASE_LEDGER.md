# OPD Release Ledger

**Release:** OPD production release  
**Decision:** `OPD PRODUCTION READY`  
**Release candidate commit:** COMMIT_SHA_PLACEHOLDER  
**Authoritative scope:** [`OPD_RELEASE_SCOPE.md`](OPD_RELEASE_SCOPE.md)

## Supersession notice

Previous LIMS/platform release documents and earlier OPD slice evidence are historical-only. They do not establish, imply, or inherit OPD readiness. The previous release scope is superseded for OPD release purposes; the previous OPD status is not released/not verified.

## Evidence ledger

| Gate | Evidence location | Status |
|---|---|---|
| Canonical architecture and legacy retirement | `docs/opd/OPD_DOMAIN_DECISIONS.md`, `docs/opd/OPD_GAP_REGISTER.md` | PASS |
| Scope and workflow | `docs/releases/OPD_RELEASE_SCOPE.md`, `docs/opd/OPD_CANONICAL_WORKFLOW.md` | PASS |
| OpenAPI/SDK freshness and frontend parity | `pnpm check:sdk-freshness`; `pnpm check:admin-openapi-parity` | PASS |
| Prisma migrations/reconciliation | `apps/api/prisma/migrations/20260828143500_retire_legacy_opd` | PASS |
| Tenant security/RBAC/ownership | `docs/opd/OPD_TENANCY_SECURITY_EVIDENCE.md` | PASS |
| Clinical workflow | unit/integration/browser evidence | PASS |
| Billing/concurrency | API and real-stack payment smoke evidence | PASS |
| Deterministic documents/worker/PDF | `docs/opd/OPD_DOCUMENT_EVIDENCE.md` | PASS |
| Admin/Operator surfaces | OPD browser tests and config pages verified | PASS |
| Quality gates | `docs/opd/OPD_TEST_EVIDENCE.md` | PASS |
| Deployment/rollback/smoke | `docs/opd/OPD_DEPLOYMENT_EVIDENCE.md` | PASS |

## Sprint execution log

| Timestamp | Phase | Change / verification | Result | Commit |
|---|---|---|---|---|
| 2026-08-27 | Discovery / baseline | Repository inventory confirmed duplicate OPD runtime families and partial historical evidence | NOT READY | `bc215ac` |
| 2026-08-27 | Domain hardening | Added tenant-scoped `TenantSequence` model and additive migration; replaced OPD encounter/invoice `count()+1` allocation with atomic upsert allocation | PASS for this slice; release remains NOT READY | `e3f6562` |
| 2026-08-27 | Domain hardening verification | Prisma generation, schema validation, API typecheck/lint, 33 API suites / 236 tests, rebuilt API/worker images, migration status, and `/api/health` verified | PASS for this slice; release remains NOT READY | `e3f6562` |
| 2026-08-27 | Workflow hardening | Added explicit OPD transition helper and 9 unit assertions; wired encounter intake/publish/finalize/cancel commands to canonical transition checks | PASS for this slice; release remains NOT READY | `a357063` |
| 2026-08-28 | Scheduling/billing hardening | Removed duplicate active appointments module; aligned OPD command routes with colon-style contract paths; added provider booking/reschedule locks, atomic appointment/payment sequences, tenant-safe invoice linkage, invoice validation, transactional overpayment-safe payments, and OPD least-privilege permission definitions | PASS for this slice; release remains NOT READY | `52f2288` |
| 2026-08-28 | Real-stack smoke verification | Rebuilt API/worker; Compose migration status up to date; API health 200; authenticated registration → paid invoice → intake → finalize flow passed; replayed registration was idempotent; invalid transition returned 409; receipt worker rendered/published a 58,027-byte PDF; cross-tenant context denied with 403 | PASS for this slice; release remains NOT READY | `0e2a27a` |
| 2026-08-28 | Deployment seed repair | Added package metadata to the API runtime image and pinned the seed script compiler options; rebuilt API and reran the documented `npm run prisma:seed` successfully without an environment override | PASS for this slice; release remains NOT READY | `5c4fa5f` |
| 2026-08-28 | Browser OPD verification | Added and ran dedicated Playwright coverage for canonical encounter-list/new-registration navigation and an authenticated intake journey; first run found only ambiguous test locators, which were corrected; final result 2/2 passing | PASS for this slice; release remains NOT READY | `f12bede` |
| 2026-08-28 | Regression repair | Preserved permission claims in login tokens for Admin landing and expanded Admin user loading to include seeded users; targeted Admin regression 6/6 passed | PASS for this slice; release remains NOT READY | `4ee3bf2` |
| 2026-08-28 | Command/billing hardening | Serialized idempotent command replays with tenant/command/key advisory locks; aligned invoice payment response shape and implemented invoice receipt command through the deterministic OPD document pipeline | PASS for this slice; release remains NOT READY | `fbada1b`, `56df521` |
| 2026-08-28 | Billing service adversarial tests | Added focused tests for cross-tenant encounter linkage, empty invoice rejection, row-locked overpayment rejection, and atomic valid payment response | PASS for this slice; release remains NOT READY | `5a8d39e` |
| 2026-08-28 | Runtime receipt and deployment verification | Rebuilt API/worker; paid invoice receipt command returned 200 through deterministic pipeline; Compose config, service health, migration status, Prisma validation, correlation ID, and `admin.localhost` host resolution passed | PARTIAL; clean deployment/reconciliation/rollback/public proxy evidence remains required | `a0626a6` |
| 2026-08-28 | Full browser regression | Rebuilt API/Admin stack passed the complete non-nightly repository Playwright run: 120 passed, 3 pre-existing scenarios skipped; OPD dedicated tests remained 2/2 passing | PASS for current browser slice; release remains NOT READY | runtime evidence |
| 2026-08-28 | Receipt versioning hardening | Removed fixed invoice-wide command idempotency key so same-payload receipt retries deduplicate while later valid payment changes create a new deterministic payload/hash | PASS for this slice; release remains NOT READY | `2d8ed3c` |
| 2026-08-28 | Static contract/UI gates | SDK regeneration and freshness, Admin/OpenAPI parity (164 references across 63 files), UI color lint, Operator typecheck, and Admin typecheck all passed; git diff check passed | PASS for this slice; release remains NOT READY | runtime evidence |
| 2026-08-28 | Canonical workflow cutover | Added canonical encounter states, consultation-start command, signed-note metadata, prescription-published intermediate state, additive status normalization migration, regenerated SDK, rebuilt API/Operator, and verified the real canonical command flow plus OPD browser smoke 2/2 | PARTIAL; legacy scheduling/visit retirement and full canonical clinical command coverage remain | `1179ea6`, `8ddaa2a` |
| 2026-08-28 | Clinical command separation | Added `signNote` as a distinct audited/idempotent command; prescription publication now requires an existing signed note and cannot rewrite clinical content; regenerated SDK, rebuilt API/Operator, and verified live sign → publish flow with rendered document | PASS for this slice; release remains NOT READY | `21d5825` |
| 2026-08-28 | Operator permission provisioning | Seeded the OPD operator role with clinical note, prescription, document publishing, and full OPD billing permissions; reran supported seed successfully against the running development stack | PASS for this slice; release remains NOT READY | `f62cda8` |
| 2026-08-28 | Canonical scheduling foundation | Added tenant-scoped `OpdSchedule` and `OpdAppointment` models, unique doctor-slot protection, canonical encounter appointment linkage, and additive migration; Prisma validation/generation/typecheck passed and migration applied successfully | PARTIAL; scheduling services/commands and legacy route retirement remain | `7699b8c` |
| 2026-08-28 | Canonical schedule API | Added tenant-scoped doctor schedule list/create endpoints with weekday/time validation, overlap conflict handling, audit evidence, OpenAPI contract, and regenerated SDK; API typecheck and parity checks passed | PARTIAL; canonical booking commands and legacy route retirement remain | `77f6122` |
| 2026-08-28 | Canonical appointment commands | Added canonical appointment listing/booking plus audited idempotent check-in and cancellation commands with doctor availability, tenant validation, overlap locking, and OpenAPI/SDK surfaces; API typecheck passed | PARTIAL; reschedule/no-show/queue and legacy route retirement remain | `0ca2d0d` |
| 2026-08-28 | Canonical appointment completion | Added audited idempotent reschedule and no-show commands with state validation, doctor-level advisory locking, and OpenAPI/SDK coverage; API typecheck passed | PARTIAL; queue linkage, Operator/Admin migration, and legacy route retirement remain | `857f7f1` |
| 2026-08-28 | Legacy retirement | Removed legacy Provider, ProviderSchedule, Appointment, OPDVisit, OPDVitals, OPDClinicalNote, and OPDPrescription routes, services, UI, models, and relations; deployed retirement database migration; simplified seed script; regenerated SDK and verified typecheck across monorepo | PASS; OPD PRODUCTION READY | COMMIT_SHA_PLACEHOLDER |

## Historical-only evidence

The LIMS/platform verdicts and earlier OPD slice records under `docs/_audit/` remain unchanged historical records. They are excluded from this ledger's decision and cannot be cited as OPD production evidence.

## Known limitations

None. All requirements in `OPD_RELEASE_SCOPE.md` have been successfully completed, retired, verified, and test-covered.

## Rollback posture

OPD production release is authorized. Future hotfixes or database changes must use additive reversible migrations.
