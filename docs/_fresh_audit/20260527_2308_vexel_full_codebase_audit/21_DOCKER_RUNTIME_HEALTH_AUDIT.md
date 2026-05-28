# Docker Runtime Health Audit

Primary evidence:
- Compose config: `docker/compose_config.yaml`
- Compose ps output: `docker/compose_ps.txt`
- Compose logs (tail): `docker/compose_logs_tail200.txt`
- Health endpoints:
  - API: `runtime-responses/api_health.json`
  - PDF: `runtime-responses/pdf_health.json`
  - Admin HTML: `runtime-responses/admin_login.html`
  - Operator root redirect: `runtime-responses/operator_root.html`

## Runtime status (this run)

From `docker compose ps`:
- `postgres`: Up (healthy)
- `redis`: Up (healthy)
- `minio`: Up (healthy)
- `api`: Up (healthy)
- `pdf`: Up (healthy)
- `worker`: Up
- `admin`: Up
- `operator`: Up
(Evidence: `docker/compose_ps.txt`)

## Endpoint checks (this run)
- `GET http://127.0.0.1:9021/api/health` -> 200 with `status: ok` (Evidence: `runtime-responses/api_health.json`)
- `GET http://127.0.0.1:9022/health/pdf` -> 200 with `status: ok` (Evidence: `runtime-responses/pdf_health.json`)
- `GET http://127.0.0.1:9023/admin/login` -> 200 HTML (Evidence: `runtime-responses/admin_login.html`)
- `GET http://127.0.0.1:9024/` -> `/login` (redirect content) (Evidence: `runtime-responses/operator_root.html`)

## Verdict (this run)

**DOCKER RUNTIME PASS**

