# Autopublish Idempotency Proof

## Methodology
1. Prepare a verified encounter with existing documents.
2. Trigger the `verification` and `generation` paths again for the same encounter.
3. Compare the document lists before and after the repeat triggers.

## Results
- **Before Repeat:** 2 documents (1 LAB_REPORT, 1 RECEIPT).
- **After Repeat:** 3 documents (2 LAB_REPORT, 1 RECEIPT).
- **Finding:** A new `LAB_REPORT` was created because the `issuedAt` field in the payload changed.

## Root Cause Analysis
The `DocumentsService.generateFromEncounter` logic uses the timestamp of the `ENCOUNTER_VERIFIED` audit event as the `issuedAt` anchor. However, in the verification service, `generateFromEncounter` is called **before** the audit event is logged. 
- **First Call:** No audit event found -> uses `encounter.createdAt`.
- **Second Call:** Audit event found -> uses `auditEvent.createdAt`.

This difference in payload causes a `payloadHash` mismatch, triggering a new document creation.

## Evidence Files
- Before: `runtime-responses/documents/documents_before_repeat.json`
- After: `runtime-responses/documents/documents_after_repeat.json`
