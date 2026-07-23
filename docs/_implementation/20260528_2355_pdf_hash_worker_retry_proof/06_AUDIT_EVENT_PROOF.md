# Audit Event Proof

## Verification Results

### Document Generation
- **Action:** `document.generate`
- **Correlation ID:** Captured.
- **Payload:** Includes `templateId`, `type`, and `payloadHash`.

### Render Failure
- **Action:** `document.render_failed`
- **Payload:** Includes `errorMessage`.

### Render Success
- **Action:** `document.rendered`
- **Payload:** Includes `pdfHash` and `storageKey`.

### Auto-Publish
- **Action:** `document.auto_published`
- **Trigger:** Successful render of `RECEIPT` or `LAB_REPORT`.

## Evidence Files
- Audit Events (Retry Flow): `runtime-responses/worker/retry_audit_event.json`
