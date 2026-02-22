# Smoke Tests

## Section 1: UI Smoke in Mock Mode

Run before backend is complete or for isolated UI verification.

### Prerequisites
- Docker installed, mock profile services built
- `NEXT_PUBLIC_API_URL=http://127.0.0.1:9031` set (or use `pnpm dev:ui-mock`)

### Start mock stack
```bash
pnpm mock:api          # starts Prism:9030 + gateway:9031
pnpm dev:ui-mock       # starts admin+operator pointing to gateway
```

### Run smoke script
```bash
pnpm mock:smoke        # verifies 4 happy + 4 error scenarios
```

### Manual UI checks (mock mode)
- [ ] Login with mock token → redirects to dashboard/encounters
- [ ] Worklist loads with mock encounter data
- [ ] Trigger 409 scenario → UI shows "wrong step" message
- [ ] Trigger 403 scenario → UI shows permission message

---

## Section 2: Full Stack Smoke in Real Mode

Run after backend changes or before release.

### Prerequisites
- Docker Compose stack running: `pnpm dev:full` or `docker compose up -d`
- Database seeded with test tenant + admin user

---

# Smoke Tests (MVP)

Run after each slice to verify the stack is healthy.

---

## How to Run

### Prerequisites
- Docker + Docker Compose installed
- Port availability: 3000, 3001, 3002, 5002, 5432, 6379 (all bound to 127.0.0.1)

### Boot the stack
```bash
docker compose up -d --build
```

### Wait for services to be healthy
```bash
docker compose ps
# All services should show "healthy" or "running"
```

---

## Test Suite

### 1. API Health
```bash
curl -s http://127.0.0.1:3002/api/health | jq .
```
**Expected:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": <number>,
  "services": { "api": "ok" }
}
```

### 2. Worker Health (via API)
```bash
curl -s http://127.0.0.1:3002/api/health/worker | jq .
```
**Expected:**
```json
{ "status": "ok", "services": { "worker": "ok", "redis": "unknown" } }
```

### 3. PDF Service Health
```bash
curl -s http://127.0.0.1:5002/health/pdf | jq .
```
**Expected:**
```json
{ "status": "ok", "version": "0.1.0", "services": { "pdf": "ok" } }
```

### 4. Admin App — Login Page Loads
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/login
```
**Expected:** `200`

### 5. Admin App — Protected Page Redirects Without Token
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/dashboard
```
**Expected:** `200` (redirect handled client-side; page loads but redirects to /login in browser)

### 6. Auth Login Returns Token
```bash
curl -s -X POST http://127.0.0.1:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"anypassword"}' | jq .
```
**Expected:**
```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

### 7. Authenticated API Call
```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"test"}' | jq -r .accessToken)

curl -s http://127.0.0.1:3002/api/tenants \
  -H "Authorization: Bearer $TOKEN" | jq .
```
**Expected:**
```json
{ "data": [], "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 } }
```

### 8. Correlation ID Header Propagated
```bash
curl -s -I http://127.0.0.1:3002/api/health | grep -i x-correlation-id
```
**Expected:** `x-correlation-id: <uuid>`

### 9. Tenancy Isolation (Dev Header)
```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"a@a.com","password":"p"}' | jq -r .accessToken)

# Tenant A
curl -s http://127.0.0.1:3002/api/catalog/tests \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-a" | jq .

# Tenant B (separate context)
curl -s http://127.0.0.1:3002/api/catalog/tests \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-id: tenant-b" | jq .
```
**Expected:** Each returns empty data scoped to its tenant.

---

## Smoke Test Results Log

| Date | Slice | API Health | Worker Health | PDF Health | Admin Load | Auth | Notes |
|------|-------|-----------|--------------|-----------|-----------|------|-------|
| Phase 2 | Skeleton | PASS (stub) | PASS (stub) | PASS (stub) | PASS | PASS (stub) | Stubs only — no DB yet |

---

## Phase 3 Tests — Admin Control Plane

### 10. Login + /me
```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vexel.system","password":"Admin@vexel123!"}' | jq -r .accessToken)

curl -s http://127.0.0.1:3002/api/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```
**Expected:** `{ "id": "...", "email": "admin@vexel.system", "roles": [...], "isSuperAdmin": true }`

