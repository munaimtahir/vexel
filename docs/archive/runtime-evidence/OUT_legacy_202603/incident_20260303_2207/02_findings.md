# Findings

## 1) Tenant resolution (production host)
- `tenant_domains` already contains `vexel.alshifalab.pk -> system`.
- Verified by authenticated API probe returning records with `tenantId=system`.
- Evidence: `05_commands.log` sections `STEP 1 TENANT DOMAIN CHECK` and `STEP 1 TENANT RESOLUTION PROBE`.

## 2) Operator guard / OPD access logic
- No `module.operator` guard string found in operator source.
- OPD is not in FUTURE modules list in current source.
- Sidebar OPD gating logic uses `isSuperAdmin || module.opd` and a loading state path.
- Topbar identity was token-decoded; changed to server-derived `useCurrentUser()` to align governance.

## 3) Feature flags initial-load behavior
- Flags are loaded from server endpoint and now include deterministic default for `module.opd` in hook.
- `/api/feature-flags/resolved` returns stable data in production response.

## 4) Catalog visibility
- Production catalog API currently returns:
  - tests: 2
  - parameters: 0
  - panels: 0
- DB checks match sparse catalog state for this tenant.
- Conclusion: this environment is not carrying the expected 84-test dataset; UI emptiness is at least partly data-state, not only frontend rendering.

## 5) Import engine parse error class
- Reproduced import endpoint behavior; responses are JSON (including errors).
- Added/verified clear JSON error for missing file upload.
- `Unexpected token <` class is mitigated in current admin import flow via text-parse + content-type gate and API missing-file guard.

## 6) Deployment drift
- Changes were committed and deployed.
- New images and containers confirmed running:
  - `vexel-api:latest` image `ff2e0d2aae39`
  - `vexel-operator:latest` image `4c5565c8f695`
