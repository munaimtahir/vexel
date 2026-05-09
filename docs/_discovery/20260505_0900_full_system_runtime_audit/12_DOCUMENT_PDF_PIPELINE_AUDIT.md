# 12_DOCUMENT_PDF_PIPELINE_AUDIT.md

Status: IN PROGRESS (static pipeline signals found; runtime + worker/PDF verification pending)

## Document Identity + Hashing (Static)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/130_documents_service_hash_snippets.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/73_tenancy_signals.txt` (document service references)

Observed:
- `payloadHash` and `pdfHash` concepts exist in code (static strings/identifiers observed).
- Prisma unique compound key appears referenced in document service: `tenantId_type_templateId_payloadHash` (naming suggests tenantId + docType + templateId/templateVersion + payloadHash uniqueness).

Not yet verified:
- Canonical JSON normalization rules (ordering, null handling, number/string normalization).
- Whether repeated “generate document” calls are idempotent by `(tenantId, encounterId, docType, templateVersion, payloadHash)`.

## Runtime Verification (Deterministic Publish)

Evidence:
- Successful publish returns `payloadHash` and `pdfHash`: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/34_verifier_publish_again.txt`
- Publish idempotency (repeated publish returns same document id and hashes): `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/35_verifier_publish_idempotent_check.txt`
- Audit stream shows document lifecycle events (`document.generate`, `document.rendered`, `document.auto_published`): `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/37_audit_events_list_admin.txt`

Observed:
- Worker/render asynchronous behavior: immediate publish after verify returned `409 Report not rendered yet`, subsequent retry succeeded (consistent with queued render job processing).

## Worker-Driven Rendering (Static)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/91_worker_queues.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/94_pdf_service_endpoints.txt`

Status: NOT VERIFIED (needs deeper file-level review + runtime)

Pending checks:
- Identify exact queue/job name for PDF render.
- Verify correlationId propagation into worker jobs.
- Verify failure handling writes audit events and sets Document status = FAILED with error details.
