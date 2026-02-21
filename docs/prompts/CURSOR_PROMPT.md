# Cursor Prompt — LIMS Rebuild (Structure Lock + Admin App First)

ROLE
You are the single AI dev agent. You must design and LOCK structure before coding.

CONTEXT
We are rebuilding a multi-tenant health platform. LIMS is the first module. We will add OPD/RIMS later using the same core modules.
We will build a SEPARATE Admin App first (Back Office), then build vertical slices end-to-end.

NON‑NEGOTIABLE RULES
- Contract-first OpenAPI is the law (packages/contracts/openapi.yaml).
- Frontends (operator + admin) MUST use generated SDK only.
- Strict tenant isolation on every domain entity and query.
- Workflow transitions ONLY via Command endpoints (no status edits).
- Deterministic documents: payloadHash + pdfHash + idempotent publish.
- Feature flags: backend-authoritative, tenant-scoped.
- Audit everything: commands + admin changes.
- No legacy compatibility logic.

TASK
1) Create/confirm monorepo structure:
   - apps/api (NestJS)
   - apps/worker (BullMQ)
   - apps/pdf (.NET QuestPDF)
   - apps/operator (React+Vite)
   - apps/admin (React+Vite)
   - packages/contracts (openapi.yaml + generator)
   - packages/sdk (generated client)
2) LOCK the core data model (Prisma) for:
   - Tenant (domains, status)
   - Users/Roles/Permissions
   - Feature Flags (TenantFeature)
   - Patient
   - Encounter (moduleType)
   - LIMS: LabOrder, LabOrderItem, Specimen, Result, Verification
   - Documents (Document, storage backend fields, hashes)
   - AuditEvent
3) LOCK the API surface (OpenAPI) for Admin MVP:
   - Tenants CRUD (config only)
   - Users CRUD (config only)
   - Feature flags (get/set)
   - Catalog CRUD
   - Audit list
   - Job dashboard (read-only)
   - Health endpoints
4) LOCK the UI routes for Admin App MVP:
   - /admin/login
   - /admin/dashboard
   - /admin/tenants
   - /admin/users
   - /admin/feature-flags
   - /admin/catalog
   - /admin/audit
   - /admin/jobs
5) LOCK governance enforcement points:
   - tenant resolver middleware/guard
   - command-only workflow endpoints
   - SDK-only rule in frontends
   - audit + correlationId injection

OUTPUT REQUIRED
- A single “STRUCTURE_LOCK.md” describing:
  - monorepo folders
  - DB schema tables + key constraints
  - OpenAPI endpoints list
  - Admin routes list
  - Feature flag keys (module.lims etc.)
  - Document pipeline summary

DO NOT IMPLEMENT FULL FEATURES YET.
Only create scaffolds + locked structure + placeholder handlers so the next stage can bring up Docker and run smoke tests.

TODO CHECKLIST (must include at end)
- [ ] Monorepo layout created
- [ ] Prisma schema locked (tables + tenant scoping)
- [ ] OpenAPI locked for Admin MVP
- [ ] SDK generation wired
- [ ] Admin routes scaffolded
- [ ] Tenant resolver + audit middleware stubbed
- [ ] Docker compose boots API/DB/Redis/Worker/PDF
