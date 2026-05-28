# Environment and Configuration Audit

Primary evidence:
- Config file discovery list: `logs/phase3_config_files_find.txt`
- Masked `.env` snapshots: `logs/env_masked/*.masked.txt`
- Masked docker-compose snapshots: `logs/config_masked/*.masked.yml`
- Config snapshots (unmasked where expected safe): `logs/config_snapshots/*`

## Environment files found

- `./.env` (present in repo working tree)
- `./.env.example`
- `./apps/admin/.env.example`
- `./scripts/mock-gateway/.env`

Masked copies for review are stored in `logs/env_masked/`.

Initial risks:
- A root `.env` exists in the repository directory. Whether it is committed or local-only is not decided here, but its presence is a **security/process risk** until Phase 19 confirms git tracking state and contents policy. (Evidence: `logs/phase3_config_files_find.txt`, `logs/env_masked/.env.masked.txt`)

## Docker Compose configuration (runtime architecture)

Two compose files are present:
- Root `docker-compose.yml`
- `docker/docker-compose.yml`

Masked copies are stored in `logs/config_masked/`.

Observed services in `docker-compose.yml` (masked snapshot evidence):
- `postgres` exposed to host `127.0.0.1:5433`
- `redis` exposed to host `127.0.0.1:6380`
- `minio` exposed to host `127.0.0.1:9027` (S3) and `127.0.0.1:9025` (console)
- `api` exposed to host `127.0.0.1:9021` (container port 3000)
- `worker` (no ports; mounts Docker socket and `./runtime/` and reads `./.env` read-only)
- `pdf` exposed to host `127.0.0.1:9022` (container port 8080)
- `admin` exposed to host `127.0.0.1:9023` (container port 3001)
- `operator` exposed to host `127.0.0.1:9024` (container port 3000)
- `mock-api` and `mock-gateway` under `profiles: [mock]` exposed to `127.0.0.1:9030/9031`

Key locked-decision alignment (config-level; runtime not yet verified):
- API healthcheck probes `http://localhost:3000/api/health` inside the container, implying a global `api` prefix is expected. (Evidence: `logs/config_masked/docker-compose.yml.masked.yml`)
- Frontends (`admin`, `operator`) receive `NEXT_PUBLIC_API_URL` as a **Docker build arg** (not runtime env), consistent with Next.js build-time public env behavior. (Evidence: `logs/config_masked/docker-compose.yml.masked.yml`)

## Tenancy dev override (config-level)

Compose config sets:
- `TENANCY_DEV_HEADER_ENABLED: "${TENANCY_DEV_HEADER_ENABLED:-false}"`

This implies an `x-tenant-id`-style dev override may exist but is gated by an explicit env flag. This must be verified statically in API code and at runtime in Phase 9. (Evidence: `logs/config_masked/docker-compose.yml.masked.yml`)

## CORS / origins (config-level)

Compose config sets `CORS_ALLOWED_ORIGINS` with a list including the production domain and localhost/127.0.0.1 ports. Needs Phase 19 review for safety and Phase 18 runtime verification. (Evidence: `logs/config_masked/docker-compose.yml.masked.yml`)

## PDF build/runtime prerequisites

- Local `dotnet` is not installed on this host (Phase 0 baseline). This may block host-native PDF service build/tests, but container builds may still work via `apps/pdf/Dockerfile`. (Evidence: `logs/phase0_baseline.txt`, `logs/config_snapshots/apps_pdf_Dockerfile`)

## Historical runtime artifacts (not evidence for this run)

Config discovery includes items under `runtime/_evidence/...` and `OUT/...`. These are treated as historical artifacts only and are not used as evidence for the current verdict. (Evidence: `logs/phase3_config_files_find.txt`)

