# 05_ENVIRONMENT_AND_CONFIGURATION_AUDIT.md

Status: IN PROGRESS (Phase 0 captured; deeper env var audit pending)

## Toolchain Versions (Host)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/09_node.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/10_pnpm.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/12_dotnet.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/13_docker.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/14_docker_compose.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/16_psql.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/17_redis.txt`

## Environment File Inventory

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/18_env_files.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/19_env_examples.txt`

Policy for this audit:
- No secret values are copied into reports.
- Any runtime responses or logs that contain tokens/credentials will be redacted before being stored under `runtime-responses/` and `logs/`.

Pending:
- Identify which `.env.example` maps to each service.
- Identify required build args (notably `NEXT_PUBLIC_API_URL`) vs runtime envs.
