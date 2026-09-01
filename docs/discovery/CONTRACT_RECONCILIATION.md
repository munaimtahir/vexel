# OpenAPI ↔ SDK ↔ backend ↔ frontend reconciliation

## Verdict

The SDK is fresh from the current OpenAPI, and inspected frontends use `@vexel/sdk` rather than raw production HTTP clients. Contract-first compliance nevertheless fails because generated freshness proves only OpenAPI-to-SDK equality, not backend route or response conformance.

## Four-way result

| Layer | Evidence | State |
|---|---|---|
| OpenAPI | 258 unique operations | Canonical declaration |
| SDK | Regeneration produced no diff; SDK tests 5/5 pass | Fresh |
| Runtime Nest Swagger | 299 operations, 298 normalized method/path identities | Drifted |
| Frontend | SDK client used; several OPD pages suppress type checking with `as any` | Partly conformant |

After normalizing path-parameter names, six canonical method/path identities are absent from runtime and 46 runtime identities are absent from OpenAPI.

## Material mismatches

| ID | Module | Area | Finding | Evidence | Current State | Expected State | Severity | Release Impact | Recommended Action | Dependencies | Verification Required |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ARCH-P1-001 | Catalog | Command paths | Canonical `PUT /catalog/tests/{id}/parameters:bulk` and `/catalog/panels/{id}/tests:bulk` are implemented as `/bulk`. | OpenAPI lines 4743/4798; controller lines 135/221; live Swagger comparison | CONTRACT ONLY at canonical path | Exact contract route | P1 | Generated consumer would 404 | Escape/implement colon command paths or deliberately change OpenAPI first | Contract decision | Route integration tests via generated SDK |
| OPD-P0-006 | OPD | Appointment commands | Four canonical appointment commands are malformed at runtime as `{appointmentId}{check}-in`, `{cancel}`, `{reschedule}`, `{no}-show` because controller colons are unescaped. | `opd.controller.ts:119-140`; live Swagger paths | BROKEN | Exact canonical colon commands | P0 | Appointment commands are unreachable via SDK | Escape command colons and add controller/runtime tests | None | Generated-SDK calls return designed status |
| OPD-P0-002 | OPD | Billing DTO | OpenAPI/UI use `invoiceNumber/subtotal/paidTotal`; backend returns `invoiceCode/subtotalAmount/amountPaid` and accepts undocumented linkage. | OpenAPI 1974-2070; service 62-92,257-332; runtime JSON | Incompatible models | One canonical shared Invoice DTO | P0 | Financial UI displays/acts on wrong fields | Lock DTO in OpenAPI, implement it, regenerate, remove `as any` | Invoice linkage decision | Schema validation and browser E2E |
| OPD-P0-003 | OPD | Billing commands | UI calls slash paths (`/issue`, `/void`, `/payments`, `/receipt`) while contract/backend use colon commands. | Billing detail page 117-185; runtime slash paths 404 | Frontend broken | SDK typed commands | P0 | Cash-desk commands fail | Replace literal `as any` calls after DTO closure | OPD-P0-002 | Finance-role E2E |
| ARCH-P1-002 | Catalog/Admin | Undocumented aliases | Runtime exposes many dual-mounted `/admin/catalog/*`, import/export/template mapping, PUT/PATCH aliases absent from OpenAPI. | 46 runtime-only normalized identities; dual controller mounts | BACKEND ONLY | Contracted or retired surface | P1 | Undocumented production behavior and attack surface | Select canonical families, add/remove contract-first | Access-log review | Reverse truth-map and route tests |

## Frontend enforcement limitations

`scripts/check-admin-openapi-parity.js` passed over 154 references in 60 files, but it does not compare the live Nest router or response schemas. OPD billing uses `as any` around stale paths and DTOs, bypassing the value of generated types. E2E helpers use raw `fetch` appropriately as test infrastructure, not production frontend code. The Mobile scaffold uses mocked local clients and is excluded from release.

## Required closure

1. Fix the six canonical runtime route misses.
2. Lock and implement the OPD financial DTO and linkage.
3. Remove frontend `as any` endpoint suppressions.
4. Decide and contract or retire the 46 runtime-only aliases.
5. Add CI that compares canonical OpenAPI to a booted Nest route manifest and validates representative responses, not only SDK generation.
