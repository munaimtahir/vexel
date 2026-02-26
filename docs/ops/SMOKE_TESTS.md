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

### Document pipeline smoke (verify → render → publish → download)

1. Verify encounter from Operator verification flow.
2. Confirm a LAB_REPORT document reaches `RENDERED` (not auto-published).
3. Open `/lims/encounters/{encounterId}/publish` and click **Publish report**.
4. Confirm document status becomes `PUBLISHED` and encounter status becomes `published`.
5. Download PDF from publish page (API endpoint `GET /api/documents/{id}/download` returns PDF bytes).

API check example:

```bash
curl -fsS "http://127.0.0.1:9021/api/documents?encounterId=<encounterId>&docType=LAB_REPORT&limit=1" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:
- first status `RENDERED`, after publish command status `PUBLISHED`
- download opens/saves a valid PDF
