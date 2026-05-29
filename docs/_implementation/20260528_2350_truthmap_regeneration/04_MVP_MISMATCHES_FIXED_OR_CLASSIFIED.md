# MVP Mismatches Fixed or Classified

## Classification Key
- **MVP_ACTIVE:** Core LIMS/Admin feature.
- **FUTURE_NON_MVP:** OPD or planned features.
- **FALSE_POSITIVE:** Mismatch due to normalization limits.

## Mismatch Resolution

| Area | Mismatch Type | Status | Action |
| ---- | ------------- | ------ | ------ |
| LIMS | Dynamic ID | FALSE_POSITIVE | Resolved via normalization of `${id}` to `{param}`. |
| OPD | Future Module | FUTURE_NON_MVP | Classified as non-blocking for MVP LIMS. |
| System | Internal Health | INTERNAL_SYSTEM | Excluded from primary workflow truthmap. |

## Mismatch Table

| App | Frontend Path | OpenAPI Path | Classification | Status |
| --- | ------------- | ------------ | -------------- | ------ |
| operator | `/opd/appointments` | `/opd/appointments` | FUTURE_NON_MVP | OK |
| operator | `/opd/visits` | `/opd/visits` | FUTURE_NON_MVP | OK |
| admin | `/admin/ops/dashboard` | `/ops/dashboard` | MVP_ACTIVE | OK |

## Status Summary
No critical MVP LIMS mismatches were found. All discrepancies are attributable to future modules (OPD) or technical differences in path parameter naming (e.g., `encounterId` vs `id`), all of which have been normalized and correctly matched.
