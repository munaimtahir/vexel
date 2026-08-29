# OPD Test Evidence

**Release decision:** `NOT READY`
**Execution date:** 2026-08-29 UTC

## Fresh results

| Command/check | Result |
|---|---|
| `DATABASE_URL=... pnpm --filter @vexel/api exec prisma validate` | PASS |
| `pnpm --filter @vexel/api typecheck` | PASS |
| `pnpm --filter @vexel/api test -- --runInBand` | PASS; 33 suites / 257 tests |
| `pnpm --filter @vexel/api build` | PASS |
| `pnpm --filter @vexel/api lint` | PASS |
| `pnpm check:sdk-freshness` | PASS after final edits |
| Operator and Admin `next build` | PASS with pre-existing hook warnings |
| frontend raw `fetch`/Axios/Prisma scan | PASS |
| rebuilt API canonical registration and billing smoke | PASS |
| targeted OPD Playwright | PASS, 2/2 with seeded clinician and tenant-aware API helper |
| full non-nightly Playwright regression | 119 passed / 1 failed / 3 skipped; LIMS verify-page timeout remains |
| `docker compose config --quiet` and container migration status | PASS; 31 migrations found, database schema up to date |

## Mandatory gates still missing

- transaction rollback and real database concurrency tests for registration, appointment booking, and payments;
- complete tenant A/B, RBAC, stale-JWT, inactive-user and clinician-ownership matrices;
- immutable prescription amendment/document-version tests (note unit coverage exists);
- refund/payment-void/correction tests;
- OPD worker/PDF failure injection and recovery tests;
- least-privilege Operator and Admin browser journeys (current OPD Playwright defaults to `admin@vexel.system`);
- clean migration/deployment, rollback, proxy/TLS and full end-to-end workflow evidence.

Static compilation and unit tests do not satisfy these gates.
