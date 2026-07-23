# Test Matrix — LIMS Production Gate Audit

## Unit Tests (API)
| Suite | Tests | Result | Evidence |
|-------|-------|--------|----------|
| API Unit Tests (19 suites) | 114 | ✅ PASS | `apps/api` `jest --passWithNoTests` → 114 passed, 0 failed |

## TypeScript Compilation
| App | Result | Evidence |
|-----|--------|----------|
| apps/api | ✅ PASS | `tsc --noEmit` exits 0 |
| apps/admin | ✅ PASS | `tsc --noEmit` exits 0 |
| apps/operator | ✅ PASS | `tsc --noEmit` exits 0 |

## SDK Freshness
| Check | Result | Evidence |
|-------|--------|----------|
| `pnpm sdk:generate` + `git diff` | ✅ PASS | No diff — SDK matches openapi.yaml |

## UI Color Lint
| Check | Result | Evidence |
|-------|--------|----------|
| `node scripts/ui-color-lint.mjs` | ✅ PASS | "no hard-coded hex or arbitrary hex Tailwind classes" |

## SDK-Only Enforcement (no raw fetch/axios)
| App | Result | Evidence |
|-----|--------|----------|
| apps/operator | ✅ PASS | grep finds no bare `fetch(` or `axios` imports |
| apps/admin | ✅ PASS | grep finds no bare `fetch(` or `axios` imports |

## No Prisma in Frontend
| App | Result | Evidence |
|-----|--------|----------|
| apps/operator | ✅ PASS | No `@prisma/client` imports |
| apps/admin | ✅ PASS | No `@prisma/client` imports |

## Live Smoke Tests (stack running)
| Test | Result | Evidence |
|------|--------|----------|
| `GET /api/health` | ✅ PASS | `{"status":"ok","version":"0.1.0"}` |
| `POST /api/auth/login` (operator) | ✅ PASS | Returns JWT + refresh token |
| `GET /api/patients?limit=3` | ✅ PASS | Returns paginated patient list |
| `GET /api/encounters?page=1&limit=3` | ✅ PASS | Returns LIMS encounters with patient |
| 409 invalid transition (collect-specimen on published) | ✅ PASS | `409 Conflict` |
| Publish idempotency (re-publish published encounter) | ✅ PASS | Returns same document, no duplicate |

## E2E / Playwright Tests
| Test | Result | Evidence |
|------|--------|----------|
| All @smoke tests (local environment) | ❌ INFRA FAIL | Missing system lib `libatk-1.0.so.0`; browser cannot launch |
| Historical CI evidence | UNVERIFIED | Previous session claims 25/25 pass; not reproduced in this audit run |

## Health Endpoints
| Endpoint | Result | Evidence |
|----------|--------|----------|
| `GET /api/health` | ✅ PASS (real) | Returns actual uptime |
| `GET /api/health/worker` | ❌ STUB | Always returns `ok`; has `// TODO: check Redis` comment |
| `GET /api/health/pdf` | ❌ STUB | Always returns `ok`; has `// TODO: proxy to PDF` comment |
| PDF service `GET /health/pdf` | ✅ PASS | `{"status":"ok","version":"1.0.0"}` |
