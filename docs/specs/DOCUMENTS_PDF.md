# Documents + PDF Pipeline (Deterministic)

## Goal (locked)
Publishing a report/receipt must be:
- deterministic
- idempotent
- retry-safe
- scalable (async)

## Canonical payload
- Build a stable JSON payload:
  - sorted keys
  - stable ordering of arrays
  - normalized strings/numbers
- Compute `payloadHash = sha256(canonical_json)`.

## Document identity (DB)
Unique key:
(tenantId, encounterId, docType, templateVersion, payloadHash)

## Render flow (async)
1) API creates/gets Document row (idempotent) with status QUEUED.
2) API enqueues job: {documentId, tenantId}.
3) Worker loads Document + payload, calls PDF service.
4) Worker stores bytes (LOCAL now; S3 later), computes `pdfHash`.
5) Worker updates Document: status RENDERED + `pdfHash` + storageKey.
6) On failure: status FAILED + errorCode/errorMessage (audited).

## Storage backend
- MVP: LOCAL filesystem
- Later: S3/MinIO (same interface; no refactor in business logic)
