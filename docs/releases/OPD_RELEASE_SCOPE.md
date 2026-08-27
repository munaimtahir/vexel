# OPD Release Scope

**Status: NOT READY**

This document is the authoritative release scope for OPD.

All prior release-readiness documents that deferred OPD functionality,
or that validated only LIMS/platform functionality, are historical-only
and are invalid as OPD production-release evidence.

OPD release status remains NOT READY until every requirement in this
scope has documented passing verification evidence.

## Supersession

The previous platform release scope and readiness claim are superseded for OPD release purposes:

```text
Previous release scope: SUPERSEDED FOR OPD RELEASE PURPOSES
Previous OPD readiness status: NOT RELEASED / NOT VERIFIED
Current OPD release scope: AUTHORITATIVE
```

The earlier release was a LIMS/platform release and explicitly deferred OPD completion. It must not be cited as approval, inherited readiness, or production evidence for OPD.

## Authoritative included scope

The OPD release is a complete, tenant-specific production module covering:

1. One canonical OPD domain model and workflow, with competing runtime paths retired through safe additive migration and reconciliation.
2. Tenant-specific enablement, subfeature flags, clinic identity, branding, timezone, currency, numbering, pricing, tax/discount policy, templates, clinicians, and audited configuration.
3. Patient search/registration, walk-ins, encounter creation, validated intake/vitals, queue, consultation, draft and immutable signed notes, draft and published prescriptions, history, completion, cancellation, and governed amendments.
4. Scheduling and queue behavior only if retained by the canonical model; otherwise incomplete scheduling paths must be removed from active product surfaces and the boundary documented.
5. Server-side RBAC, clinician ownership, tenant isolation, immutable signed records, and audited amendments.
6. Transactional invoice issue, partial/concurrent-safe payments, references/methods, void/correction/refund commands, balances, and financial audit.
7. Deterministic prescription and receipt documents with canonical payload hashes, PDF hashes, tenant-scoped identity, async rendering, retries, failure visibility, and secure retrieval.
8. Complete Admin configuration/observability and Operator workflow surfaces, including disabled-feature, conflict, permission, validation, loading, empty, retry, and inaccessible-document states.
9. Passing contract, SDK, lint, typecheck, build, API, SDK, OPD unit/integration, tenant-security, RBAC/ownership, idempotency/concurrency, billing, document, worker/PDF, browser E2E, migration, smoke, rollback, and deployment checks.

## Evidence policy

Only OPD-specific implementation and verification artifacts created for this release may support a `READY` decision. Historical artifacts listed below remain useful context but are excluded from OPD readiness evidence.

### Historical-only and excluded from OPD readiness evidence

- `docs/_audit/FINAL_VERDICT_2026_05_27/GO_NO_GO_VERDICT.md`
- `docs/_audit/MVP_RELEASE_GATE_AUDIT.md`
- `docs/_audit/20260527_203959_vexel_full_audit/`
- `docs/_audit/POST_PROD_UI_VERIFICATION.md`
- `docs/_audit/opd/FINAL_OPD_SLICE_VERDICT.md`
- `docs/_audit/opd/09_runtime_verification.md`
- `docs/_audit/OPD_COVERAGE_AUDIT_2026-02-26.md`
- `docs/_audit/BASELINE_CONTEXT_2026-03-02.md`

These documents may describe historical LIMS/platform verification or an earlier OPD slice, but none establishes OPD production readiness.

## Release decision rule

The only permitted outcomes are `READY` or `NOT READY`. Until every scope item and gate has passing, current evidence, the decision is `NOT READY`.
