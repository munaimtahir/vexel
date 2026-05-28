# OpenAPI Contract Audit (Fresh Run)

Canonical contract location (as found in repo):
- `packages/contracts/openapi.yaml`

Evidence captured in this run:
- Presence check: `logs/phase4_openapi_ls.txt`
- Basic static scan (OpenAPI version, operationId uniqueness counts): `logs/phase4_openapi_yaml_basic_scan.txt`
- Admin/OpenAPI parity check: `logs/phase4_check_admin_openapi_parity.txt`
- Security scheme scan excerpts: `logs/phase4_openapi_security_scan.txt`
- OpenAPI copy stored for this run: `contracts/openapi/openapi.yaml`

## Findings (verified from scratch)

1. OpenAPI file exists and is non-trivial
- Size/lines recorded in `logs/phase4_openapi_yaml_basic_scan.txt`.

2. OpenAPI version + operationId uniqueness
- Detected `openapi: 3.1.0`.
- `operationId` count: 263, unique: 263, duplicates: 0. (Evidence: `logs/phase4_openapi_yaml_basic_scan.txt`)

3. Security scheme presence (contract-level)
- `bearerAuth` is defined under `components.securitySchemes` and referenced by operations (Evidence: `logs/phase4_openapi_security_scan.txt`).

4. Frontend parity check (Admin) status
- Script `scripts/check-admin-openapi-parity.js` reports PASS with counts (Evidence: `logs/phase4_check_admin_openapi_parity.txt`).

## Tooling used (without regenerating repo SDK)

- `openapi-typescript` is available via `pnpm -C packages/contracts exec ...` (Evidence: `logs/phase4_openapi_typescript_version.txt`).
- For this audit run, OpenAPI types were generated into the evidence folder only:
  - `contracts/openapi/openapi-types.d.ts`

Note: An initial attempt wrote the output under `packages/contracts/docs/_fresh_audit/...` due to relative path resolution from the package working directory; this was immediately moved into the correct evidence folder and the accidental directory removed. The canonical contract file was not modified.

## Contract verdict (Phase 4)

Current status: **CONTRACT PARTIAL**

Rationale:
- Verified: existence, OpenAPI version, operationId uniqueness, security scheme presence, Admin parity script PASS.
- Not yet verified in this phase: full schema validity via a dedicated OpenAPI validator/linter; OpenAPI ↔ backend implementation parity; OpenAPI ↔ SDK ↔ frontend usage parity (these continue in Phases 5/7/7B).

