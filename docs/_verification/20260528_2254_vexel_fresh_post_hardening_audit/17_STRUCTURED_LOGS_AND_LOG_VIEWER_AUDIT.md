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
| Category Filtering | [Category Filter Response](file:///home/munaim/srv/apps/vexel/docs/_verification/20260528_2254_vexel_fresh_post_hardening_audit/logs/authenticated_logs_category_filter.json) | VERIFIED |
| Severity Filtering | [Severity Filter Response](file:///home/munaim/srv/apps/vexel/docs/_verification/20260528_2254_vexel_fresh_post_hardening_audit/logs/authenticated_logs_severity_filter.json) | VERIFIED |
| Search Capability | [Search Filter Response](file:///home/munaim/srv/apps/vexel/docs/_verification/20260528_2254_vexel_fresh_post_hardening_audit/logs/authenticated_logs_search.json) | VERIFIED |
| Correlation ID Lookup | [Correlation ID Response](file:///home/munaim/srv/apps/vexel/docs/_verification/20260528_2254_vexel_fresh_post_hardening_audit/logs/authenticated_logs_correlation_id_lookup.json) | VERIFIED |

## Category Coverage and UI Behavior Note
While the backend structured logging system supports all 13 specialized categories (e.g. `auth`, `workflow`, `pdf`, `security`), the log query results returned from the API depend on the seeded mock events and active system actions, which may only cover a subset of these categories at any single moment. The screenshots in the audit evidence pack (e.g. `01_recent_logs.png` and `02_category_filter.png`) prove that the Admin UI correctly queries, lists, and filters by these categories dynamically.

## Required Verdict
**LOGS PASS**

## Status Summary
The platform implements a robust structured logging system that meets the MVP observability requirements. The category-wise organization and correlation ID tracking enable efficient multi-tenant troubleshooting. The integrated log viewer in the Admin UI provides the necessary visibility for platform operators.

