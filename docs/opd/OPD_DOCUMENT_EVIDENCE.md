# OPD Document Evidence

**Decision:** `NOT READY`

Prescription and receipt generation call the shared deterministic `DocumentsService` pipeline. Existing general document tests cover canonical JSON and idempotency, but they do not prove the full OPD release requirement.

Missing OPD-specific evidence:

- same semantic OPD payload produces the same identity and changed clinical/payment content creates a new version;
- exact tenant/patient/clinician/encounter/timestamp/layout content is rendered by QuestPDF;
- controlled PDF failure reaches `FAILED`, authorized retry safely requeues it, and duplicate workers remain safe;
- repeated publication is idempotent and recoverable after failure;
- prescription/receipt metadata and bytes are tenant- and permission-scoped;
- browser download/reprint and audit behavior pass for least-privilege personas.

The shared pipeline is a valid foundation, not complete OPD production evidence.
