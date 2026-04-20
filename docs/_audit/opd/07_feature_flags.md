# OPD Feature Flags Alignment

## Target OPD flags
- `module.opd`
- `module.opd.doctorProfiles`
- `module.opd.prescription`
- `module.opd.receipt`
- `module.opd.printSummary`

## Implemented alignment
- API OPD service checks updated to use module-scoped OPD flags for doctor profiles and prescription/receipt flows.
- Operator pages updated to consume module-scoped OPD flags for doctor profile and prescription gates.
- Admin OPD feature-flag view now includes both `module.opd.*` and `opd.*` keys.

## Notes
- Legacy `opd.*` flags still exist for backward compatibility/scaffold paths.
- Canonical slice behavior now maps to module-scoped keys for clearer governance.
