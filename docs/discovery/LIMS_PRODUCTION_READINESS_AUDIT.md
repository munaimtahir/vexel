# LIMS production-readiness audit

## Authoritative verdict

```text
LIMS RELEASE STATUS

NOT READY
```

The current stack is runnable and the single-test happy path works, but it is not safe for a real production tenant. Independent blockers exist in deployment security, clinical aggregate state, tenant isolation, audit atomicity, and dependency security.

## A. Proven production-capable foundations

- Current OpenAPI regenerates the SDK without drift; inspected Admin/Operator LIMS code uses the SDK client.
- All services start and report healthy; Caddy and the public hostname currently route successfully.
- Host-scoped login, one-hour access tokens, DB-hashed seven-day refresh tokens, rotation, logout revocation, live permission loading, and spoofed-tenant-header blocking execute successfully.
- Patient/encounter/catalog/document LIMS models are structurally tenant-owned in inspected schema/service paths.
- A single test can be ordered, collected, resulted, verified, rendered through BullMQ/PDF/MinIO, and downloaded.
- Invalid classic transitions return 409 in current E2E.
- Observed document jobs preserve tenant and correlation IDs and persist payload/pdf hashes.
- Current lint, typecheck, build, API tests, SDK tests, and happy-path E2E pass.

## B. Implemented but insufficiently verified

- Sample receipt and separate-receive feature behavior.
- Manual publication from the primary verification journey.
- Failure/retry behavior for PDF rendering; both browser tests are skipped.
- Immutable document history after corrections/amendments.
- Cross-tenant isolation for documents, results, catalog, users, jobs, and audit using two real tenants.
- Fresh-host production bootstrap, secret injection, rollback, and destructive restore acceptance.

## C. Partially implemented

- Multi-order workflow: UI/order persistence exists, but aggregate collection/result/verification semantics are incorrect.
- Two overlapping receive and verify command families remain active.
- `module.lims` gates only some backend families.
- Jobs UI exists but observes a queue no producer or worker uses.
- Deterministic document hashing is repeatable for tested payloads but the serializer is collision-prone.

## D. Missing

- Transactional mutation plus mandatory AuditEvent/outbox boundary.
- Tenant-safe real-queue monitoring and audited retry.
- Release-grade two-tenant acceptance suite.
- Fail-closed production configuration with rotated external secrets and bootstrap credential policy.
- Dependency-vulnerability release gate.

## E/F. Critical and high-priority blockers

P0 and P1 details are in [`LIMS_RELEASE_GAP_LEDGER.md`](LIMS_RELEASE_GAP_LEDGER.md). Most consequential runtime proof: a passing multi-test E2E left encounter `115a2faf-1e2a-4f00-b293-6c7c926fd2f0` as `verified`; `t1` had one result while `t2` remained `ordered` with zero results. The report generator includes all orders, so incomplete content can become a clinical artifact.

## G. Non-blocking hardening

- Replace linear bcrypt scanning of all active refresh tokens with selector/family IDs and replay detection.
- Align document lifecycle with declared `QUEUED → RENDERING → RENDERED/FAILED` semantics.
- Eliminate React hook warnings and tracked transient test/build output.
- Migrate current consumers off deprecated commands and legacy catalog/result fields after data profiling.

## H. Shortest path to production

1. Rotate/revoke public credentials, JWT/DB/MinIO secrets and sessions; fail closed in production; restrict Swagger; review logs.
2. Triage and remediate the active critical/high dependency findings and add CI enforcement.
3. Force audit endpoints to authenticated tenant scope and add two real tenants/users/datasets.
4. Make all critical commands and AuditEvent persistence atomic.
5. Reconcile per-order/encounter state; block incomplete verification/reporting; replace the false-positive test.
6. Replace phantom job monitoring with real tenant-safe queues and prove failure → retry → render → publish → download.
7. Version/fix canonical JSON hashing and align verification/publication UX.
8. Centrally enforce `module.lims`, then run clean-host production acceptance, full two-tenant E2E with no release-critical skips, backup/restore proof, and operator/verifier UAT.

Full evidence is in [`_work/LIMS_AGENT_FINDINGS.md`](_work/LIMS_AGENT_FINDINGS.md).
