# Post-Audit Decision Register

This register tracks all locked decisions and confirms implementation status.

| Decision ID | Locked Decision Description | Implementation Status |
|---|---|---|
| 1 | Continue from current codebase. No reset. | Conformed. Working directly from HEAD. |
| 2 | MVP is single-tenant LIMS web platform only. | Scoped. Non-MVP mobile app filtered out. |
| 4 | Mobile app is non-MVP and must be excluded from gates. | Excluded. Added turbo filters and README disclaimer. |
| 8 | Add Jest and make SDK tests real. | Complete. SDK has Jest config and actual ts specs passing. |
| 13 | Build structured logs with frontend viewer. | Complete. Built categories logs + Admin UI page. |
| 15 | Investigate and fix ioredis mock constructor error. | Complete. Fixed Jest mock ES defaults in spec.ts. |
| 16 | Add deep health checks. | Complete. Built `/health/deep` endpoint checking all services. |
| 20 | Tenant-aware login resolves from Host/domain. | Complete. Refactored AuthService login and AuthController. |
| 21 | Refresh/logout must remain tenant-correct. | Complete. Refresh verifies active status; logout logs correct tenant. |
| 29 | Manual-trigger CI E2E smoke workflow. | Complete. Created dispatch-only manual-e2e.yml. |
