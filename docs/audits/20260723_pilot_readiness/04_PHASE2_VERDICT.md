# Phase 2 Verdict — Complete Patient-Cycle Live Verification

**Date:** 2026-07-27
**Gate:** Quality Gate 2, `02_PILOT_READINESS_PLAN.md`
**Result:** ✅ PASS

## What was verified live (not just code review)

All against the running Docker Compose stack (API `127.0.0.1:9021`, Admin `127.0.0.1:9023`, Operator `127.0.0.1:9024`) using real browser sessions (Playwright MCP) plus direct DB/API checks — not simulated.

1. **Patient registration** — new patient created via Operator UI, MRN assigned, appears in list. ✅
2. **Order tests** — test/panel selection against live catalog; pricing confirmed correct at order time. ✅
3. **Receipt generation at registration** — root-caused and fixed a real bug: the registration page built its own RECEIPT payload client-side and never sent `discount`/`amountPaid`/`dueAmount` to the API, so every receipt showed `Paid == Total` regardless of actual payment. Fixed in `apps/operator/.../registrations/new/page.tsx`; verified via a fresh patient (MRN PT-26-0634) with discount 100 / paid 400 on a PKR 700 order — DB payload and printed PDF both show `subtotal:700, discount:100, grandTotal:600, amountPaid:400, dueAmount:200` correctly. Commit `ae9f1a0`.
4. **Specimen collection** — collect + receive flow exercised live. ✅
5. **Sample worklist** — newly collected specimens appear correctly on current data. ✅
6. **Result entry — late-entry lock (both halves)** — root-caused and fixed a real gap: `submitResults()` in `results.service.ts` never set `locked: true` on submitted `LabResult` rows (only the separate, unused `submitAndVerify()` did), so submitted fields stayed fully editable. Fixed to lock filled parameters on submit while leaving empty parameters editable. Fixing this exposed a second bug: `returnForCorrection()` in `verification.service.ts` reset order status to `PENDING` but never unlocked the rows, which would have permanently frozen corrected fields — fixed in the same pass (unlocks unverified rows on return-for-correction). Verified end-to-end with a fresh patient (MRN PT-26-0635): filled 2/24 CBC parameters, submitted, confirmed `locked=true` + 🔒 badge in UI + other 22 fields still editable; then verifier returned it for correction and confirmed `locked=false`, `resultStatus=PENDING`. Commits `6c64abe`.
7. **Verification** — both the happy path (verify → publish) and the return-for-correction path exercised live and confirmed correct.
8. **Publish + generate report** — document reaches `PUBLISHED`, idempotent regeneration confirmed (same document ID / `created:false` on re-trigger).
9. **Printable PDF** — rendered lab report and receipt visually confirmed print-ready (headers, parameter tables, reference ranges, financial lines).
10. **Tenant isolation sanity check** — confirmed via the `@tenancy` e2e suite (4/4 passing): spoofed-tenant-header access blocked on encounters, patients, and encounter lists (403/404), no cross-tenant leakage.

Additional fix found and closed during this pass (not in the original 10-step list but affecting daily operator use): the Worklist dashboard was calling `/verification/encounters/pending` unconditionally, producing a console 403 for any operator lacking `result.verify`. Fixed by permission-gating the fetch on `useCurrentUser().permissions`. Commit `a818183`.

## Full `apps/e2e` suite

Run once against the live stack per the agreed approach (not per-phase).

- **First run:** 121 tests — 78 passed, 40 failed, 3 skipped.
- **Root cause of all 40 admin-project failures:** the `admin` Docker image was still built with `NEXT_PUBLIC_API_URL=https://vexel.alshifalab.pk` (the production default) from a stale 2026-07-24 build, so every admin API call hit `ERR_SSL_PROTOCOL_ERROR` from this host and login never completed. The `operator` image had already been correctly rebuilt with `http://127.0.0.1:9021`. Fixed by rebuilding and redeploying `admin` with the local API URL; verified live that admin login now redirects to `/admin/dashboard` correctly.
- **Remaining operator-project failures were stale test selectors**, not product bugs — leftover from before routes were namespaced under `/lims/*` (e.g. tests hitting `/patients/new`, `/encounters/{id}/results`) or outdated placeholder/button text. Fixed in `03-operator-patient.spec.ts`, `05-operator-workflow.spec.ts`, `06-document-pipeline.spec.ts`, `08-verification-badge-refetch.spec.ts` by updating paths/selectors to match the current, correct UI — confirmed each match against the live DOM before editing.
- **Second run (after both fixes): 121 tests — 118 passed, 0 failed, 3 skipped** (3 skips are intentional `test.skip` — an admin-only backend-only tenant-creation case with no UI form, and a conditionally-skipped PDF-render-failure-injection pair). ✅ Green.

## Other gate items

- `pnpm --filter @vexel/api test`: 30 suites / 222 tests, all passed.
- `npx tsc --noEmit`: clean in `apps/api`, `apps/admin`, `apps/operator`.
- `npx next lint`: no errors in `apps/admin` or `apps/operator` (pre-existing `react-hooks/exhaustive-deps` warnings only, not blocking).
- Stale "tested on production" claim in `docs/_implementation/20260529_0300_feature_flags_logs_runtime_proof/01_SUMMARY.md` corrected to accurately describe local-stack testing.

## Conclusion

Every step of the complete LIMS patient cycle — registration through printable report — has been verified working live on the running stack, with three real defects found and fixed (receipt financials, late-entry lock, worklist 403) rather than assumed correct from code review. The full e2e suite is green. Quality Gate 2 passes.
