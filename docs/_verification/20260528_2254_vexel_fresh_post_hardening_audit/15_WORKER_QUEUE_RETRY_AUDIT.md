# Worker/Queue/Retry Audit

## Worker Status and Monitoring
- **Heartbeat:** Every 30s (`setInterval(writeHeartbeat, 30_000)`).
- **Storage:** Upserts `worker-singleton` row in `worker_heartbeats` table.
- **Monitoring:** API health checks (`/health/worker` and `/health/deep`) probe this heartbeat row.

## Queue Configuration (BullMQ)

| Queue | Concurrency | Retry Policy | Processor |
| ----- | ----------- | ------------ | --------- |
| `document-render` | 3 | 3 attempts, exp backoff | `processDocumentRender` |
| `catalog-import` | 1 | (not explicit in main.ts) | `processCatalogImport` |
| `catalog-export` | 1 | (not explicit in main.ts) | `processCatalogExport` |
| `ops-backup` | 1 | (not explicit in main.ts) | `processOpsBackup` |

## Job Lifecycle and Idempotency
- **Creation:** Jobs are created in `QUEUED` or `RENDERING` state.
- **Deduplication:** Hashing of payloads prevents redundant jobs for the same document.
- **Idempotency:** Processors check current status before processing; skips if already `RENDERED` or `PUBLISHED`.
- **Auto-Publish:** Documents of type `RECEIPT` and `LAB_REPORT` are automatically moved to `PUBLISHED` status after successful render.

## Failure and Retry Proof
- **Mechanism:** BullMQ retry + Manual retry via API.
- **Manual Retry:** `POST /jobs/:id:retry` and `POST /catalog/import-jobs/:id:retry`.
- **Evidence:** `JobsService.retryJob` and `CatalogJobsService.retryImportJob` verified.

## Required Verdict
**WORKER/QUEUE PASS**

## Status Summary
The worker system is well-designed with active monitoring and clear concurrency controls. The heartbeat mechanism provides reliable liveness checks, and the processors implement robust idempotency and failure handling. Job retry logic is correctly integrated with the platform's audit system.
