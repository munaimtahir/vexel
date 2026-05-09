# 17_RUNTIME_BOOT_AND_HEALTH_CHECKS.md

Status: COMPLETE (runtime stack already up; verified via docker + HTTP)

## Docker Compose Boot Status

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/202_compose_ps_after.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/201_compose_up.txt`

Observed:
- All services are `Up` (api/pdf/postgres/redis/minio show `healthy`; admin/operator show `Up` without health status). This matches the known healthcheck misconfiguration note for Next.js apps.

## Health Endpoints (HTTP)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/01_api_health.txt` (200; includes `x-correlation-id`)
- `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/02b_pdf_health_correct.txt` (200 at `/health/pdf`)
- `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/03_admin_root.txt` (200 at `/admin/login`)
- `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/04_operator_root.txt` (200 at `/`)

Notes:
- Initial probe to `GET /health` on PDF returned 404; correct endpoint is `GET /health/pdf`. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/runtime-responses/02_pdf_health.txt`
