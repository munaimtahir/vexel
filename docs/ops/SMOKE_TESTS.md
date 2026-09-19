# Smoke Tests

## 1) Mock-mode UI smoke

Use this for contract/UI-only checks.

```bash
pnpm mock:api
pnpm dev:ui-mock
pnpm mock:smoke
```

Expected:
- mock gateway on `127.0.0.1:9031`
- admin/operator pages load against mock APIs
- `pnpm mock:smoke` passes all scenarios

---

## 2) Full-stack smoke (Docker Compose)

### Start stack

```bash
docker compose up -d --build
docker compose ps
```

Expected service endpoints:
- API: `127.0.0.1:9021` (Nest internal 3000)
- PDF: `127.0.0.1:9022` (internal 8080)
- Admin: `127.0.0.1:9023`
- Operator: `127.0.0.1:9024`
- MinIO console: `127.0.0.1:9025`
- MinIO S3: `127.0.0.1:9027`
- Postgres: `127.0.0.1:5433`
- Redis: `127.0.0.1:6380`

### Health checks

```bash
curl -fsS http://127.0.0.1:9021/api/health
curl -fsS http://127.0.0.1:9022/health
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9023/admin/login
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9024/lims/worklist
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9025/
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9027/minio/health/live
```

Expected:
- API/PDF health return `200`
- Admin/Operator pages return `200`
- MinIO console/live endpoint reachable

### Auth smoke

```bash
TOKEN=$(curl -fsS -X POST http://127.0.0.1:9021/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@vexel.system","password":"Admin@vexel123!"}' | jq -r .accessToken)

curl -fsS http://127.0.0.1:9021/api/me \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- login returns access token
- `/api/me` returns authenticated user payload

### Document pipeline smoke (verify → auto-generate/publish → download)

**Command-only workflow state is enforced end-to-end.** Verification is a
per-test command. It automatically queues rendering and publication of a
report containing every currently verified test. The report is labelled
`PARTIAL` while a non-cancelled test remains unverified.

1. `POST /ordered-tests/{id}:verify` (requires `result.verify`) verifies one
   submitted test, recomputes the encounter summary, and creates/reuses a
   `QUEUED` `LAB_REPORT` document.
2. Worker renders and publishes the document: `QUEUED → RENDERING → RENDERED
   → PUBLISHED`, or `FAILED`. A failure leaves clinical verification intact and
   exposes an authorized, audited retry action.
3. Download: `GET /api/documents/{id}/download` returns `application/pdf`
   bytes once published.

API check example (replace `$TOKEN`, `$EID`, `$LOID` from a real run):

```bash
# after per-test verification — wait for PUBLISHED (or FAILED)
curl -fsS "http://127.0.0.1:9021/api/documents?sourceRef=$EID&sourceType=ENCOUNTER&docType=LAB_REPORT&limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].status'   # expect "PUBLISHED" or "FAILED"
```

Expected:
- LAB_REPORT reaches `PUBLISHED` automatically after verification. A failed
  report is visible and retryable without undoing verification.
- download opens/saves a valid PDF.

### Tenant isolation smoke (live-verified 2026-08-27)

```bash
# 1. Spoofed x-tenant-id header on an authenticated request → must be rejected outright
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:9021/api/encounters/<id>" \
  -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: <other-tenant-id>"
# expect 403 "Cross-tenant header override is not allowed for authenticated requests"

# 2. Spoofed Host on login (a user from tenant A resolved against tenant B's Host) → must fail auth
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:9021/api/auth/login \
  -H 'Content-Type: application/json' -H 'Host: <tenant-b-domain>' \
  -d '{"email":"<tenant-a-user-email>","password":"..."}'
# expect 401 Invalid credentials

# 3. Direct-object-reference read of another tenant's row by ID → must 404, not 403 (don't leak existence)
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:9021/api/users/<other-tenant-user-id>" \
  -H "Authorization: Bearer $TOKEN"
# expect 404
```

Expected: all three return the codes above — tenant context comes from
the authenticated JWT (`req.user.tenantId`), never from a client-supplied
header in production (`TENANCY_DEV_HEADER_ENABLED=false` live), and every
query is tenant-filtered so a wrong-tenant ID reads as not-found rather
than forbidden-but-confirmed-to-exist.
