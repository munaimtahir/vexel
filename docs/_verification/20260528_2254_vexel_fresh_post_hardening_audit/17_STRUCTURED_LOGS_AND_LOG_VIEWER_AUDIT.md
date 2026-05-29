# Structured Logs and Log Viewer Audit

## Logging Architecture
- **Structure:** JSON-formatted entries with `id`, `timestamp`, `category`, `level`, `message`, `correlationId`, `tenantId`, and optional `metadata`.
- **Categories:** 13 specialized categories (e.g., `auth`, `workflow`, `pdf`, `security`).
- **Persistence:** Local file-based storage at `runtime/logs/system.log`.
- **Visibility:** Real-time console output in development mode.

## Log Viewer (Admin UI)
- **Status:** IMPLEMENTED.
- **Location:** `apps/admin/src/app/(protected)/system/logs/page.tsx`.
- **Capabilities:**
    - Paginated listing of system logs.
    - Category-based filtering.
    - Level-based filtering (info, warn, error).
    - Correlation ID and Tenant ID search.
    - Full-text search on message content.

## Evidence Matrix

| Logic | Fresh Evidence | Status |
| ----- | -------------- | ------ |
| Category Registry | `LogCategory` enum in `system-logs.service.ts` | VERIFIED |
| Storage | `logFilePath` in `system-logs.service.ts` | VERIFIED |
| Querying | `query` method in `system-logs.service.ts` | VERIFIED |
| UI | `apps/admin/src/app/(protected)/system/logs/page.tsx` | VERIFIED |

## Required Verdict
**LOGS PASS**

## Status Summary
The platform implements a robust structured logging system that meets the MVP observability requirements. The category-wise organization and correlation ID tracking enable efficient multi-tenant troubleshooting. The integrated log viewer in the Admin UI provides the necessary visibility for platform operators.
