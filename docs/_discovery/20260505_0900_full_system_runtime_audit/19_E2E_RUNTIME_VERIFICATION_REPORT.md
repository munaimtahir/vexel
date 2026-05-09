# 19_E2E_RUNTIME_VERIFICATION_REPORT.md

Status: COMPLETE (API-driven runtime verification; UI/browser verification not performed in this pass)

## Auth Runtime Verification (Operator)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/10_auth_login_redacted_v3.txt` (login 200; refresh cookie set)
- `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/11_me_redacted_v3.txt` (me 200)
- `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/12_auth_refresh_redacted_v3.txt` (refresh 200)
- `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/13_auth_refresh_reuse_old_redacted_v3.txt` (old token reuse 401)

Result:
- Refresh rotation verified (old refresh token cannot be reused).

## LIMS Happy Path (API-Driven)

Evidence:
- Catalog test discovery: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/20_catalog_tests_list.txt`
- Create patient: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/21_create_patient.txt`
- Create encounter: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/22d_create_encounter_ok.txt`
- Order lab: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/23d_order_lab_ok.txt`
- Collect specimen: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/25d_collect_specimen_ok.txt`
- Receive specimen: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/26d_receive_specimen_ok.txt`
- Enter result: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/27d_enter_result_ok.txt`
- Verify (verifier user): `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/32_verifier_verify.txt`
- Publish report:
  - Pre-verify publish blocked with 409: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/31_verifier_publish_before_verify.txt`
  - Publish immediately after verify returned 409 (“not rendered yet”): `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/33_verifier_publish.txt`
  - Retry publish succeeded 200 (document returned with payloadHash/pdfHash): `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/34_verifier_publish_again.txt`
  - Post-publish idempotency check 200 (same document id): `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/35_verifier_publish_idempotent_check.txt`

Key runtime assertions verified:
- Command-only workflow endpoints function end-to-end (encounter status transitions observed in responses).
- Invalid transitions return 409 (publish-before-verify and publish-before-render).
- Deterministic document fields present (`payloadHash`, `pdfHash`) and publish is idempotent.

## Audit + CorrelationId Runtime Verification

Evidence:
- API health includes `x-correlation-id`: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/01_api_health.txt`
- Audit event list (admin user): `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/37_audit_events_list_admin.txt`

Observed:
- Workflow commands created `AuditEvent` rows with matching `correlationId` values.
- Worker/document events (`document.generate`, `document.rendered`, `document.auto_published`) also appear in audit stream.

## UI Verification

Status: NOT VERIFIED
- No Playwright/manual browser flow screenshots captured in this audit pass.
- Only HTTP reachability to `/admin/login` and `/` was confirmed. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/03_admin_root.txt`, `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/04_operator_root.txt`
