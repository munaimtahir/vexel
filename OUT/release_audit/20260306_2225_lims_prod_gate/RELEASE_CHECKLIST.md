# Release Checklist — LIMS Production Gate

## Critical Gates

| Gate | Result | Evidence |
|------|--------|----------|
| TypeScript compiles (api, admin, operator) | ✅ PASS | `tsc --noEmit` → 0 errors |
| Unit tests pass | ✅ PASS | 114/114, 19 suites |
| SDK matches OpenAPI | ✅ PASS | `sdk:generate` + `git diff` = no diff |
| No raw fetch/axios in frontends | ✅ PASS | grep confirms |
| No Prisma imports in Next.js | ✅ PASS | grep confirms |
| UI color lint | ✅ PASS | No hardcoded hex |
| Stack boots | ✅ PASS | 7 containers healthy |
| API health real | ✅ PASS | Uptime + version returned |
| LIMS workflow commands work | ✅ PASS | Live curl traces |
| 409 on invalid transition | ✅ PASS | Collect-specimen on published → 409 |
| Publish idempotency | ✅ PASS | Re-publish returns same document |
| Tenant isolation in schema | ✅ PASS | All models have tenantId |
| Tenant isolation in services | ✅ PASS | All queries filter by tenantId |
| Feature flags backend-authoritative | ✅ PASS | assertLimsEnabled per tenant |
| Refresh token rotation | ✅ PASS | Hash + revoke + rotate confirmed |
| Disabled user rejection | ✅ PASS | JWT strategy DB check per request |
| CorrelationId on all requests | ✅ PASS | Middleware mounted `{ path: '*' }` |
| Audit trail on commands | ✅ PASS | 139 audit.log call-sites |
| Document pipeline deterministic | ✅ PASS | canonical + sha256 + unique constraint |
| E2E Playwright tests | ❌ INFRA FAIL | Missing libatk system lib; cannot run locally |
| JWT_SECRET is production-strength | ❌ FAIL | CI test token in .env |
| NODE_ENV=production for API | ❌ FAIL | development set; Swagger exposed |
| Worker health check is real | ❌ FAIL | Stub; always returns ok |
| PDF health check is real | ❌ FAIL | Stub; always returns ok |
| No hardcoded fallback secrets | ❌ FAIL | JWT + storage secrets in source code |
| Postgres password strong | ❌ FAIL | password: vexel |
| MinIO password strong | ❌ FAIL | vexel_secret_2026 in version control |
| VEXEL_ROOT env set for worker | ❌ FAIL | Defaults to personal dev path |
| Worker direct encounter mutation reviewed | ⚠️ ISSUE | Bypasses command-endpoint pattern |

## Summary

- **Passed:** 20/28
- **Failed:** 7/28 (config/security gates)
- **Issue (arch):** 1
- **Overall gate: NO-GO**
