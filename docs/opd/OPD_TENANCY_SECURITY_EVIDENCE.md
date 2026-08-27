# OPD Tenancy and Security Evidence

**Decision:** `NOT READY` — evidence collection is incomplete.

## Required controls

- Tenant resolution is server-side; development overrides are limited to the approved mechanism.
- Every OPD read, relation traversal, mutation, command, job, document, download, export, and audit query includes tenant scope.
- Clinician identity and encounter ownership are checked server-side, not trusted from the client.
- Permissions are least-privilege and database-backed for registration, intake, clinician, cashier, tenant admin, auditor, and document access.
- Disabled tenants are denied by backend feature checks, regardless of UI visibility.
- Cross-tenant identifiers must return safe not-found/forbidden behavior without data inference.

## Current baseline observations

The command controller resolves tenant context and the service includes tenant filters in observed lookups, but a complete automated cross-tenant proof for all OPD entities, documents, jobs, and relation traversals is not present in current release evidence. Existing controller permissions are broad and clinician ownership proof is incomplete.

## Required proof before READY

1. Tenant A/B API and database isolation tests.
2. Document and worker tenant isolation tests.
3. Disabled-feature API and browser tests.
4. Role matrix tests for every clinical, financial, administrative, and document command.
5. Clinician ownership allow/deny tests.
6. Audit and correlation-ID assertions for commands/configuration.
