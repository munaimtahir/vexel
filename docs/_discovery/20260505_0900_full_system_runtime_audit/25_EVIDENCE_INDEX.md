# 25_EVIDENCE_INDEX.md

Status: COMPLETE

Audit root:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/`

## Reports (Markdown)
- `docs/_discovery/20260505_0900_full_system_runtime_audit/01_EXECUTIVE_SUMMARY.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/02_REPOSITORY_STRUCTURE_MAP.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/03_LOCKED_RULES_COMPLIANCE_MATRIX.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/04_RUNTIME_ARCHITECTURE_DISCOVERY.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/05_ENVIRONMENT_AND_CONFIGURATION_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/06_CONTRACT_OPENAPI_SDK_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/07_FRONTEND_SDK_USAGE_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/08_BACKEND_API_DISCOVERY.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/09_TENANCY_ISOLATION_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/10_AUTH_RBAC_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/11_LIMS_WORKFLOW_COMMAND_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/12_DOCUMENT_PDF_PIPELINE_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/13_ADMIN_APP_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/14_OPERATOR_APP_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/15_DATABASE_SCHEMA_AND_MIGRATION_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/16_QUEUE_WORKER_REDIS_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/17_RUNTIME_BOOT_AND_HEALTH_CHECKS.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/18_TEST_EXECUTION_REPORT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/19_E2E_RUNTIME_VERIFICATION_REPORT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/20_SECURITY_AND_DATA_SAFETY_AUDIT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/21_GAPS_RISKS_AND_TECH_DEBT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/22_NEXT_RECOMMENDED_SPRINTS.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/23_FINAL_GO_NO_GO_VERDICT.md`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/24_COMMAND_LOG.md`

## Command Outputs
- All command outputs referenced from `docs/_discovery/20260505_0900_full_system_runtime_audit/24_COMMAND_LOG.md`
- Raw outputs stored under `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/`

Key logs:
- OpenAPI lint: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/52_openapi_lint.txt`
- Compose ps: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/202_compose_ps_after.txt`
- Tenant resolver middleware: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_tenant_tenant-resolver.middleware.ts.txt`
- JWT strategy: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_auth_jwt.strategy.ts.txt`

## Runtime Responses
- Stored under `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/`

Key runtime evidence:
- API health: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/01_api_health.txt`
- PDF health: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/02b_pdf_health_correct.txt`
- LIMS happy path (API): `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/20_catalog_tests_list.txt` through `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/35_verifier_publish_idempotent_check.txt`
- Audit events list (admin): `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/37_audit_events_list_admin.txt`

## Test Results
- Stored under `docs/_discovery/20260505_0900_full_system_runtime_audit/test-results/`

Key test evidence:
- SDK test failure (`jest` missing): `docs/_discovery/20260505_0900_full_system_runtime_audit/test-results/02_sdk_tests.txt`
- API unit test failure (1 failing test): `docs/_discovery/20260505_0900_full_system_runtime_audit/test-results/03_api_unit_tests.txt`
