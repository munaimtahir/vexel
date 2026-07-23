# Worker Failure Proof

## Methodology
1. Create a `DocumentTemplate` with an invalid `templateKey` (`invalid_template_xyz`).
2. Trigger a document generation using this template.
3. Observe the worker processor behavior and document status.

## Verification Results
- **Job Enqueued:** YES.
- **Worker Failure:** Observed. Worker logs show `UNSUPPORTED_TEMPLATE_KEY`.
- **Document Status:** Transitioned to `FAILED`.
- **Error Message:** `PDF service returned 422: {"error":"UNSUPPORTED_TEMPLATE_KEY","templateKey":"invalid_template_xyz"}`.
- **Audit Event:** `document.render_failed` logged with error details.

## Evidence Files
- Failed Document Metadata: `runtime-responses/worker/failed_job.json`
- Worker Logs: `worker/failed_job_logs.txt`
