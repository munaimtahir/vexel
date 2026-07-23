# Ops Backup — Remove List

**Assessment date:** 2026-03-06

**Conclusion: NO code should be deleted.**

All files in the ops subsystem are either functional, structurally correct, or recoverable with bounded fixes. There is no dead code, no duplicate code, no legacy compatibility shim, and no architectural violation that warrants deletion.

The issues found are:
- Missing Docker wiring (add to docker-compose.yml and Dockerfile — not a deletion)
- A pre-snapshot bug (fix one line — not a deletion)
- Missing cron executor (implement or document — not a deletion)
- Hardcoded paths (parameterize — not a deletion)
- Missing permission grants in seed (add — not a deletion)

---

## Items to DISABLE until fixed

The following should be disabled or clearly labeled in the UI until the corresponding fix is complete:

| Item | Action | Reason |
|------|--------|--------|
| Admin `/ops/restore` page | Add disabled state / prominent warning banner | Restore runs against live production DB. Should not be accessible until FIX-01 + FIX-02 + FIX-06 are complete and a restore drill has been performed. |
| Storage target type "S3" / "MINIO" in create form | Label as "Coming Soon" | No upload implementation exists. Creating an S3 target and expecting it to receive artifacts will silently do nothing. |
| `/ops/schedules` create form | Add banner "Automated execution not yet active" | Cron executor is not implemented. Schedules stored in DB are never fired. |

---

## Items to WATCH

| Item | Why |
|------|-----|
| `ops_backup_runs.correlationId UNIQUE` index | After FIX-03 is applied, consider whether to keep or drop this constraint. If idempotency is implemented correctly, keeping it is safe and useful. If not, it becomes a landmine. |
| `BACKUP_PASSPHRASE` default fallback in `backup_full.sh` | Once BACKUP_PASSPHRASE is set as a required env var (FIX-07), change the fallback from a warning to an `error_exit` in non-dev environments. |
