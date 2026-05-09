# 07_FRONTEND_SDK_USAGE_AUDIT.md

Status: COMPLETE (static scan; runtime network verification pending)

## Forbidden Patterns Scan (Admin/Operator)

Scope:
- `apps/admin/src/**`
- `apps/operator/src/**`

Results (rg heuristics):
- No `axios` / `fetch(` / `XMLHttpRequest` usage detected in source trees. Evidence:
  - `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/55_admin_axios_fetch.txt`
  - `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/56_operator_axios_fetch.txt`
- No obvious hardcoded `/api/` references detected in source trees (heuristic only). Evidence:
  - `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/57_admin_api_hardcoded.txt`
  - `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/58_operator_api_hardcoded.txt`

Notes:
- This is a static text scan; it does not guarantee there are no runtime bypasses (e.g., indirect calls, third-party libs). Runtime verification is covered in `19_E2E_RUNTIME_VERIFICATION_REPORT.md`.

## SDK Usage Signals

Observed:
- Admin + Operator depend on `@vexel/sdk` (workspace dep) and Next config transpiles `@vexel/sdk`. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/59_admin_sdk_imports.txt`
- Source-only import scan performed (to avoid build artifacts). Evidence:
  - `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/62_admin_sdk_imports_srconly.txt`
  - `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/62_operator_sdk_imports_srconly.txt`

Not verified in this phase:
- Whether every API interaction routes through the SDK client (requires runtime network capture and code-path review).
