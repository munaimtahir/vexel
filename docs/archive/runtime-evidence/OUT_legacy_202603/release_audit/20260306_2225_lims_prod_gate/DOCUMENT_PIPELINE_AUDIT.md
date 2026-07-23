# Document Pipeline Audit — LIMS Production Gate

## Pipeline Architecture

```
API: generate() → canonical payload → payloadHash → create Document(RENDERING) → enqueue BullMQ job
Worker: processDocumentRender() → fetch Document → call PDF service → upload to MinIO → update RENDERED → auto-publish
```

## Phase-by-Phase Verification

### 1. Canonical payload generation
- **File:** `apps/api/src/documents/canonical.ts`
- **Method:** `JSON.stringify(sortKeys(obj))` — deterministic key-sorted JSON
- **Hash:** `crypto.createHash('sha256').update(canonicalJson(obj)).digest('hex')`
- **Result: ✅ PASS**

### 2. payloadHash computed deterministically
- Same payload always produces same hash (stable key sort, no timestamps in hash input)
- `issuedAt` is part of payload but represents document issue time, not render time — correct
- **Result: ✅ PASS**

### 3. Document identity uniqueness
- DB constraint: `@@unique([tenantId, type, templateId, payloadHash])`
- Migration `20260226214000_document_template_hash_unique` confirmed applied
- **Result: ✅ PASS**

### 4. Worker-based render pipeline
- `apps/worker/src/document-render.processor.ts` — BullMQ job processor
- Fetches document by ID, calls `PDF_SERVICE_URL/render`, uploads to MinIO, updates `pdfHash` + `storageKey`
- BullMQ `attempts: 3` configured for retries
- **Result: ✅ PASS**

### 5. pdfHash computed and stored
- Worker computes `pdfHash` from PDF service response
- Stored in `Document.pdfHash` on successful render
- **Result: ✅ PASS**

### 6. Publish idempotency
- `DocumentsService.publishDocument()` — checks `if (doc.status === 'PUBLISHED') return doc;` before writing
- Re-publish live test confirmed: second call returns identical document, no new record
- **Result: ✅ PASS**

### 7. Duplicate generate idempotency
- `DocumentsService.generate()` — `findUnique` on `(tenantId, type, templateId, payloadHash)`
- If `existing && existing.status !== 'FAILED'` → return existing document, no enqueue
- If `existing && existing.status === 'FAILED'` → reset to RENDERING and re-enqueue
- **Result: ✅ PASS**

### 8. Failure auditability and retryability
- On render failure: `Document.status = 'FAILED'`, `errorMessage` set, audit event written
- BullMQ re-throw (`throw err`) ensures job goes back to BullMQ retry queue
- FAILED documents are re-tried on next `generate()` call
- **Result: ✅ PASS**

### 9. No synchronous PDF hacks
- PDF render is async via BullMQ job processor (not blocking API response)
- API enqueues and returns `RENDERING` status — client polls for completion
- **Result: ✅ PASS**

## Notable Finding: Worker Bypasses Command Endpoint for Encounter Status

- After auto-publish of `LAB_REPORT`, worker calls `prisma.encounter.updateMany({ data: { status: 'published' } })` directly
- This bypasses the `EncountersService.publishReport()` command method
- Audit event IS written by worker directly (non-fatal try/catch)
- **Risk:** Inconsistency with platform rule "state changes via command endpoints only"
- **Classification:** MAJOR ARCHITECTURAL ISSUE (see BLOCKER-07)
