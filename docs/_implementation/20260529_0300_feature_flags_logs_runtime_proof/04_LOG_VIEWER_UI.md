# 04. Log Viewer UI Verification

## Overview
The Admin Portal includes a specialized **System Logs Viewer** under `/admin/system/logs`. It fetches data in real-time from the backend, supporting category filtering, severity levels, free-text search, and cross-system correlation ID tracing.

## Visual Verification Screenshots
Below are the screenshots captured during the E2E verification flow:

### 1. Default Recent Logs View
Shows the default loaded state containing all seeded categories and operational logs sorted in reverse chronological order.
![Recent Logs](./screenshots/log-viewer/01_recent_logs.png)

### 2. Category Filter
Demonstrates logs filtered by the selected `WORKFLOW` category.
![Category Filter](./screenshots/log-viewer/02_category_filter.png)

### 3. Severity Level Filter
Filters the logs to display warnings and errors (e.g. `WARN` level selected).
![Severity Filter](./screenshots/log-viewer/03_severity_filter.png)

### 4. Free-text Search
Filters logs containing the search term "failed", dynamically returning matching events.
![Free-text Search](./screenshots/log-viewer/04_search.png)

### 5. Log Details Modal
Shows the detailed modal view triggered by clicking the "View" action button. The modal displays complete JSON metadata and parameters.
![Detail View](./screenshots/log-viewer/05_detail_view.png)

### 6. Correlation ID Trace
Filtering by a specific correlation ID (`8f47b93a-86c2-498c-9563-ff92a071ece5`) displays the entire unified transaction history spanning multiple services (Worker, Auth, PDF, Workflow, etc.).
![Correlation ID Trace](./screenshots/log-viewer/06_correlation_lookup.png)
