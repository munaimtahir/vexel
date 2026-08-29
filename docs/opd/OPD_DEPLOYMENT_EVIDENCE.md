# OPD Deployment Evidence

**Release decision:** `NOT READY`
**Execution date:** 2026-08-28 UTC

## Verified in the existing local environment

- `docker compose build api && docker compose up -d api` completed.
- Rebuilt API health returned `200`.
- Tenant-authoritative feature enablement returned `200` with correlation ID.
- Canonical doctor and patient creation succeeded.
- Idempotent registration created an `OpdEncounter` and canonical encounter-linked invoice.
- `/api/opd/billing/invoices` and invoice retrieval returned `200` through the consolidated canonical service.
- The E2E helper now defaults local API calls to `admin.localhost`, exercising Host-based tenant resolution instead of relying on an IP literal or production-disabled tenant override.
- Targeted OPD Playwright completed 2/2 basic checks after that correction.
- Full non-nightly browser regression completed with 120 passed and 3 skipped; this remains mostly platform/LIMS evidence, not complete OPD scope proof.
- Compose configuration validated and the rebuilt API reported all 31 checked-in migrations applied.
- All currently running Compose services reported healthy before rebuild.

The smoke created readiness-only doctor/patient/encounter/invoice records in the local `system` tenant and enabled the OPD flags needed for the test.

## Release blockers

- This was an existing-volume deployment, not an empty-database bootstrap.
- The destructive legacy retirement migration has no data reconciliation/export or rollback proof.
- Worker/PDF prescription and receipt failure/retry behavior was not exercised in this run.
- A full least-privilege clinical/billing browser journey was not executed.
- Caddy/public TLS/Host routing was not verified.
- Backup/restore and restart/recovery were not rehearsed.
- The API image install reported 32 advisories: 3 low, 15 moderate, 13 high, 1 critical.

No production deployment is authorized by this evidence.
