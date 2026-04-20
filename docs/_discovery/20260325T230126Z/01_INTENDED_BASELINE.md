# Intended Baseline (from docs)

## Governing baseline sources reviewed
- `README.md`
- `docs/specs/LOCKED_DECISIONS.md`
- `docs/specs/ARCHITECTURE.md`
- `docs/specs/TENANCY.md`
- `docs/specs/LIMS_WORKFLOWS.md`
- `docs/specs/DOCUMENTS_PDF.md`
- `docs/specs/TESTS.md`
- `docs/specs/ADMIN_APP_SPEC.md`
- `docs/specs/AUTH.md`
- `docs/FEATURE_FLAGS.md`
- `docs/specs/AGENT.md`
- `docs/STRUCTURE_LOCK.md`
- `docs/ops/SMOKE_TESTS.md`
- `docs/_audit/UI_QA_GATES.md`

## Intended architecture
- Monorepo with API (NestJS), worker (BullMQ), PDF service (.NET), Admin/Operator web apps (Next.js), contracts + generated SDK.
- API is single data authority; frontend must call API only through generated SDK.
- Global API prefix `/api`.

## Intended MVP modules
- LIMS end-to-end: patients, encounters, specimen collection/receive, result entry, verification, document generation/publish.
- Admin back-office for configuration/observability.
- OPD path reserved and governed for phased rollout.

## Intended workflow model
- Status transitions are command endpoints only.
- Invalid transitions return `409`.
- Commands produce audit events.

## Intended document engine
- Deterministic payload normalization with `payloadHash` and rendered-byte `pdfHash`.
- Idempotent publish and template-version-aware rendering.
- Lifecycle QUEUED -> RENDERING -> RENDERED/FAILED.

## Intended governance gates
- Contract-first OpenAPI (`packages/contracts/openapi.yaml`) as canonical source.
- SDK regeneration + parity checks.
- Frontend prohibition on direct `fetch`/`axios` and Prisma imports.
- Tenant isolation by default on all tenant-owned entities and queries.
