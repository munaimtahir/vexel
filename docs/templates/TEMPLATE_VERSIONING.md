# Template Versioning

This document describes the versioning model for tenant print templates.

## Rules

### Editing a DRAFT

When a template is in `DRAFT` status, edits update it **in-place**. The `templateVersion` does not change.

### Editing an ACTIVE template

Editing an `ACTIVE` template creates a **new DRAFT version**:
- A new `PrintTemplate` row is created with `templateVersion = previous_version + 1` and `status = DRAFT`.
- The `supersedesTemplateId` field on the new row points to the original template.
- The original `ACTIVE` template is **not changed** and continues to serve live documents.

This means that at any point, there may be:
- One `ACTIVE` version in production use.
- One `DRAFT` version being edited.

### Activating a new version

When a `DRAFT` is activated:
1. All other `ACTIVE` templates with the same `code` in the same tenant are automatically `ARCHIVED`.
2. The `DRAFT` transitions to `ACTIVE`.

### New Version button

The "New Version" button is available on `ACTIVE` templates. It calls `POST /admin/templates/{id}/new-version` which internally calls `updateTemplate` with no body changes — just creates the new draft copy.

## Version History

Every `PrintTemplate` row is permanently stored — versions are never deleted.

To trace a template's history:
1. Find the current `ACTIVE` template by `(tenantId, code, status=ACTIVE)`.
2. Follow the `supersedesTemplateId` chain to traverse previous versions.
3. Each archived version remains addressable by its `id`.

Historical documents store `templateCode` + `templateVersion` in their canonical payload, so you can always retrieve the exact template used for any past document.

## Version Number Assignment

Version numbers are assigned as follows:

```typescript
// In updateTemplate (new-version path)
const nextVersion = existingTemplate.templateVersion + 1;
```

The version is a simple monotonically increasing integer per `(tenantId, code)` group.

## Examples

### Standard edit flow

```
Template created from blueprint → v1 DRAFT
Admin activates v1              → v1 ACTIVE
Admin edits v1                  → v2 DRAFT created, v1 ACTIVE unchanged
Admin activates v2              → v2 ACTIVE, v1 ARCHIVED
```

### Clone flow

Cloning always creates a new template starting at v1 with a different code — it is not a version of the original:

```
Clone "general_table_v1" → creates "general_table_v1_copy" at v1 DRAFT
```

### New Version button

```
v1 ACTIVE → click New Version → v2 DRAFT created with supersedesTemplateId = v1.id
Admin edits v2, activates v2   → v2 ACTIVE, v1 ARCHIVED
```

## Immutability Guarantee

Documents reference templates by `templateCode` + `templateVersion` in their canonical payload hash. An archived template version is **never deleted** from the database, ensuring that historical documents can always be re-rendered to their original specification.

## API Summary

| Endpoint | When to Use |
|----------|-------------|
| `PATCH /admin/templates/{id}` | Edit a DRAFT (in-place) or an ACTIVE (creates new draft) |
| `POST /admin/templates/{id}/new-version` | Explicitly branch a new draft from ACTIVE |
| `POST /admin/templates/{id}/activate` | Promote a DRAFT to ACTIVE |
| `POST /admin/templates/{id}/archive` | Archive a template (blocked if it's a default for any test) |
