# OPD Admin UI Completion

## Delivered admin surfaces
- OPD overview page (`/admin/opd`) retained for module navigation.
- OPD doctors page expanded with full doctor print-identity fields:
  - designation, degrees, PMDC/PHC, clinic identity, signature metadata.
- Active/inactive doctor availability toggle retained.
- OPD feature flags page updated to include both `module.opd.*` and `opd.*` keys in listing filter.

## Admin boundary compliance
- Admin pages focus on config/reference.
- No admin workflows to mutate OPD encounter lifecycle states were introduced.

## Observability
- Admin can inspect/manage OPD doctor profile master data that feeds operator selection + print identity.
