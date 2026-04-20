# Document Determinism Hardening

Problem addressed:
- PDF `/render` had fallback placeholder PDF behavior for unsupported templates/missing payload, which could mask rendering issues.

Fix applied:
- Replaced silent placeholder behavior with explicit API errors:
  - `400 INVALID_RENDER_REQUEST_JSON`
  - `400 MISSING_RENDER_PAYLOAD`
  - `422 UNSUPPORTED_TEMPLATE_KEY`
- Kept successful render path producing `X-Pdf-Hash` from rendered bytes.

Verification:
- `POST /render` with unknown template -> `422` and explicit error JSON.
- `POST /render` missing payload -> `400` and explicit error JSON.
- `GET /health/pdf` remains healthy after rebuild/restart.

File changed:
- `apps/pdf/Program.cs`
