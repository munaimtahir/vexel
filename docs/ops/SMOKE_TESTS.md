# Smoke Tests (MVP)

Run after each slice.

## Health
- GET /api/health
- GET /pdf/health

## Tenancy isolation
- Create patient under Tenant A
- Ensure Tenant B cannot access it (404)

## Workflow idempotency (publish)
- Publish report twice
- Expect same documentId and hashes

## Queue
- Enqueue one render job
- Confirm worker processes it
- Document status becomes RENDERED
