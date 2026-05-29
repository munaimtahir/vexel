# 02. Feature Flags Verification

## Overview
Feature flags in the Vexel Health Platform are **backend-authoritative** and **tenant-scoped**. The frontend never makes caching or visibility decisions locally; it reads resolved feature flags calculated on the fly by the NestJS API.

## Definitions and Schema
The canonical registry resides in `apps/api/src/feature-flags/registry.ts`. Flags are typed and marked with groups (`main-apps`, `app-features`), applications (`lims`, `opd`, etc.), status (`implemented`, `planned`), and dependency relationships.

### Captured Evidence File
- **Definitions**: [definitions.authenticated.json](./runtime-responses/feature-flags/definitions.authenticated.json)
- **Resolved Flags**: [resolved_flags.authenticated.json](./runtime-responses/feature-flags/resolved_flags.authenticated.json)

## Tenant-Scoped Dynamic Verification
A runtime test was conducted to verify that updates to feature flags propagate immediately to the resolved tenant payload.

### Step 1: Base State
The resolved flag state for the current tenant had the following configuration:
```json
"lims.verification.enabled": true
```

### Step 2: Write Toggle Command
An authenticated `PUT /api/feature-flags/lims.verification.enabled` request was dispatched with:
```json
{
  "enabled": false
}
```
Response:
```json
[
  {
    "id": "c6a2e2db-cb1a-464a-9fe7-a8a29a0eb6a2",
    "tenantId": "system",
    "key": "lims.verification.enabled",
    "enabled": false,
    "description": "Enable the verification step before publishing reports. OFF = results auto-publish on submit...",
    "updatedBy": "fa3aab8d-c7e1-49b2-b9fb-8aea94f3f7e3"
  }
]
```
- **Evidence file**: [toggle_result.authenticated.json](./runtime-responses/feature-flags/toggle_result.authenticated.json)

### Step 3: Resolved Verification
Querying `GET /api/feature-flags/resolved` confirmed the state propagates immediately:
```json
"lims.verification.enabled": false
```
- **Evidence file**: [resolved_flags.toggled_false.json](./runtime-responses/feature-flags/resolved_flags.toggled_false.json)

### Step 4: Restore State
The flag was successfully toggled back to `true` to restore the environment default:
- **Evidence file**: [toggle_restore_result.json](./runtime-responses/feature-flags/toggle_restore_result.json)

## Cascade Behavior Design
Module kill-switches (e.g. `module.lims`) are evaluated during resolution. If `module.lims` is resolved to `false`, any LIMS-dependent flags (such as `lims.verification.enabled`) are programmatically forced to `false` during the resolved endpoint calculation, protecting downstream endpoints from unauthorized operations.
