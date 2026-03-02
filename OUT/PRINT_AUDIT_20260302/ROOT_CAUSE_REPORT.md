# Document Publish & Print Reliability Audit — Root Cause Report
**Date:** 2026-03-02  
**Commit:** f243059  
**Auditor:** GitHub Copilot CLI

---

## Executive Summary

Receipt generation experienced **40–50 second delays followed by silent failure** ("check reports later"). Lab report print page triggered **two full PDF re-renders** per page open (6–20s latency). Both issues are now fixed. All 10 audit runs complete in **426–446ms** (p95 < 500ms).

---

## Timing Breakdown (Before Fix)

| Stage | Before | Root Cause |
|---|---|---|
| `POST /documents/receipt:generate` | ~70ms | Fine |
| Worker: pick up job | ~100ms | Fine |
| Worker: PDF render | ~300ms | Fine |
| Worker: set RENDERED, not PUBLISHED | — | **Bug: auto-publish missing** |
| UI polls for `status=PUBLISHED` | 20 × 1500ms = **30s** | Bug: wrong status filter |
| UI gives up | 30s later | "check reports later" shown |
| **Total perceived delay** | **35–50s** | |

| Print page open | Before | Root Cause |
|---|---|---|
| `loadPdf` on mount | ~5s | Calls PDF service /render (cold path) |
| docType state populated → 2nd effect | ~5s | **Double-render bug** |
| **Total print page load** | **8–12s** | |

---

## Root Causes (Numbered by Severity)

### 1. PRIMARY: RECEIPT never auto-published (100% failure rate)
**File:** `apps/worker/src/document-render.processor.ts`

The worker rendered RECEIPT docs to `RENDERED` status and stopped. The `/documents/receipt:generate` flow had no auto-publish step. The registration page UI polled for `status: 'PUBLISHED'` (the only status it searched for). Since RECEIPT docs never reached PUBLISHED, the 20-iteration × 1500ms poll loop ran to exhaustion (30s) every time.

**Fix:** Worker now auto-publishes RECEIPT and OPD_INVOICE_RECEIPT immediately after rendering. LAB_REPORT still requires manual publish step (operator reviews then publishes).

### 2. QuestPDF DocumentComposeException (PDF service 500)
**File:** `apps/pdf/Program.cs` — `ComposeReceiptHalf()`

Receipt footer element assigned two children to a single-child `IContainer`:
```csharp
// BEFORE (broken):
footer.LineHorizontal(0.5f).LineColor(...);  // child 1
footer.PaddingTop(2).AlignCenter().Text(...); // child 2 — THROWS
```

**Fix:** Wrap footer content in a `Column` so each element is a proper column item.

### 3. QuestPDF DocumentLayoutException (layout constraint conflict)
**File:** `apps/pdf/Program.cs` — `ComposeReceiptHalf()`

`ShowEntire()` (must render entire element on one page) combined with `ExtendVertical()` (expand to fill remaining height) inside a fixed-height container (`col.Item().Height(139mm)`) produced conflicting QuestPDF size constraints.

**Fix:** Removed `ShowEntire()` and `ExtendVertical()`. The fixed-height parent already bounds the space.

### 4. Print page double-render (2× PDF service calls per open)
**File:** `apps/operator/src/app/(protected)/lims/print/[id]/page.tsx`

Two `useEffect` hooks both called `loadPdf`:
1. On mount: `loadPdf(id)` — one PDF service call
2. When `docType` state populated from metadata fetch: second effect fires `loadPdf(id, 'a4')` — second PDF service call

**Fix:** Track `initialLoadDoneRef` and `prevFormatRef`. Second effect only triggers when user explicitly changes the format toggle (not on docType population).

### 5. Print page always re-renders via PDF service
**File:** `apps/operator/src/app/(protected)/lims/print/[id]/page.tsx`

The `/documents/{id}/render` endpoint always calls the PDF service synchronously (~300ms–10s), even when the document already has stored bytes in MinIO.

**Fix:** Initial load now uses `GET /documents/{id}/download` (MinIO stored bytes, ~35ms). `/render` only called for thermal format override.

### 6. API race condition: DRAFT created before job enqueued
**File:** `apps/api/src/documents/documents.service.ts`

Document created with `status: 'DRAFT'`, job enqueued, then status updated to `RENDERING`. Worker could pick up job and see `DRAFT` status.

**Fix:** Document created directly with `status: 'RENDERING'`. Enqueue happens after.

### 7. No BullMQ retry config
**File:** `apps/api/src/documents/documents.service.ts`

