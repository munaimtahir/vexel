# Frontend API Guardrail Audit (Admin + Operator)

Goal: verify that Admin and Operator frontends do not bypass the generated SDK (no ad-hoc `fetch`, no `axios`, no direct Prisma/DB usage).

Primary evidence:
- `logs/phase6_rg_axios.txt`
- `logs/phase6_rg_fetch.txt`
- `logs/phase6_rg_xhr.txt`
- `logs/phase6_rg_prisma.txt`
- `logs/phase6_rg_api_literal.txt`
- `logs/phase6_rg_http_literals.txt`

## Results (from scratch)

### 1) `axios` usage
Hits found: documentation/comments only.
- `apps/admin/src/lib/api-client.ts`: comment stating SDK-only
- `apps/operator/src/lib/api-client.ts`: comment stating SDK-only
- `packages/sdk/*`: README / index comment
(Evidence: `logs/phase6_rg_axios.txt`)

Verdict: **No axios import/usage detected in Admin/Operator source.**

### 2) Direct `fetch(` usage in Admin/Operator
Hits found: none in Admin/Operator; a single comment in SDK client file referencing underlying fetch semantics.
(Evidence: `logs/phase6_rg_fetch.txt`)

Verdict: **No direct `fetch(` calls detected in Admin/Operator source (static scan).**

### 3) `XMLHttpRequest` usage
No hits found.
(Evidence: `logs/phase6_rg_xhr.txt`)

Verdict: **PASS (static scan).**

### 4) Prisma usage in Next.js apps
No hits found in `apps/admin` or `apps/operator`.
(Evidence: `logs/phase6_rg_prisma.txt`)

Verdict: **PASS (static scan).**

### 5) Hardcoded `/api/` endpoint literals inside Admin/Operator
No hits found.
(Evidence: `logs/phase6_rg_api_literal.txt`)

Verdict: **PASS (static scan).**

### 6) Hardcoded absolute HTTP URLs
Hits found are configuration/defaults and UI placeholders, not direct endpoint calls:
- Dockerfiles set `ARG NEXT_PUBLIC_API_URL=http://127.0.0.1:9021`
- `apps/*/src/lib/api-client.ts` uses `NEXT_PUBLIC_API_URL` with default `http://localhost:9021`
- `globals.css` imports Google Fonts
- UI placeholders accept URLs for storage/branding configuration
(Evidence: `logs/phase6_rg_http_literals.txt`)

Verdict: **No direct hardcoded backend endpoint calls identified in these hits.**

## Guardrail verdict (Phase 6)

**GUARDRAILS PASS (static scan)**

Limitations:
- This phase is a static scan. Runtime network capture (Phase 7B/14/15/16) must still confirm that user-visible actions route through the SDK in practice.

