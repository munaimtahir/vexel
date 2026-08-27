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

### Document pipeline smoke (verify → auto-generate → RENDERED → manual publish → download)

**Command-only workflow state is enforced end-to-end.** As of `da2047f`
the worker never mutates `Encounter.status` and never auto-publishes a
`LAB_REPORT`. The compliant path, live-verified 2026-08-27:

1. `POST /encounters/{id}:verify` (requires `result.verify`) — moves the
   encounter `resulted → verified`, and as a side effect auto-generates a
   `LAB_REPORT` `Document` (creates/reuses `QUEUED`, enqueues a render job).
   This does **not** touch `Encounter.status` — Document creation isn't a
   workflow-state mutation, so it's fine for it to be automatic.
2. Worker renders the document: `QUEUED → RENDERING → RENDERED` (or
   `FAILED`). Confirm it lands on `RENDERED`, **not** `PUBLISHED` —
   `GET /api/documents?sourceRef=<encounterId>&sourceType=ENCOUNTER&docType=LAB_REPORT&limit=1`.
3. Operator/verifier manually calls `POST /encounters/{id}:publish-report`
   (requires `document.publish`). This is idempotent (safe to call twice —
   second call returns `200` with the same already-`PUBLISHED` document/
   `published` encounter, does not error or re-mutate) and is the **only**
   path that moves the document to `PUBLISHED` and the encounter to
   `published`, in one audited command (`encounter.publish_report`).
4. Download: `GET /api/documents/{id}/download` returns `application/pdf`
   bytes.

API check example (replace `$TOKEN`, `$EID`, `$LOID` from a real run):

```bash
# after :verify — confirm RENDERED, not PUBLISHED
curl -fsS "http://127.0.0.1:9021/api/documents?sourceRef=$EID&sourceType=ENCOUNTER&docType=LAB_REPORT&limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].status'   # expect "RENDERED"

# manual publish
curl -fsS -X POST "http://127.0.0.1:9021/api/encounters/$EID:publish-report" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  | jq '{encounterStatus: .encounter.status, documentStatus: .document.status}'
# expect {"encounterStatus":"published","documentStatus":"PUBLISHED"}
```

Expected:
- LAB_REPORT reaches `RENDERED` automatically after verify, and stays
  there until a human explicitly publishes it — it must **not** reach
  `PUBLISHED` on its own.
- `:publish-report` is idempotent and audited; calling it again after
  publish returns `200`, doesn't error, doesn't double-transition.
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