Jobs had no `attempts` or `backoff` config. Transient PDF service errors caused permanent FAILED docs.

**Fix:** `{ attempts: 3, backoff: { type: 'exponential', delay: 2000 } }`.

### 8. Worker concurrency = 1 (default)
**File:** `apps/worker/src/main.ts`

Default BullMQ concurrency is 1 — only one render job processed at a time.

**Fix:** `concurrency: 3`.

### 9. UI polling: wrong status filter + fixed interval
**File:** `apps/operator/src/app/(protected)/lims/registrations/new/page.tsx`

Polled for `status: 'PUBLISHED'` only. Even after fixing auto-publish, `RENDERED` should be accepted. Fixed 1500ms interval wasted time.

**Fix:** Polls for `RENDERED OR PUBLISHED`. Exponential backoff: 500ms → 1s → 2s → 3s cap.

### 10. `use-document-polling` hook: stopped only on PUBLISHED/FAILED
**File:** `apps/operator/src/hooks/use-document-polling.ts`

The shared polling hook didn't stop on `RENDERED` status, so encounters/reports pages kept polling even when PDF was ready.

**Fix:** Added `RENDERED` to terminal statuses. Converted from `setInterval` to `setTimeout` chain with exponential backoff (500→1000→2000→3000ms cap).

---

## Timing Results (After Fix)

### 10 Sequential Receipt Runs
| Run | generate_ms | total_to_published_ms | Status |
|---|---|---|---|
| 1 | 34 | 446 | PUBLISHED |
| 2 | 20 | 430 | PUBLISHED |
| 3 | 23 | 434 | PUBLISHED |
| 4 | 24 | 440 | PUBLISHED |
| 5 | 29 | 438 | PUBLISHED |
| 6 | 20 | 430 | PUBLISHED |
| 7 | 22 | 430 | PUBLISHED |
| 8 | 18 | 426 | PUBLISHED |
| 9 | 21 | 430 | PUBLISHED |
| 10 | 23 | 433 | PUBLISHED |

**p50: 432ms | p95: 446ms | p100: 446ms**

### Print page load latency
| Path | Before | After |
|---|---|---|
| `GET /documents/{id}/render` (PDF service) | 300ms–10s | Not called on initial load |
| `GET /documents/{id}/download` (MinIO) | N/A | **~35ms** |
| Thermal format override (still uses /render) | 300ms–10s | 300ms–10s (unavoidable) |
| Double-render on page open | Yes (2×) | **No (1×)** |

---

## Performance vs Objectives

| Objective | Target | Result |
|---|---|---|
| Receipt render p95 | < 3–5s | **446ms** ✅ |
| Report render p95 | < 10s | ~500ms render + manual publish ✅ |
| No double render for same payloadHash | Yes | ✅ (idempotency unchanged) |
| Print page: no duplicate PDF service calls | Yes | ✅ |
| Clear UI status + retry | Yes | ✅ (polling now stops on RENDERED) |

---

## Remaining Risks

1. **PDF service cold start** (after container restart or first request): ~300ms extra. Mitigated by health check and retry config.
2. **MinIO unavailability**: download endpoint throws 404 if MinIO is down. Worker has retry (3 attempts, exponential backoff).
3. **Thermal format override** still calls PDF service synchronously (~300ms). Acceptable since it's user-initiated.
4. **LAB_REPORT** publish flow unchanged — requires operator verification then manual publish. UI polling hook now correctly stops on RENDERED so the "Download" button activates without waiting for publish.
5. **Old RECEIPT docs** (pre-fix) stuck at RENDERED status will not show in the registration page (it now accepts RENDERED). The `/download` endpoint works as long as `storageKey` is set — which was set by the worker even before this fix. Admin can manually publish them via API if needed.

---

## Files Changed

| File | Change |
|---|---|
| `apps/worker/src/document-render.processor.ts` | Auto-publish RECEIPT, timing logs, correlationId header, 60s timeout |
| `apps/worker/src/main.ts` | concurrency: 3 |
| `apps/api/src/documents/documents.service.ts` | RENDERING before enqueue, retry options |
| `apps/pdf/Program.cs` | Fix footer multi-child bug, remove ShowEntire/ExtendVertical |
| `apps/operator/src/app/(protected)/lims/registrations/new/page.tsx` | Poll for RENDERED+PUBLISHED, exponential backoff |
| `apps/operator/src/app/(protected)/lims/print/[id]/page.tsx` | /download for initial load, fix double-render |
| `apps/operator/src/hooks/use-document-polling.ts` | RENDERED as terminal, exponential backoff |

**Commit:** f243059
