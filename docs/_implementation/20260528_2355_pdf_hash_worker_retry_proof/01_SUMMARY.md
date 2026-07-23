# Summary — PDF Hash and Worker Retry Proof

## Objective
The goal of this task was to provide empirical runtime evidence for two critical platform mandates:
1. **Document Determinism:** Proving that the `pdfHash` stored in the database exactly matches the SHA256 hash of the generated PDF file.
2. **Worker Robustness:** Demonstrating controlled job failure, visibility of that failure in the platform, and successful manual retry.

## Execution Overview
- **Test Encounter:** Created a full LIMS lifecycle (Registration -> Order -> Result -> Verify).
- **PDF Hash Proof:** Verified for both `LAB_REPORT` and `RECEIPT`.
- **Worker Failure Proof:** Triggered a failure by using an invalid template key (`invalid_template_xyz`).
- **Worker Retry Proof:** Fixed the template and successfully retried the failed job via the BullMQ `retry()` mechanism.
- **Audit Proof:** Captured audit events for generation, failure, and successful rendering.

## Verdict
**PASS**
- PDF hashes match exactly.
- Worker failure was captured and audited.
- Manual retry successfully moved the document from `FAILED` to `PUBLISHED`.
