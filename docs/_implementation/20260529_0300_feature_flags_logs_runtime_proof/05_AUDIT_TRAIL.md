# 05. Audit Trail Verification

## Overview
Administrative operations, configuration updates, and feature flag changes generate persistent database audit trails in the `AuditEvent` model, in addition to writing system logs. This satisfies security requirements and provides a complete history of critical updates.

## Audit Event Structure
Each audit entry captures:
- **actorUserId**: The system ID of the user performing the change.
- **tenantId**: The tenant scope in which the action occurred.
- **action**: The keyword identifying the action (e.g. `feature_flag.set`, `feature_flag.set_variant`).
- **entityType / entityId**: The target model and its primary key.
- **before / after**: Complete JSON diff blocks capturing precisely what changed.
- **correlationId**: Trace ID linked to the HTTP request.

## Verification of Captured Audit Logs
When we toggled the feature flag `lims.verification.enabled` in the previous step, the API service wrote a corresponding entry to the database:

### Toggle Audit Record (Pre-Toggle to Disabled)
```json
{
  "tenantId": "system",
  "actorUserId": "fa3aab8d-c7e1-49b2-b9fb-8aea94f3f7e3",
  "action": "feature_flag.set",
  "entityType": "TenantFeature",
  "entityId": "c6a2e2db-cb1a-464a-9fe7-a8a29a0eb6a2",
  "before": {
    "key": "lims.verification.enabled",
    "enabled": true
  },
  "after": {
    "key": "lims.verification.enabled",
    "enabled": false
  },
  "correlationId": "8f47b93a-86c2-498c-9563-ff92a071ece5"
}
```

### Restore Audit Record (Disabled to Re-Enabled)
```json
{
  "tenantId": "system",
  "actorUserId": "fa3aab8d-c7e1-49b2-b9fb-8aea94f3f7e3",
  "action": "feature_flag.set",
  "entityType": "TenantFeature",
  "entityId": "c6a2e2db-cb1a-464a-9fe7-a8a29a0eb6a2",
  "before": {
    "key": "lims.verification.enabled",
    "enabled": false
  },
  "after": {
    "key": "lims.verification.enabled",
    "enabled": true
  },
  "correlationId": "8f47b93a-86c2-498c-9563-ff92a071ece5"
}
```

## Traceability Proof
The correlation ID `8f47b93a-86c2-498c-9563-ff92a071ece5` is logged in the `AuditEvent` and printed in the system log file. This enables administrators to copy a correlation ID from a system log error and query the database audit trail to find the exact actor and parameters responsible for the change.
