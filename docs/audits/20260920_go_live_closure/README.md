# Go-live closure evidence — 2026-09-20

## Scope and decision

This closure sprint completed the technical release-proof work requested for the
LIMS pilot. Catalogue closure is intentionally **BLOCKED pending clinical and
business sign-off**. The 329-test workbook must not be imported until the
owner confirms the approved names, units, reference ranges, result formats,
and print behavior.

## Evidence

- Restore package used: `runtime/backups/full/vexel-full-20260920_011824.tar.gz`.
- The restore was protected by a pre-snapshot and reached `Restore COMPLETE` in
  `runtime/data/logs/restore_full_20260920_014231.log`.
- PostgreSQL and MinIO were restored; post-restore counts were tenants=2,
  patients=156, encounters=146, documents=192.
- Public API health returned HTTP 200; public operator routing returned HTTP
  307; MinIO health returned HTTP 200.
- Credential rotation was reapplied after restore. The new admin secret
  authenticated with HTTP 200, the former documented password returned HTTP
  401, and all refresh tokens were revoked during rotation.
- PDF failure/retry proof: injected PDF failure produced document
  `658678a8-c5f8-4e8d-98c8-5980065a8fdd` in `FAILED` with the expected 503;
  `POST /documents/{id}:retry` then reached `RENDERED` with a storage key and
  PDF hash after the PDF service was restored.
- Live result-entry/UI proof: 5/5 Playwright tests passed against the public
  deployment (`lims/01`, `lims/02`, `lims/04`).
- Tenant isolation proof: 7/7 Playwright tests passed against the public
  deployment (`tenancy/01`, `07-tenant-isolation`).
- Refresh-token lookup proof: login and refresh returned HTTP 200 after the
  indexed `tokenLookupHash` migration was applied.

## Operational fixes included

- Document creation and retry now expose `QUEUED` before rendering.
- Restore stops MinIO before replacing its volume and restarts it safely.
- Restore tolerates an unavailable host Caddy override directory and records
  destructive-restore outcomes in the durable per-run log when the source run
  row is replaced by the restored database.
- The worker uses a long BullMQ lock duration for blocking backup/restore shell
  operations.
- Demo passwords are supplied by environment variables; seed output no longer
  prints passwords.

## Remaining owner-controlled gates

1. Clinical/business sign-off for the 329-test catalogue and its import.
2. Owner/demo-user UAT using the rotated secrets through the approved secret
   sharing channel.
3. External GitHub Actions confirmation after the final commit is pushed.

