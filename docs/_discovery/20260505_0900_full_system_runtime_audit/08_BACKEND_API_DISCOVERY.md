# 08_BACKEND_API_DISCOVERY.md

Status: IN PROGRESS (static endpoint/module discovery started; runtime parity pending)

## Framework / Entry

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/72_api_routes_prefix.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/100_apps_api_src_main.ts.txt`

Observed:
- NestJS API with global prefix set to `api` (`app.setGlobalPrefix('api')`), implying all controllers are under `/api/*`.

## Controllers (Observed)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/71_api_controllers.txt`

Observed controller bases (non-exhaustive, from decorator scan):
- `auth`, `me`, `health`
- `tenants`, `users`, `roles`
- `patients`, `encounters`, `results`, `verification`, `sample-collection`
- `documents`, `templates`
- `audit-events`, `jobs`, `feature-flags`
- OPD namespaces observed: `opd`, `opd/billing` (suite-mode signal)

## Module Map (Heuristic)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/82_api_modules.txt`

Pending:
- Build a precise module graph (imports/providers/exports) from `apps/api/src/app.module.ts` and module files.

## Command Endpoints vs CRUD

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/76_workflow_command_signals.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_encounters_encounters.service.ts.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/110_apps_api_src_encounters_encounters.controller.ts.txt` (if present later)

Pending:
- Enumerate actual command routes (e.g., `POST /encounters/{id}:order-lab`, etc.) from controller methods.
- Verify invalid transitions return `409` (requires runtime).
