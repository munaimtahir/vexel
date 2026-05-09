# 04_RUNTIME_ARCHITECTURE_DISCOVERY.md

Status: IN PROGRESS (static discovery complete; runtime verification pending)

## Declared Runtime Topology (Docker Compose)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/98_docker_compose_yml_head.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/21_compose_config.txt`

Observed:
- A `docker-compose.yml` exists and declares the multi-service stack (Postgres, Redis, API, Worker, PDF, Admin, Operator, MinIO). (Detailed port bindings and healthchecks will be confirmed during runtime boot attempts.)

## Reverse Proxy (Caddy)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/95_caddy_config.txt`

Observed:
- Caddyfile exists at `/home/munaim/srv/proxy/caddy/Caddyfile` and includes routing for `/api/*`, `/pdf/*`, `/admin/*`, plus a catch-all to Operator (per file contents).

Not verified in this phase:
- Whether Caddy is currently running on this host and serving the stack (covered under runtime boot + health checks).
