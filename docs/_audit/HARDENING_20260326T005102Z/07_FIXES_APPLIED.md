# Fixes Applied

## PDF service
- `apps/pdf/Program.cs`
  - Removed placeholder fallback behavior from `/render` flow.
  - Added explicit 400/422 failure responses for invalid render requests.
  - Fixed compile errors introduced while hardening (`DocumentMetadata`, color typing, fluent API usage, lambda return semantics).

## E2E reliability fixes
- `apps/e2e/tests/01-auth.spec.ts`
  - Stabilized post-login route assertion to tolerate root landing before direct worklist navigation.
- `apps/e2e/tests/admin/03-users-roles.spec.ts`
  - Reworked login helper to avoid detached-click race and await deterministic post-login route.
- `apps/e2e/tests/admin/06-audit-explorer.spec.ts`
  - Same login-helper stabilization.
- `apps/e2e/tests/admin/07-jobs-failures.spec.ts`
  - Same login-helper stabilization.
  - Replaced brittle content detection assertion with stable heading/widget visibility invariants.
