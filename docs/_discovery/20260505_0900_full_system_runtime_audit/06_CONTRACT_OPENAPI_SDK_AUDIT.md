# 06_CONTRACT_OPENAPI_SDK_AUDIT.md

Status: COMPLETE (static audit; no runtime verification yet)

## Contract Canonicality

Observed:
- `packages/contracts/openapi.yaml` exists and declares `openapi: 3.1.0`. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/54_scripts_openapi_refs.txt`

## OpenAPI Syntax / Lint Validation

Result: FAIL (lint errors)
- `npx @redocly/cli lint` reports multiple instances of `nullable` being invalid for OpenAPI 3.1 (expects JSON Schema null-union instead). Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/52_openapi_lint.txt`

Risk:
- Critical for contract-first discipline: toolchains may disagree on spec validity; CI may not enforce drift correctly if the spec is not consistently lintable.

## SDK Generation Wiring

Observed:
- Root script: `pnpm sdk:generate` delegates to `@vexel/contracts`. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/54_scripts_openapi_refs.txt`
- `packages/contracts/package.json` contains `sdk:generate` using `openapi-typescript` and a post-process script to place generated types into `packages/sdk/src/generated/api.d.ts`. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/54_scripts_openapi_refs.txt`
- `packages/sdk` contains a freshness guard script `packages/sdk/scripts/check-sdk-freshness.sh`. Evidence: `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/54_scripts_openapi_refs.txt`

Not verified in this phase:
- Whether CI actually runs the freshness guard on PRs (checked later under CI/workflows).
- Whether backend routes fully match the contract (covered in backend discovery + runtime tests).
