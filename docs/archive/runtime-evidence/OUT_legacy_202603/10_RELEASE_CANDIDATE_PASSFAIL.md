# 10 Release Candidate Verification PASS/FAIL

## Metadata
- Timestamp (UTC): 2026-02-26T22:56:52Z
- Git SHA: `5f2b851`
- Repository: `/home/munaim/srv/apps/vexel`
- Runtime: Node `v20.20.0`, pnpm `9.15.4` (ref: `OUT/10_ARTIFACTS/logs/gateA_versions.txt`)

## Gate Summary
| Gate | Status | Notes |
|---|---|---|
| A Repo integrity | PASS | Install/lint/build passed; workspace test script absent so scoped API tests executed and passed (`9/9 suites`, `47 tests`). |
| B OpenAPI-SDK coherence | PASS | SDK regenerated; freshness check exit `0`; SDK-only + no-frontend-prisma + color lint scans passed. |
| C Docker runtime smoke | PASS | Compose services up; API/PDF health `200`; Admin `/admin/login` and Operator `/lims/worklist` return `200`. |
| D Tenant isolation | PASS | Tenant A read `200`; cross-tenant Tenant B read of same patient returns `404` (no leakage). |
| E Document determinism/idempotency | PASS | Deterministic `payloadHash`; worker stops at `RENDERED`; publish command idempotent; download returns PDF bytes with `%PDF-`. |
| F Auditability proof | PASS | Audit events captured for verify/render/publish with correlation IDs. |
| G UI workflow sanity | PASS | Operator publish button flow validated via headless UI trace; admin tenant/config routes load. |

## Gate A — Repo integrity (PASS)
Commands executed:
- `git status --porcelain` (clean before/after; refs: `gateA_git_status_before.txt`, `gateA_git_status_after.txt`)
- `pnpm -w install --frozen-lockfile` (pass; ref: `gateA_install.txt`)
- `pnpm -w lint` (pass; warnings only; ref: `gateA_lint.txt`)
- `pnpm -w build` (pass; ref: `gateA_build.txt`)
- `pnpm -w test` (not defined in workspace; ref: `gateA_test_summary.txt`)
- Fallback scoped tests: `pnpm -C apps/api test` (pass; ref: `gateA_test_api.txt`)

Key output:
- API tests: `Test Suites: 9 passed, 9 total` / `Tests: 47 passed, 47 total`

## Gate B — OpenAPI ↔ SDK coherence (PASS)
Commands executed:
- `pnpm sdk:generate` (pass; ref: `gateB_sdk_generate.txt`)
- `packages/sdk/scripts/check-sdk-freshness.sh` (exit `0`; ref: `gateB_sdk_freshness.txt`)
- SDK-only scans (admin/operator pass; refs: `gateB_sdk_only_admin_status.txt`, `gateB_sdk_only_operator_status.txt`)
- Frontend Prisma scan pass (ref: `gateB_no_prisma_status.txt`)
- UI color lint pass (ref: `gateB_color_lint.txt`)

## Gate C — Docker runtime smoke (PASS)
Commands executed:
- `docker compose up -d --build` (ref: `gateC_compose_up.txt`)
- `docker compose ps` (all core services up; ref: `gateC_compose_ps.txt`)
- Logs captured:
  - `OUT/10_ARTIFACTS/logs/api.log`
  - `OUT/10_ARTIFACTS/logs/worker.log`
  - `OUT/10_ARTIFACTS/logs/pdf.log`
  - `OUT/10_ARTIFACTS/logs/minio.log`

Health checks:
- API: `GET http://127.0.0.1:9021/api/health` → `200` (`gateC_api_health.txt`)
- PDF: `GET http://127.0.0.1:9022/health/pdf` → `200` (`gateC_pdf_health_pdf.txt`)
- Admin: `GET http://127.0.0.1:9023/admin/login` → `200` (`gateC_admin_login.txt`)
- Operator: `GET http://127.0.0.1:9024/lims/worklist` → `200` (`gateC_operator_lims_worklist.txt`)

