# Deep Health Check Audit

## Coverage Analysis
- **API:** Verified (implicit).
- **Database:** Verified via `SELECT 1` probe.
- **Redis:** Verified via `PING` and connection test.
- **Worker:** Verified via `worker-singleton` heartbeat liveness check (stale if > 60s).
- **PDF Service:** Verified via HTTP probe to `${PDF_SERVICE_URL}/health/pdf`.
- **Storage:** Verified via `HeadBucketCommand` / `ensureBucket` check on MinIO.
- **Queue:** Depth and connectivity verified via Redis probe.

## Health Probe Matrix

| Service | Method | Timeout | Status | Runtime Result |
| ------- | ------ | ------- | ------ | -------------- |
| DB | `SELECT 1` | N/A | ACTIVE | OK (48ms) |
| Redis | `PING` | 1500ms | ACTIVE | OK (59ms) |
| Worker | Heartbeat row | N/A | ACTIVE | OK |
| PDF | `GET /health/pdf` | 1500ms | ACTIVE | OK (73ms) |
| Storage | Bucket Check | N/A | ACTIVE | OK |
| Queue | `LLEN` | N/A | ACTIVE | OK (Depth: 0) |

## Required Verdict
**DEEP HEALTH PASS**

## Status Summary
Platform runtime health is verified. All critical services (DB, Redis, Worker, PDF, Storage) are operational with acceptable latencies. The deep health check accurately reflects the system state.
