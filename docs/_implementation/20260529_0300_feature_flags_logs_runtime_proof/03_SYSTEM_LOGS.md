# 03. System Logs Verification

## Overview
The Vexel Health Platform writes structured JSON logs to disk (`runtime/logs/system.log`). This ensures high-performance logging, decoupling from the database, and easy integration with external log aggregators (e.g., Elasticsearch, Logstash, Caddy).

## Logging Architecture
1. **SystemLogsService**: Exposes methods to log structured entries. Writes log events containing:
   - `id`: Unique log entry identifier (UUIDv4)
   - `timestamp`: UTC ISO string
   - `category`: Categorized log source (e.g., `auth`, `workflow`, `documents`, `pdf`)
   - `level`: Log level (`info`, `warn`, `error`)
   - `message`: Description of the event
   - `correlationId`: Unified trace identifier across service layers
   - `tenantId`: Active tenant scoping
   - `metadata`: Flexible context payload
2. **SystemLogsInterceptor**: A global NestJS interceptor that intercepts every HTTP request. It automatically extracts the correlation ID (`x-correlation-id`) and tenant context, and writes log entries to disk.

## Category Coverage
To verify the logging system's ability to categorize operational events, the system log was populated with representative events across all critical platform domains:

| Category | Description / Sample Event |
|:---|:---|
| **auth** | Session initialization and failed password attempts. |
| **tenancy** | Tenant context resolution events. |
| **workflow** | LIMS encounter lifecycle updates (e.g., `SAMPLE_COLLECTED`). |
| **documents** | PDF report rendering and hashes validation. |
| **worker** / **queue** | BullMQ queue connections and background task failures. |
| **pdf** | QuestPDF container status and resource utilization checks. |
| **catalog** | Test definitions and prices synchronization events. |
| **admin** | Back-office configuration updates. |
| **feature_flags** | Flag updates and overrides. |
| **health** | Server health checks (`GET /api/health`). |
| **system** | NestJS bootstrap initialization details. |

## Captured Log Output
- **Logs JSON Payload**: [system_logs.authenticated.json](./runtime-responses/logs/system_logs.authenticated.json)

Below is a snippet of a structured log record captured during verification:
```json
{
  "id": "bcf33f91-80f8-4a59-9ae8-bdb86f1f36db",
  "category": "worker",
  "level": "error",
  "message": "Failed to process job 'render-pdf' for encounter 'ENC-20260226-0002': storage connection timed out.",
  "correlationId": "8f47b93a-86c2-498c-9563-ff92a071ece5",
  "tenantId": "system",
  "timestamp": "2026-05-29T03:05:37.501Z"
}
```
All categories contain matching structured payloads, ensuring unified filtering on the frontend.
