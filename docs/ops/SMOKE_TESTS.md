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

## Phase 3+ Tests (Upcoming)

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
