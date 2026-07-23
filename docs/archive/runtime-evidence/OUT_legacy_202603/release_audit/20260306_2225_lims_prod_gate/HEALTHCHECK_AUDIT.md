# Health Check Audit — LIMS Production Gate

## Endpoint Results

| Endpoint | URL | Expected | Actual | Status |
|----------|-----|----------|--------|--------|
| API health | `GET /api/health` | Real status | `{"status":"ok","uptime":85149,"services":{"api":"ok"}}` | ✅ Real |
| Worker health | `GET /api/health/worker` | Redis + worker status | Always `{"status":"ok","services":{"worker":"ok","redis":"unknown"}}` | ❌ STUB |
| PDF health (proxied) | `GET /api/health/pdf` | PDF service status | Always `{"status":"ok","services":{"pdf":"ok"}}` | ❌ STUB |
| PDF service direct | `GET :9022/health/pdf` | Real status | `{"status":"ok","version":"1.0.0"}` | ✅ Real |

## Worker Health Details

**Code in `apps/api/src/health/health.controller.ts`:**
```typescript
@Get('worker')
getWorkerHealth() {
  // TODO: check Redis/BullMQ connectivity
  return { status: 'ok', services: { worker: 'ok', redis: 'unknown' } };
}
```

The worker does write a heartbeat row to `worker_heartbeats` table every 30s (implemented in `apps/worker/src/main.ts`). The API health endpoint could query this table to determine actual worker liveness — but it does NOT currently do so.

**Impact:** If the worker process crashes, `GET /api/health/worker` still returns `{"status":"ok"}`. Any monitoring tool relying on this endpoint will miss the outage.

## PDF Health Details

**Code:**
```typescript
@Get('pdf')
getPdfHealth() {
  // TODO: proxy to PDF service
  return { status: 'ok', services: { pdf: 'ok' } };
}
```

The PDF service has a real health endpoint at `http://pdf:8080/health/pdf`. The API health proxy endpoint does not call it.

## Docker Compose Health Checks

| Service | Healthcheck | Status |
|---------|-------------|--------|
| postgres | `pg_isready -U vexel` | ✅ Healthy |
| redis | `redis-cli ping` | ✅ Healthy |
| minio | `curl http://localhost:9000/minio/health/live` | ✅ Healthy |
| api | `wget http://localhost:3000/api/health` | ✅ Healthy |
| pdf | `curl http://localhost:8080/health/pdf` | ✅ Healthy |
| admin | `healthcheck: disable: true` | ⚠️ No check |
| operator | `healthcheck: disable: true` | ⚠️ No check |
| worker | No healthcheck | ⚠️ No check |

## Required Fixes

1. **`/api/health/worker`** — query `worker_heartbeats` table; if `lastBeatAt < now - 90s`, return `503` with `worker: 'degraded'`
2. **`/api/health/pdf`** — HTTP GET to `PDF_SERVICE_URL/health/pdf`; return status from response or 503 on error
