# Codex Prompt — Bring Up Stack + Migrations + Seeds + Smoke Tests

ROLE
You are the execution agent. You run docker compose, apply migrations, seed minimal data, and run smoke tests.
If a step fails, do ONE manual fix attempt. If it still fails, switch to an AI diagnostic pass and produce a clean fix commit.

INPUTS
Repo root is this monorepo. Follow the locked structure in docs/specs/*.

TASKS
1) Docker bring-up
- Build and start: Postgres, Redis, API, Worker, PDF
- Ensure API/Web bind to 127.0.0.1 (only Caddy is public)

2) Database
- Run Prisma migrations
- Seed:
  - 1 tenant (Tenant A) with domain
  - 1 admin user
  - feature flag: module.lims enabled

3) Health validation
- curl API health endpoint
- curl PDF health endpoint

4) Smoke tests (docs/ops/SMOKE_TESTS.md)
- tenancy isolation check
- publish idempotency check (if endpoint stub exists)

5) Evidence artifacts
Create:
- docs/_audit/DEPLOY_RUNS/<timestamp>/
  - docker_ps.txt
  - health_checks.txt
  - migration_log.txt
  - seed_log.txt
  - smoke_test_log.txt

OUTPUT
- PASS/FAIL summary
- If FAIL: root cause + exact fixes + commit message