### 11. Audit Entry Created After Admin Action
```bash
# Create a user (triggers AuditEvent)
curl -s -X POST http://127.0.0.1:3002/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","firstName":"Test","lastName":"User","password":"Test@1234!","roleIds":[]}' | jq .

# Check audit log
curl -s "http://127.0.0.1:3002/api/audit-events?action=user.create&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq .
```
**Expected:** Audit list contains 1 entry with `action: "user.create"` and a `correlationId`.

### 12. Access Denied Without Token
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3002/api/users
```
**Expected:** `401`

### 13. Privilege Escalation Blocked
```bash
# As a non-super-admin, attempt to assign a privileged role
# Should return 403 Forbidden
```
**Expected:** `403`

### 14. Feature Flag Toggle (kill switch)
```bash
# Toggle LIMS module off
curl -s -X PUT http://127.0.0.1:3002/api/feature-flags/module.lims \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}' | jq .

# Read back
curl -s http://127.0.0.1:3002/api/feature-flags \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | select(.key=="module.lims")'
```
**Expected:** `{ "key": "module.lims", "enabled": false }`

### 15. Refresh Token Rotation
```bash
REFRESH=$(curl -s -X POST http://127.0.0.1:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vexel.system","password":"Admin@vexel123!"}' | jq -r .refreshToken)

curl -s -X POST http://127.0.0.1:3002/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq .
```
**Expected:** New `accessToken` + new `refreshToken` returned; old refresh token is invalidated.

---

## Smoke Test Results Log

| Date | Slice | API Health | Worker Health | PDF Health | Admin Load | Auth | Notes |
|------|-------|-----------|--------------|-----------|-----------|------|-------|
| Phase 2 | Skeleton | PASS (stub) | PASS (stub) | PASS (stub) | PASS | PASS (stub) | Stubs only — no DB yet |
| Phase 3 | Admin Control Plane | pending | pending | pending | pending | pending | Real auth + RBAC + audit — run after `prisma migrate dev` + seed |
| Phase 4 | LIMS Scaffold | pending | pending | pending | pending | pending | Run after docker compose up with new migration |

---

## Phase 4 Tests — LIMS Scaffold

### 16. Patient Create + Retrieve (tenant-scoped)
```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vexel.system","password":"Admin@vexel123!"}' | jq -r .accessToken)

PATIENT=$(curl -s -X POST http://127.0.0.1:3002/api/patients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"John","lastName":"Doe","mrn":"MRN-001","gender":"M"}' | jq .)
echo $PATIENT | jq .id
```
**Expected:** `201` response with `id`, `tenantId`, `mrn="MRN-001"`

### 17. Register Encounter → Order Lab (state machine)
```bash
PATIENT_ID=$(echo $PATIENT | jq -r .id)

# Register encounter
ENC=$(curl -s -X POST http://127.0.0.1:3002/api/encounters \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"patientId\":\"$PATIENT_ID\"}" | jq .)
echo $ENC | jq .status
# Expected: "registered"

ENC_ID=$(echo $ENC | jq -r .id)
```
**Expected:** `201` response with `status: "registered"`

### 18. Invalid Transition Returns 409
```bash
# Try to verify a registered encounter (invalid transition)
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://127.0.0.1:3002/api/encounters/$ENC_ID:verify \
  -H "Authorization: Bearer $TOKEN"
```
**Expected:** `409 Conflict`

### 19. Catalog Test CRUD (tenant-scoped + audit)
```bash
TEST=$(curl -s -X POST http://127.0.0.1:3002/api/catalog/tests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"CBC","name":"Complete Blood Count","sampleType":"blood","turnaroundHours":2}' | jq .)
echo $TEST | jq .id
# Check audit log
curl -s "http://127.0.0.1:3002/api/audit-events?action=catalog.test.create&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq .data[0].action
```
**Expected:** Test created with `id`; audit event `action: "catalog.test.create"` present.

### 20. Session Revocation on User Disable
```bash
# Disable a user and verify their sessions are revoked
# (refresh token should return 401 after disable)
```
**Expected:** Refresh token returns `401` after user is disabled.

### 21. Operator App Loads
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/login
```
**Expected:** `200`

---

## Phase 4+ Tests (Upcoming)

### Workflow idempotency (publish)
- Publish report twice
- Expect same documentId and hashes

### Queue
- Enqueue one render job
- Confirm worker processes it
- Document status becomes RENDERED

### Tenancy isolation (DB)
- Create patient under Tenant A
- Ensure Tenant B cannot access it (404)

## Phase 5 — Catalog Domain + Job Engine

### 16. Create Catalog Test
```
POST /api/catalog/tests
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "CBC",
  "name": "Complete Blood Count",
  "department": "Hematology"
}
```
Expected: `201` with `{ id, code: "CBC", name: "Complete Blood Count", tenantId, isActive: true }`

---

### 17. Import Job — Idempotency
```
# First call
POST /api/catalog/import-jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "tests": [{ "code": "CBC", "name": "Complete Blood Count" }]
}

# Second call — identical payload
POST /api/catalog/import-jobs
Authorization: Bearer <token>
Content-Type: application/json

{
  "tests": [{ "code": "CBC", "name": "Complete Blood Count" }]
}
```
Expected: Both calls return the **same** `JobRun.id` (idempotent by payloadHash). Status: `queued`.

---

### 18. Export Job
```
# Start export
POST /api/catalog/export-jobs
Authorization: Bearer <token>

# Poll until completed
GET /api/catalog/export-jobs/{id}
Authorization: Bearer <token>
```
Expected: Status transitions `queued → running → completed`. `resultSummary` contains exported item counts.

---

### 19. Retry Failed Job
```
# Manually set job to failed (or simulate via DB)
# Then:
POST /api/catalog/import-jobs/{id}:retry
Authorization: Bearer <token>
```
Expected:
- `200` with `{ status: "queued" }`
- `AuditEvent` written with `action: "catalog.import.retry"`, `entityId: <jobRunId>`
- If job is NOT in `failed` state: `409 Conflict`

---

## Phase 5 — Document Pipeline

### 20. Generate Receipt (idempotency)
```bash
TOKEN=<your_bearer_token>

# First generate
curl -s -X POST http://127.0.0.1:3002/api/documents/receipt:generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"receiptNumber":"RCP-001","patientName":"John Doe","patientMrn":"MRN001","issuedAt":"2026-01-01T00:00:00Z","items":[],"subtotal":0,"tax":0,"grandTotal":0}' | jq .
```
Expected: `201 Created` with `{ id, status: "RENDERING", payloadHash: "..." }`

```bash
# Second generate with identical payload
curl -s -X POST http://127.0.0.1:3002/api/documents/receipt:generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"receiptNumber":"RCP-001","patientName":"John Doe","patientMrn":"MRN001","issuedAt":"2026-01-01T00:00:00Z","items":[],"subtotal":0,"tax":0,"grandTotal":0}' | jq .
```
Expected: `200 OK` — same `Document.id` returned (idempotent, not a new record).

---

### 21. Document Status Lifecycle
```bash
DOC_ID=<id from smoke test 20>

# Poll status
curl -s http://127.0.0.1:3002/api/documents/$DOC_ID \
  -H "Authorization: Bearer $TOKEN" | jq .status
```
Expected status sequence: `DRAFT` → `RENDERING` → `RENDERED` (after worker processes the job and PDF service responds).

---

### 22. Publish Document
```bash
# After document reaches RENDERED status:
curl -s -X POST http://127.0.0.1:3002/api/documents/$DOC_ID:publish \
  -H "Authorization: Bearer $TOKEN" | jq .status
```
Expected: `"PUBLISHED"`

```bash
# Publish again — idempotent, no error:
curl -s -X POST http://127.0.0.1:3002/api/documents/$DOC_ID:publish \
  -H "Authorization: Bearer $TOKEN" | jq .status
```
Expected: `"PUBLISHED"` (no `409`)

---

### 23. Hash Reproducibility
```bash
# Generate same payload twice and compare payloadHash values
HASH_1=$(curl -s -X POST http://127.0.0.1:3002/api/documents/receipt:generate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"receiptNumber":"RCP-HASH-TEST","patientName":"Hash Test","patientMrn":"MRN-HASH","issuedAt":"2026-06-01T00:00:00Z","items":[],"subtotal":0,"tax":0,"grandTotal":0}' | jq -r .payloadHash)

HASH_2=$(curl -s -X POST http://127.0.0.1:3002/api/documents/receipt:generate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"grandTotal":0,"issuedAt":"2026-06-01T00:00:00Z","items":[],"patientMrn":"MRN-HASH","patientName":"Hash Test","receiptNumber":"RCP-HASH-TEST","subtotal":0,"tax":0}' | jq -r .payloadHash)

# Keys in different order — hashes must match
[ "$HASH_1" = "$HASH_2" ] && echo "✅ Hash reproducibility OK" || echo "❌ Hash mismatch"
```
Expected: `✅ Hash reproducibility OK`
