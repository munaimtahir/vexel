# OPD Document Evidence

**Decision:** `NOT READY` — current evidence is partial.

## Required document flow

Prescription and receipt documents must use the established async worker/PDF pipeline with canonical payload ordering, stable `payloadHash`, rendered-byte `pdfHash`, tenant-scoped document identity, idempotent retries, failure visibility, authorized retry, and tenant/permission-scoped retrieval.

## Baseline evidence

The existing OPD service calls `DocumentsService.generateDocument(...)` and exposes encounter prescription/receipt metadata and file routes. Historical OPD runtime evidence explicitly records that a dedicated OPD browser flow and local QuestPDF runtime verification were not executed. This is not release evidence for `READY`.

## Required passing evidence

- Same semantic payload produces the same payload hash.
- Changed tenant branding/template/content produces a distinct identity.
- Repeated generation requests produce one document/result.
- Worker/PDF failure is persisted, visible, audited, and safely retryable.
- PDF hash is computed from rendered bytes.
- Cross-tenant and unauthorized downloads fail without inference.
- Browser proof covers prescription and receipt retrieval and reprint audit behavior.
