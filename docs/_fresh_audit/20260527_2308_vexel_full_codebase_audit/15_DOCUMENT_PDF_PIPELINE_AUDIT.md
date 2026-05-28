# Document and PDF Pipeline Audit (Static + Runtime)

Primary evidence (runtime):
- Verification success including `documentJobId`: `runtime-responses/truthmap/encounter_verify2.json`
- Documents list after verify: `runtime-responses/truthmap/doc-poll/poll_1.json`
- Document download bytes: `runtime-responses/truthmap/doc_download_2aa654bf-f25c-4d3e-95e8-e2c71451070b.pdf`
- Downloaded PDF SHA256: `runtime-responses/truthmap/doc_download_2aa654bf-f25c-4d3e-95e8-e2c71451070b.sha256`
- Audit events for document generation/render/publish: `runtime-responses/truthmap/audit_events_verify.json`

Primary evidence (runtime health):
- PDF service health response: `runtime-responses/pdf_health.json`
- Docker compose status (pdf/worker healthy): `docker/compose_ps.txt`

## Runtime findings (this run)

### Report generation + publish behavior
After `POST /verification/encounters/{encounterId}:verify`:
- A document job id is returned immediately.
- Within ~1 second polling `GET /documents?encounterId=...` returned two documents:
  - `LAB_REPORT` (status `PUBLISHED`)
  - `RECEIPT` (status `PUBLISHED`)
(Evidence: `runtime-responses/truthmap/encounter_verify2.json`, `runtime-responses/truthmap/doc-poll/poll_1.json`)

### Determinism / hash evidence
For the LAB_REPORT document:
- Document record includes `pdfHash`.
- Downloaded PDF bytes SHA256 matches the document’s `pdfHash`.
(Evidence: `runtime-responses/truthmap/doc-poll/poll_1.json`, `runtime-responses/truthmap/doc_download_*.sha256`)

### Audit trail evidence
Audit events for the verify correlationId include:
- `document.generate`
- `document.rendered`
- `document.auto_published`
- `encounter.auto_publish_report`
(Evidence: `runtime-responses/truthmap/audit_events_verify.json`)

## Pipeline verdict (this run)

**DOCUMENT PIPELINE PASS (system tenant, verify → render → publish → download)**

Notes:
- The observed runtime behavior is “verify triggers auto generation/render/publish” (no separate manual publish step needed for LAB_REPORT in this run).

