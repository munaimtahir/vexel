# Command Log — LIMS Production Gate Audit

## Phase 0: Repository Inspection

```bash
git --no-pager log --oneline -10
# HEAD: af2912e origin/main — Merge pull request #4

ls apps/ packages/ .github/workflows/
# apps: admin api e2e mobile operator pdf worker
# packages: contracts sdk theme ui-system
# ci: ci.yml

cat docker-compose.yml
# 7 services; api and worker have NODE_ENV: development
# JWT_SECRET: ${JWT_SECRET:-vexel-dev-secret-REPLACE-IN-PRODUCTION}

cat .env
# JWT_SECRET=ci-test-jwt-secret-not-for-production-use-only  ← CRITICAL

cat .env.example
# JWT_SECRET=REPLACE_WITH_64_BYTE_HEX_SECRET  ← correct placeholder
```

## Phase 1: Contract/SDK

```bash
pnpm sdk:generate
# ✅ openapi-typescript 7.13.0 → api.d.ts [1s]

git diff packages/sdk/src/generated/
# (no output) → SDK is fresh

grep -rn "fetch(" apps/operator/src/ apps/admin/src/
# (no bare fetch calls found) → PASS

grep -rn "@prisma/client" apps/operator/src/ apps/admin/src/
# (no results) → PASS
```

## Phase 2: TypeScript Compilation

```bash
cd apps/api && npx tsc --noEmit
# EXIT: 0

cd apps/operator && npx tsc --noEmit
# EXIT: 0

cd apps/admin && npx tsc --noEmit
# EXIT: 0
```

## Phase 3: Unit Tests

```bash
cd apps/api && npx jest --passWithNoTests --testPathPattern="spec.ts$" --forceExit
# Test Suites: 19 passed, 19 total
# Tests: 114 passed, 114 total
```

## Phase 4: UI Color Lint

```bash
node scripts/ui-color-lint.mjs
# PASS: no hard-coded hex or arbitrary hex Tailwind classes outside token files
```

## Phase 5: Health Checks

```bash
curl -s http://127.0.0.1:9021/api/health
# {"status":"ok","version":"0.1.0","uptime":85149.58}

curl -s http://127.0.0.1:9021/api/health/worker
# {"status":"ok","services":{"worker":"ok","redis":"unknown"}}  ← STUB

curl -s http://127.0.0.1:9021/api/health/pdf
# {"status":"ok","services":{"pdf":"ok"}}  ← STUB

curl -s http://127.0.0.1:9022/health/pdf
# {"status":"ok","version":"1.0.0"}  ← real
```

## Phase 6: Live Smoke Tests

```bash
# Login
curl -s -X POST http://127.0.0.1:9021/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@demo.vexel.pk","password":"Operator@demo123!","tenantId":"system"}'
# Returns: accessToken, refreshToken, expiresIn:3600

# List patients
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:9021/api/patients?limit=3
# Returns: data[] with tenantId:system

# List encounters
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:9021/api/encounters?page=1&limit=3"
# Returns: data[] with LIMS encounters

# 409 invalid transition test
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  "http://127.0.0.1:9021/api/encounters/4ac10275:collect-specimen" \
  -H "Content-Type: application/json" -d '{"barcode":"TEST"}'
# Returns: {"message":"Cannot collect specimen for encounter in status 'published'","statusCode":409}  ✅

# Re-publish idempotency test
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://127.0.0.1:9021/api/encounters/4ac10275:publish-report"
# Returns: same encounter + same document  ✅ no duplicate
```

## Phase 7: E2E Tests

```bash
API_BASE=http://127.0.0.1:9021 OPERATOR_BASE=http://127.0.0.1:9024 \
  pnpm --filter @vexel/e2e exec playwright test tests/auth/01-login.spec.ts
# FAIL: browserType.launch: libatk-1.0.so.0: cannot open shared object file
# Root cause: Playwright Chromium system library deps not installed in this environment
# Note: This is a test infra issue, not a product defect.
```

## Phase 8: Container Secrets Inspection

```bash
docker exec vexel-api-1 env | grep -i "jwt\|node_env\|tenancy"
# JWT_SECRET=ci-test-jwt-secret-not-for-production-use-only  ← CRITICAL
# NODE_ENV=development  ← CRITICAL
# TENANCY_DEV_HEADER_ENABLED=false  ← OK

docker exec vexel-postgres-1 env | grep POSTGRES
# POSTGRES_USER=vexel, POSTGRES_PASSWORD=vexel  ← weak

docker exec vexel-minio-1 env | grep MINIO_ROOT
# MINIO_ROOT_PASSWORD=vexel_secret_2026  ← weak
```

## Phase 9: Swagger Exposure Check

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:9021/api/docs
# 200  ← Swagger exposed in production due to NODE_ENV=development
```
