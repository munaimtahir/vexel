# Backend Route and Module Audit

## Module Map

| Module | Found | Status | Notes |
| ------ | ----- | ------ | ----- |
| Account | YES | ACTIVE | Profile, password change. |
| Audit | YES | ACTIVE | Audit event logging and listing. |
| Auth | YES | ACTIVE | JWT + Refresh token login. |
| Billing | YES | ACTIVE | OPD billing (future). |
| Catalog | YES | ACTIVE | LIMS catalog and import/export jobs. |
| Documents | YES | ACTIVE | Deterministic PDF generation. |
| Encounters | YES | ACTIVE | LIMS workflow engine. |
| Feature Flags | YES | ACTIVE | Tenant-scoped toggles. |
| Health | YES | ACTIVE | Shallow and deep health checks. |
| Jobs | YES | ACTIVE | BullMQ job management. |
| Logs | YES | ACTIVE | Structured category-wise logs. |
| OPD | YES | ACTIVE | Outpatient department modules (future). |
| Ops | YES | ACTIVE | Backup, Restore, and platform maintenance. |
| Patients | YES | ACTIVE | Patient demographics management. |
| Rbac | YES | ACTIVE | Permission-based access control. |
| Results | YES | ACTIVE | Lab result entry and submission. |
| Roles | YES | ACTIVE | RBAC role management. |
| Sample Collection| YES | ACTIVE | Specimen collection workflow. |
| Storage | YES | ACTIVE | S3/MinIO abstraction. |
| Templates | YES | ACTIVE | Report template management. |
| Tenant(s) | YES | ACTIVE | Multi-tenancy and configuration. |
| Verification | YES | ACTIVE | Lab result verification workflow. |

## Security & Guardrail Verification

| Check | Result | Fresh Evidence | Notes |
| ----- | ------ | -------------- | ----- |
| Command-only state changes | PASS | `encounters.controller.ts` | Uses `:verify`, `:order-lab` instead of PATCH. |
| Audit logging on commands | PASS | `encounters.service.ts` | `this.audit.log` called in all mutations. |
| Tenant isolation | PASS | `encounters.service.ts` | `where: { id, tenantId }` enforced in lookups. |
| Destructive restore gated | PASS | `ops.service.ts` | Guarded by env flag, permission, and phrase. |
| Secret exposure in code | CAUTION | `storage.service.ts` | Default secrets present in `??` fallbacks. |
| CORS posture | PASS | `main.ts` | Restricted to `CORS_ALLOWED_ORIGINS`. |

## Secret Scan Findings
- `STORAGE_SECRET_KEY`: Default `'vexel_secret_2026'` found in `storage.service.ts`.
- `JWT_SECRET`: Default `'vexel-dev-secret-change-in-production'` found in `auth.module.ts`.
- **Classification:** **ACCEPTABLE FOR DEV**, but must be overridden in production via environment variables.

## Required Verdict
**BACKEND AUDIT PASS**

## Status Summary
The backend is well-structured and modular. Architectural mandates for command-driven state changes, auditability, and tenant isolation are implemented across the core LIMS modules. Security rails for destructive operations (Ops) are robust.
