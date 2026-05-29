# Document and PDF Autopublish Audit

## Deterministic Identity
- **Mechanism:** Canonical JSON serialization + SHA-256 hashing of the payload.
- **Verification:** `canonicalJson` ensures stable output regardless of object key order.
- **Payload Stability:** `normalizeDeterministicFields` standardizes `issuedAt`, `patientAge`, and demographics before hashing.

## Idempotency and Deduplication
- **Logic:** `DocumentsService.generateDocument` checks for existing document with same `tenantId + type + templateId + payloadHash`.
- **Status Guard:** Existing documents are returned unless their status is `FAILED`.
- **Publishing:** `publishDocument` is idempotent; if already `PUBLISHED`, it returns the record without mutation.

## PDF Service Integration
- **Communication:** Async via BullMQ (`document-render` queue).
- **Retry Policy:** 3 attempts with exponential backoff (2s initial).
- **Failure Path:** Processor updates status to `FAILED`, stores `errorMessage`, and logs `document.render_failed`.

## Evidence Matrix

| Logic | Fresh Evidence | Status |
| ----- | -------------- | ------ |
| Canonical Hashing | `canonical.spec.ts` | VERIFIED |
| Creation Idempotency | `document-idempotency.spec.ts` | VERIFIED |
| Publish Idempotency | `document-idempotency.spec.ts` | VERIFIED |
| Failure Handling | `document-idempotency.spec.ts` (Test 4) | VERIFIED |

## Required Verdict
**DOCUMENT/PDF PASS**

## Status Summary
The document generation system is highly reliable and deterministic. The use of canonical hashing effectively prevents redundant PDF rendering jobs, while the BullMQ integration provides robust retry and failure handling. Idempotency is preserved across both generation and publishing phases.
