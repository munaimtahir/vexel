# Recommended Next Sequence (strict order)

1. **Truth-alignment bootstrap**
   - Bring local stack up (`docker compose up -d`), verify `/api/health` and `/pdf/health`, run `docs/ops/SMOKE_TESTS.md` checklist.

2. **Contract/runtime parity revalidation**
   - Re-run contract parity + SDK generation checks; confirm no drift between OpenAPI and deployed handlers.

3. **Tenancy + workflow integrity gate**
   - Execute targeted tests for tenant isolation and invalid transition rejection (`409`) on all command endpoints.

4. **Document determinism hardening**
   - Decide and enforce strict policy for placeholder fallback (remove, gate, or explicit failure contract).
   - Validate idempotent publish and hash reproducibility in runtime.

5. **Frontend reliability stabilization**
   - Resolve high-impact hook dependency warnings in operator/admin workflow pages.

6. **E2E + release gate pass**
   - Run full Playwright suite and capture evidence artifacts.

7. **Task truth source lock**
   - Establish a single authoritative status tracker (replace fragmented status narratives).

8. **Only then resume feature expansion**
   - Start new features after the above gates are green and recorded.
