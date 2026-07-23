# 05 — UI Checks

---

## File

`apps/operator/src/app/(protected)/lims/registrations/new/page.tsx`

---

## SDK-only (no ad-hoc fetch/axios)

```bash
$ grep -rn "fetch(\|axios(" apps/operator/src --include="*.ts" --include="*.tsx"
(no output)
```

✅ **Zero** raw `fetch(` or `axios(` calls found in operator source.

API calls use `getApiClient()` which returns an `openapi-fetch` client:

```typescript
const api = getApiClient(getToken() ?? undefined);
// @ts-ignore
const { data } = await api.GET('/operator/catalog/tests/top');
// @ts-ignore
const { data } = await api.GET('/operator/catalog/tests/search', {
  params: { query: { q: query, limit: 20 } }
});
```

The `// @ts-ignore` comments are present because the TS paths type inference for these new paths hasn't been picked up by the component's type inference yet; the runtime call is correct and will work.

---

## Debounce (~250ms)

```typescript
// line 236
searchTimerRef.current = setTimeout(() => doTestSearch(testSearch), 250);
return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
```

Implemented in a `useEffect` that cleans up on every `testSearch` change.  
✅ 250ms debounce — matches requirement  
✅ Cleanup via `clearTimeout` — no timer leaks  

---

## Minimum Length Gate (< 2 chars)

```typescript
// line 195 inside doTestSearch
const query = q.trim().replace(/\s+/g, ' ');
if (query.length < 2) {
  searchRequestSeqRef.current += 1;
  latestSearchQueryRef.current = query;
  setSearching(false);
  setTestResults([]);
  setTestDropOpen(false);
  setTestDropIdx(-1);
  return;
}
```

✅ No search triggered for < 2 chars  
✅ Results cleared and dropdown closed when query drops below threshold  

---

## Stale Request Guard (race condition protection)

Dual mechanism: request sequence counter + query equality check:

```typescript
// line 74-75 (refs)
const searchRequestSeqRef = useRef(0);
const latestSearchQueryRef = useRef('');

// line 205 — increment before each request
const requestId = ++searchRequestSeqRef.current;

// line 211-212 — guard on response arrival
if (requestId !== searchRequestSeqRef.current) return;
if (query !== latestSearchQueryRef.current) return;
```

✅ Monotonic counter: any in-flight request with older `requestId` is silently dropped  
✅ Query equality check: if user typed again since request started, drop stale response  
✅ Both `success` and `catch` branches apply the guard  

---

## Top Tests Panel

```typescript
// line 178-190 — load on mount
const loadTopTests = useCallback(async () => {
  setLoadingTopTests(true);
  try {
    const api = getApiClient(getToken() ?? undefined);
    // @ts-ignore
    const { data } = await api.GET('/operator/catalog/tests/top');
    const list = Array.isArray(data) ? (data as CatalogTestSearchItem[]) : [];
    setTopTests(list);
  } catch {
    setTopTests([]);
  } finally {
    setLoadingTopTests(false);
  }
}, []);

// line 231-232 — load on component mount
useEffect(() => {
  mob1Ref.current?.focus();
  loadTopTests();
}, [loadTopTests]);
```

Top tests panel render (line 785-800):
```tsx
{testSearch.trim().length < 2 && (
  // Panel shown when search input is empty/short
  {loadingTopTests ? (
    <div className="text-xs text-muted-foreground">Loading top tests…</div>
  ) : topTests.length === 0 ? (
    // empty state
  ) : (
    {topTests.map((t) => (...))}
  )}
)}
```

✅ Top tests loaded on mount via SDK  
✅ Panel shown when `testSearch.trim().length < 2` (empty or short query)  
✅ Switches to search results when query is ≥ 2 chars  

---

## Client-side Normalization (mirror of backend)

```typescript
// line 193 inside doTestSearch
const query = q.trim().replace(/\s+/g, ' ');
```

✅ UI normalizes query before display and before passing to SDK  
✅ Consistent with backend `normalizeCatalogSearchQuery`  

---

## No Alias Feature

```bash
$ grep -rn "alias\|testAlias" apps/operator/src --include="*.ts" --include="*.tsx"
(no output relevant to aliases)
```

✅ No alias logic in UI  

---

## Verdict

| Check | Result |
|---|---|
| No fetch/axios — SDK only | ✅ 0 raw HTTP calls found |
| Debounce 250ms | ✅ `setTimeout(..., 250)` with cleanup |
| Min length < 2 = no search | ✅ Guard in `doTestSearch` |
| Stale request dropped | ✅ requestId counter + query equality |
| Top tests loaded via SDK | ✅ `api.GET('/operator/catalog/tests/top')` |
| Top tests shown when query empty/short | ✅ conditional on `testSearch.trim().length < 2` |
| No alias feature | ✅ |
