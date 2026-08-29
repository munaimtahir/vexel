# OPD Test Evidence

**Release decision:** `NOT READY`
**Execution date:** 2026-08-28 UTC

## Fresh results

| Command/check | Result |
|---|---|
| `DATABASE_URL=... pnpm --filter @vexel/api exec prisma validate` | PASS |
| `pnpm --filter @vexel/api typecheck` | PASS |
| `pnpm --filter @vexel/api test -- --runInBand` | PASS after billing consolidation; 33 suites / 250 tests |
| `pnpm --filter @vexel/api build` | PASS |
| `pnpm --filter @vexel/api lint` | PASS |
| `pnpm check:sdk-freshness` | PASS after final edits |
| Operator and Admin `next build` | PASS with pre-existing hook warnings |
| frontend raw `fetch`/Axios/Prisma scan | PASS |
| rebuilt API canonical registration and billing smoke | PASS |
| targeted OPD Playwright | PASS, 2/2 after correcting API Host-based tenant resolution; tests use super-admin and cover only basic pages |
| full non-nightly Playwright regression | PASS, 120 passed / 3 skipped in 3.1 minutes; only 2 tests are OPD-specific |
| `docker compose config --quiet` and container migration status | PASS; 31 migrations found, database schema up to date |

## Mandatory gates still missing

- transaction rollback and real database concurrency tests for registration, appointment booking, and payments;
- complete tenant A/B, RBAC, stale-JWT, inactive-user and clinician-ownership matrices;
- immutable note/prescription amendment tests;
- refund/payment-void/correction tests;
- OPD worker/PDF failure injection and recovery tests;
- least-privilege Operator and Admin browser journeys (current OPD Playwright defaults to `admin@vexel.system`);
- clean migration/deployment, rollback, proxy/TLS and full end-to-end workflow evidence.

Static compilation and unit tests do not satisfy these gates.
