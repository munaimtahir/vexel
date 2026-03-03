# Tenant Service Health Endpoint

**Endpoint:** `GET /api/tenants/{tenantId}/service-health`  
**Permission required:** `tenant.read`  
**Auth:** Bearer JWT (admin user)  
**Tags:** AdminTenants

---

## Purpose

Returns a real-time read-only snapshot of infrastructure health and LIMS operational metrics for a specific tenant. Use it for:

- Operator support dashboards (is the worker processing jobs?)
- Incident triage (which service is down for a given tenant?)
- LIMS operational monitoring (backlog of pending results, verification queue depth)

This endpoint is **non-mutating** — it never changes workflow state or data.

---

## Response Shape

```json
{
  "tenant": {
    "id": "uuid",
    "name": "Tenant Name",
    "domains": ["tenant.example.com"],
    "status": "active",
    "featureFlags": { "module.lims": true }
  },
  "services": {
    "api": { "ok": true, "version": "0.1.0", "uptimeSec": 3600.5 },
    "worker": {
      "ok": true,
      "queues": { "documentRenderDepth": 0, "failedJobs24h": 0 },
      "lastHeartbeatAt": "2026-03-03T03:00:00.000Z"
    },
    "pdf":   { "ok": true, "latencyMs": 45 },
    "db":    { "ok": true, "latencyMs": 2 },
    "redis": { "ok": true, "latencyMs": 1 }
  },
  "limsSnapshot": {
    "pendingResults": 5,
    "pendingVerification": 2,
    "failedDocuments24h": 0,
    "publishedToday": 12
  }
}
```

---

## Field Interpretation

### `tenant`

| Field | Meaning |
|-------|---------|
| `status` | `active` = normal, `suspended` = tenant disabled by admin, `trial` = trial period |
| `featureFlags` | Map of all feature flag keys → enabled boolean for this tenant |

### `services.api`

Always `ok: true` if you received a response (the API itself answered). `uptimeSec` is the NestJS process uptime in seconds since last restart.

### `services.worker`

| Field | Meaning |
|-------|---------|
| `ok` | `true` if worker wrote a heartbeat within the last **60 seconds**. `false` means worker may be down or crashed. |
| `queues.documentRenderDepth` | Number of document render jobs waiting in the BullMQ queue. High values indicate worker is behind or stuck. |
| `queues.failedJobs24h` | Count of `job_runs` rows with `status=failed` and `finishedAt` in last 24h. Non-zero indicates systematic failures. |
| `lastHeartbeatAt` | ISO timestamp of last worker heartbeat write. Null if worker has never run since heartbeat table was created. |

**Note:** The worker writes a heartbeat row (`worker_heartbeats.id = 'worker-singleton'`) every 30 seconds. If `lastHeartbeatAt` is null, the worker container has not started yet or was never deployed.

### `services.pdf`

Probes `GET {PDF_SERVICE_URL}/health/pdf` with a **1500ms timeout**. If the PDF service is unreachable or slow, `ok: false` with `error` set. PDF being down means lab reports cannot be rendered, but existing reports can still be downloaded.

### `services.db`

Executes `SELECT 1` via Prisma. `latencyMs` is the round-trip time. Anything above 50ms warrants investigation.

### `services.redis`

Pings Redis. `latencyMs` above 10ms is unusual. If `ok: false`, BullMQ workers cannot process jobs.

### `limsSnapshot`

All counts are **scoped to the queried tenantId** — no cross-tenant data.

| Field | Meaning |
|-------|---------|
| `pendingResults` | Encounters in state `lab_ordered`, `specimen_collected`, `specimen_received`, or `partial_resulted`. These have outstanding result entry work. |
| `pendingVerification` | Encounters in state `resulted` — results entered, awaiting verifier sign-off. |
| `failedDocuments24h` | Documents with `status=FAILED` and `updatedAt` in the last 24 hours. Non-zero indicates PDF rendering issues. |
| `publishedToday` | Documents with `status=PUBLISHED` and `publishedAt >= today midnight UTC`. Reflects daily report output volume. |

---

## Operational Runbook

### Worker appears down (`ok: false`)

1. Check `lastHeartbeatAt` — if null, worker container never started.
2. Run `docker compose ps vexel-worker` — is it running?
3. Check logs: `docker compose logs vexel-worker --tail=50`
4. Common cause: Redis unreachable (check `services.redis.ok`) or DATABASE_URL misconfigured.

### High `documentRenderDepth`

1. Worker is alive but falling behind — check CPU/memory.
2. PDF service unreachable (`services.pdf.ok`) — renders fail immediately, not stacking.
3. Concurrency set to 3 by default in worker. Increase if persistent backlog.

### Non-zero `failedDocuments24h`

1. Check documents table: `SELECT * FROM documents WHERE status='FAILED' AND "updatedAt" > NOW() - INTERVAL '24h'`
2. Check `errorMessage` column for root cause.
3. Common causes: PDF service timeout, S3/MinIO unreachable, malformed template.

---

## Security Notes

- Only users with `tenant.read` permission can call this endpoint (typically super-admin role).
- Every call emits an `AuditEvent` with `action = admin.tenant.service_health.read`.
- The endpoint does not expose raw query data, credentials, or internal stack traces.
- Probe errors are surface-level messages only (e.g., `"ECONNREFUSED"`, not full stack traces).
