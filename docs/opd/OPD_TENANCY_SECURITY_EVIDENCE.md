# OPD Tenancy and Security Evidence

**Decision:** `NOT READY`

## Controls observed

- OPD service lookups inspected in this sprint include `tenantId` filters.
- Tenant feature checks are server-side.
- Billing routes now use `opd.billing.read/manage`; OPD document reads use `opd.document.read`; note signing uses `opd.clinical_note.sign`.
- Cross-tenant encounter linkage is covered by a focused unit assertion.

## Open security gates

1. No clinician user-to-doctor ownership relation or enforcement exists.
2. No full tenant A/B suite covers appointments, schedules, notes, prescriptions, invoices, payments, documents, jobs, nested relations, pagination and search.
3. No least-privilege OPD browser persona is used; current OPD browser tests default to super-admin.
4. No stale-JWT, inactive-user, disabled-feature, guessed-UUID, or UI-hidden command matrix is checked in.
5. Seed still contains a mixed historical OPD feature namespace and provisions no OPD demo user assignments.
6. API image audit reports unresolved Critical/High advisories; reachability has not been triaged.

No claim of “no Critical/High issue” is currently supportable.
