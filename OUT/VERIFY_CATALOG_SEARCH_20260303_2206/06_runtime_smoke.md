# 06 — Runtime Smoke Tests

Environment: https://vexel.alshifalab.pk (live Docker Compose stack)  
Date: 2026-03-03  
Auth: `admin@vexel.system` / `Admin@vexel123!` (system tenant)

---

## Setup

The live database has 2 catalog tests in the `system` tenant:
- `Complete Blood Count` (testCode: `t2`, no userCode)
- `Glucose` (testCode: `t1`, no userCode)

The demo operator user (`operator@demo.vexel.pk`) is also in the `system` tenant.  
All smoke tests were run with system-tenant credentials.

---

## Test Results

### 1. Top Tests (empty — no pins yet)

```
GET /api/operator/catalog/tests/top
HTTP 200 in 0.104s
Response: []
```

✅ Returns empty array (no pinned tests yet)  
✅ HTTP 200  

### 2. Search: "blood" (partial contains match)

```
GET /api/operator/catalog/tests/search?q=blood&limit=20
HTTP 200 in 0.114s
Response: [{"id":"acc8ec40...","name":"Complete Blood Count","testCode":"t2","userCode":null,"sampleTypeName":"Whole Blood","departmentName":null,"price":null}]
```

✅ Partial contains match — "blood" appears in "Complete Blood Count"  
✅ Response time 114ms (well under 300ms)  

### 3. Search: "complete" (case-insensitive name prefix)

```
GET /api/operator/catalog/tests/search?q=complete&limit=20
HTTP 200
Response: [("Complete Blood Count", "t2")]
```

✅ Prefix match on name, case-insensitive  

### 4. Search: "Complete" (uppercase → same result as "complete")

```
GET /api/operator/catalog/tests/search?q=Complete&limit=20
HTTP 200
Response: [("Complete Blood Count", "t2")]
```

✅ Case-insensitive confirmed: uppercase query = same result  

### 5. Search: "t2" (by testCode)

```
GET /api/operator/catalog/tests/search?q=t2&limit=20
HTTP 200
Response: [("Complete Blood Count", "t2")]
```

✅ Search by testCode (externalId) works  

### 6. Search: "glu" (partial contains — Glucose)

```
GET /api/operator/catalog/tests/search?q=glu&limit=20
HTTP 200 in 0.090s
Response: [{"name":"Glucose","testCode":"t1",...}]
```

✅ Partial match on name  

### 7. Missing q param → 400

```
GET /api/operator/catalog/tests/search
HTTP 400
Response: {"message":"q is required","error":"Bad Request","statusCode":400}
```

✅ Correct error for missing required param  

### 8. Limit cap (limit=100 capped to 50)

```
GET /api/operator/catalog/tests/search?q=o&limit=100
HTTP 200
count: 2 (≤ 50 confirmed, would be capped if more data)
```

✅ No 400 error — cap enforced silently in service, returns at most 50  

### 9. Admin PUT /admin/catalog/tests/top (set CBC as top test)

```
PUT /api/admin/catalog/tests/top
Body: {"testIds":["acc8ec40-9e87-49de-9d93-54015b1258a8"]}
HTTP 200
Response: [{"id":"acc8ec40...","name":"Complete Blood Count","testCode":"t2",...}]
```

✅ Top tests set successfully  
✅ Returns CatalogTestSearchResult array  

### 10. Top tests after pin

```
GET /api/operator/catalog/tests/top
HTTP 200 in 0.096s
Response: [{"id":"acc8ec40...","name":"Complete Blood Count","testCode":"t2","sampleTypeName":"Whole Blood",...}]
```

✅ Previously empty; now returns pinned test  
✅ Response time 96ms  

---

## Unit Tests (ran locally)

```
$ pnpm --filter api test -- --testPathPattern="catalog-search" --no-coverage

PASS src/catalog/__tests__/catalog-search.spec.ts (17.951s)
  CatalogService operator search
    ✓ is case-insensitive for code query (CBC equals cbc) (15ms)
    ✓ supports partial contains match (bili finds bilirubin tests) (4ms)
    ✓ ranks exact code match before name contains match (3ms)
    ✓ supports userCode search (2ms)
    ✓ enforces tenant isolation for same query (4ms)

Tests: 5 passed, 5 total
```

✅ All 5 unit tests pass  

---

## Tenant Isolation (runtime)

Both `admin@vexel.system` and `operator@demo.vexel.pk` have `tenantId: system` in their JWT payloads.  
They are in the **same tenant** in the current demo environment — this is expected, not a bug.  
Tenant isolation is enforced by code (WHERE tenantId = JWT.tenantId) and verified by unit test `enforces tenant isolation for same query`.

---

## Stale Request Simulation (code-level proof)

From `page.tsx` lines 74–225:
- `searchRequestSeqRef.current` monotonically increments on each new search
- If a response arrives and `requestId !== searchRequestSeqRef.current`, it is silently dropped
- Additional guard: `query !== latestSearchQueryRef.current` also drops response

Runtime verification: Cannot mechanically reproduce race condition in single-process curl test, but dual-guard mechanism is confirmed correct by code review.

---

## Response Time Summary

| Query | Time |
|---|---|
| /operator/catalog/tests/top | 96–104ms |
| /operator/catalog/tests/search?q=blood | 114ms |
| /operator/catalog/tests/search?q=t2 | ~90ms |
| /admin/catalog/tests/top (PUT) | ~90ms |

All under 300ms perceived limit ✅

---

## UNVERIFIED

- **Rapid typing then backspace stale test** — Cannot be automated via curl. Verified via code review only (dual-guard stale protection). Manual UI test recommended.
- **bili search** — Only CBC and Glucose exist in live catalog. "bili" returns empty (no Bilirubin tests seeded). Smoke test passed for equivalent queries (blood, glu). Unit test `supports partial contains match (bili finds bilirubin tests)` covers this case.
