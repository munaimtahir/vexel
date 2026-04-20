# Feature Status Matrix

| Area | Expected | Actual | Status | Evidence | Notes |
|---|---|---|---|---|---|
| Monorepo structure | Multi-app + contracts + SDK | Present and coherent | Implemented | `apps/*`, `packages/*`, `pnpm-workspace.yaml` | Good structural alignment |
| Auth | JWT + refresh + RBAC | Implemented in API + frontend login flows | Implemented | `apps/api/src/auth/*`, `apps/operator/src/app/(public)/login/*`, `apps/admin/src/app/(public)/login/*` | Runtime not re-validated in this pass |
| Tenancy | Strict tenant context + scoped queries | Middleware + tenant fields + scoped services | Partial | `apps/api/src/tenancy/*`, `schema.prisma` | Needs runtime leakage re-test in this pass |
| Feature flags | Backend-authoritative, tenant-scoped | Services and endpoints exist | Partial | `apps/api/src/feature-flags/*`, `docs/FEATURE_FLAGS.md` | Coverage depth not fully verified |
| Audit logging | Commands/admin changes audited | Audit module exists, used in services | Partial | `apps/api/src/audit/*`, workflow services | End-to-end completeness unverified |
| Patients | CRUD + workflow participation | Implemented in API and operator flows | Implemented | `apps/api/src/patients/*`, operator registration routes | Runtime unverified |
| Billing/OPD | OPD command model + docs | Significant OPD scaffolding + endpoints | Partial | `apps/api/src/opd/*`, admin OPD pages | Not fully hardened |
| Documents registry | Deterministic/idempotent docs | Schema + service + worker pipeline present | Partial | `schema.prisma`, `apps/api/src/documents/*`, `apps/worker/src/document-render.processor.ts` | PDF fallback weakens strictness |
| LIMS catalog | Parameters/tests/panels mappings | Implemented APIs + admin screens | Implemented | `apps/api/src/catalog/*`, `apps/admin/src/app/(protected)/catalog/*` | |
| Order workflow | Command-driven transitions | Command endpoints and guards present | Implemented | `encounters controller/service`, OpenAPI commands | |
| Result entry | Enter + submit logic | APIs + operator result pages exist | Partial | `apps/api/src/results/*`, operator `/lims/results/*` | Full runtime E2E not rerun now |
| Verification | Verify commands + queue | APIs + operator verification pages exist | Partial | `apps/api/src/verification/*`, operator verification routes | Runtime validation pending |
| Publish | Command/auto publish model | Worker auto-publish + documents service publish checks | Partial | worker processor + documents service | Confirm strict gating in live runtime |
| PDF service | Real render endpoint deterministic templates | Real service exists with placeholder fallback | Drifted | `apps/pdf/Program.cs` | Fallback path is architectural risk |
| SDK/contract discipline | OpenAPI authoritative + SDK-only | Strong CI enforcement + generated SDK usage | Implemented | `.github/workflows/ci.yml`, `packages/contracts/*`, frontend api-client files | Strong area |
| Tests | Unit/integration/E2E + governance gates | API tests pass; E2E exists; local runtime tests not rerun | Partial | API test run output, `apps/e2e` inventory | Runtime confidence reduced |
| CI/CD | Quality gates + checks | CI configured with key gates | Implemented | `.github/workflows/ci.yml` | Good baseline |
