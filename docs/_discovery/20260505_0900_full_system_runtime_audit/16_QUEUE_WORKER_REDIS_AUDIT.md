# 16_QUEUE_WORKER_REDIS_AUDIT.md

Status: IN PROGRESS (static worker topology identified; runtime Redis/worker validation pending)

## Worker Queues (Static)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/91_worker_queues.txt`

Observed BullMQ workers (from `apps/worker/src/main.ts` references):
- `catalog-import`
- `catalog-export`
- `document-render` (noted concurrency=3 in code comments)
- `ops-backup` (noted concurrency=1 in code comments)

Pending:
- Confirm retry/backoff policies, correlationId propagation, and failure auditing by reviewing processor implementations and runtime behavior.

## Redis Connection (Static)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/92_worker_redis_config.txt`

Status: NOT VERIFIED (needs deeper review + runtime)
