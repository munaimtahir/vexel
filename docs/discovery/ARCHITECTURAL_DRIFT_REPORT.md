# Architectural drift report

## Active violations

| ID | Locked rule | Active violation | Severity | Release effect |
|---|---|---|---|---|
| LIMS-P0-001 | Secure production deployment | Public known super-admin credentials, development mode, fixed/fallback secrets, public Swagger | P0 | Immediate release/security blocker |
| LIMS-P0-002 | Valid command workflow | Multi-test encounter verifies and reports with an unresulted order | P0 | Clinical integrity blocker |
| LIMS-P0-003 | Strict tenant isolation | Audit explorer allows optional/client tenant and unscoped query | P0 | Cross-tenant confidentiality blocker |
| LIMS-P0-004 | Mandatory auditability | Workflow mutation commits before required audit insert | P0 | Unlogged clinical/admin state possible |
| ARCH-P0-001 | Release quality/security | Production dependency audit fails with 2 critical and 75 high findings | P0 | Unaccepted supply-chain/runtime risk |
| OPD-P0-001 | Coherent command persistence | Prescription publish uses retired Prisma compound key and fails at runtime | P0 | Primary OPD workflow blocked |
| OPD-P0-002/003/006 | Contract first | Billing models/paths and appointment command paths disagree across layers | P0 for OPD | OPD finance/appointment commands broken |
| OPD-P0-004 | Least privilege | Seed reconciliation grants every OPD permission to operator, doctor and finance roles | P0 for OPD | Clinical/financial separation absent |
| ARCH-P1-003 | Observability/retry | Admin Jobs monitors nonexistent `jobs` queue, not actual worker queues, with no tenant-safe model | P1 | Failures invisible/misleading |
| ARCH-P1-004 | Producer/consumer contract | Storage-target test enqueues `{targetId}` while processor requires `{runId}` and has no handler | P1 | Reachable operation deterministically fails |
| LIMS-P1-007 | Deterministic documents | `canonicalJson` is type-collision-prone and not canonical JSON | P1 | Distinct payloads can hash identically |
| LIMS-P1-009 | Backend-authoritative flags | `module.lims` is not enforced across all LIMS route families | P1 | Disabled module remains operable |
| OPD-P1-004 | Backend-authoritative flags | OPD has duplicated/stale aliases and incomplete subfeature enforcement | P1 | Tenant configuration is not authoritative |
| ARCH-P1-005 | No legacy compatibility | Active catalog/result fallback fields and duplicated legacy Admin-permission policy remain | P1 | Two authorities and obsolete data model persist |
| ARCH-P1-006 | Command-only workflow | Deprecated LIMS receive/verify commands still have production consumers beside canonical commands | P1 | Transition semantics can diverge |
| ARCH-P2-001 | UI shell governance | Operator login duplicates public shell; `PublicShell` is unused | P2 | Governance inconsistency |
| ARCH-P2-002 | Route integrity | Admin OPD nav exposes nonexistent `/opd/providers` and `/opd/schedules` | P2 | Reachable 404s |

## Feature-flag reconciliation

The registry is tenant-scoped and resolved server-side, but its metadata is stale: OPD appointments, scheduling, vitals, notes, billing, and receipts are marked planned while backend code exists; `module.rad` and `module.ipd` say implemented/scaffold despite no modules. Deprecated LIMS flags remain in DB/default resolution. Current `system` enables `module.opd` and most OPD subfeatures, so the broken OPD surfaces are not merely dormant.

## Database ownership reconciliation

Core/global models: `Tenant`, `TemplateBlueprint`, `WorkerHeartbeat`. Shared/tenant-owned: users/roles/features, Patient, Encounter, Invoice/Payment, Document/Template, audit/jobs/ops. LIMS-owned: catalog, lab order/specimen/result/cash and mappings. OPD-owned: doctor/schedule/appointment/encounter/vital/note/prescription/settings/command log. Junction/child models without their own `tenantId` (refresh tokens, role permissions, user roles, ops schedule targets) inherit ownership through parents; service invariants must be tested because the DB cannot express every same-tenant relation.

## Quality/security drift

The dependency audit is not part of CI. Active findings include `xlsx@0.18.5` prototype-pollution/ReDoS in Admin import/export, vulnerable `tar@6.2.1` through API bcrypt installation, and vulnerable PostCSS/nanoid paths in Admin/Operator. Mobile accounts for many additional findings but is outside release. Triage must distinguish build-time from remotely reachable paths, but a production release cannot simply ignore the failing gate.