## Gate D — Tenant isolation (PASS)
Evidence:
- Tenant A token reads Tenant A patient:
  - `GET /api/patients/{id}` → `HTTP/1.1 200 OK` (`gate_d_tenant_a_patient_read.txt`)
- Tenant B token attempts same patient:
  - `GET /api/patients/{same-id}` → `HTTP/1.1 404 Not Found` (`gate_d_tenant_b_cross_read.txt`)

Result: no cross-tenant resource leakage observed.

## Gate E — Document determinism + idempotency (PASS)
Primary evidence files:
- IDs/status: `OUT/10_ARTIFACTS/notes/gate_e_ids.txt`
- DB snapshot before publish: `gate_e_document_db_before.txt`
- Idempotency counts: `gate_e_doc_counts.txt`
- Regenerate responses: `gate_e_regenerate_1.json`, `gate_e_regenerate_2.json`
- Publish command responses: `gate_e_publish_1.json`, `gate_e_publish_2.json`
- PDF download artifacts: `OUT/10_ARTIFACTS/pdf/*`

Validated:
1. **Deterministic payloadHash + idempotent regenerate**
   - Document before regenerate: `doc=eba804fb-d0cf-4358-9406-c43d0b9c53ec`, status `RENDERED`
   - Regenerate #1 and #2 returned same id: `eba804fb-d0cf-4358-9406-c43d0b9c53ec`
   - Count unchanged: `doc_count_before=1`, `doc_count_after=1`
   - Payload contains deterministic `issuedAt` equal to encounter `createdAt`; no `printedAt` field (`gate_e_report_payload.json`, `gate_e_encounter_final.json`)
2. **Worker ends at RENDERED**
   - Pre-publish status captured as `RENDERED` (`gate_e_ids.txt`, `gate_e_document_db_before.txt`)
3. **Publish command is idempotent**
   - `POST /encounters/{id}:publish-report` first call: `PUBLISHED`
   - second call: `PUBLISHED` again, no duplicate doc (`gate_e_publish_1.json`, `gate_e_publish_2.json`)
4. **Download returns PDF bytes**
   - `GET /documents/{id}/download` header `Content-Type: application/pdf` (`pdf/download_headers.txt`)
   - Magic bytes `%PDF-` (`pdf/pdf_magic.txt`)
   - SHA256 matches DB `pdfHash`:
     - file: `21ef7ea96eab77669c93dcc894525599f803cffebbec269dac4554d72e08daae`
     - DB:   `21ef7ea96eab77669c93dcc894525599f803cffebbec269dac4554d72e08daae`

## Gate F — Auditability proof (PASS)
Evidence:
- Verify command event present:
  - `action=encounter.verify`, total `1`, correlationId `rc-gate-f-verify`
  - ref: `gate_f_audit_verify.json`
- Render event present:
  - `action=document.rendered`, total `1`, correlationId `rc-gate-e3-submit-verify`
  - ref: `gate_f_audit_rendered.json`
- Publish-report events present:
  - `action=encounter.publish_report`, total `2`, correlationIds `rc-gate-e3-publish-1` and `rc-gate-e3-publish-2`
  - ref: `gate_f_audit_publish.json`

## Gate G — UI workflow sanity (PASS)
Evidence (headless browser trace):
- `OUT/10_ARTIFACTS/notes/UI-trace.txt`

Validated:
- Operator publish flow:
  - visited `/lims/encounters/{id}/publish`
  - clicked **Publish report**
  - backend encounter transitioned to `published`
  - **Download PDF** button visible after reload
- Admin sanity:
  - `/admin/login` sign-in performed
  - `/admin/feature-flags` and `/admin/tenants` routes load without crash

## Checklist
- [x] Gate A: pnpm install/lint/build/test green
- [x] Gate B: OpenAPI↔SDK regenerated, scans pass
- [x] Gate C: docker compose up, health endpoints OK
- [x] Gate D: tenant isolation proven
- [x] Gate E: determinism + rendered-not-published + publish idempotency + PDF bytes verified
- [x] Gate F: audit events captured (verify/render/publish)
- [x] Gate G: operator publish flow + admin routes sanity verified
- [x] Evidence pack written + artifacts saved

## Final Verdict
**Verdict: PASS**
