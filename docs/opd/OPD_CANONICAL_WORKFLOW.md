# OPD Canonical Workflow

**Status:** design authority for the OPD release; implementation and verification pending.  
**Release decision:** `NOT READY`

## Canonical aggregate

The release must have one tenant-scoped OPD encounter aggregate linked to the shared patient and platform encounter. It owns intake measurements, queue state, consultation note versions, prescription versions, invoice/payment references, audit history, and document identities. Legacy provider/visit workflows must not remain active competitors.

## State machine

| State | Allowed commands | Preconditions | Terminal |
|---|---|---|---|
| `REGISTERED` | record intake, cancel | active tenant feature, patient and clinician valid | no |
| `INTAKE_COMPLETE` | queue/start consultation, cancel | validated intake/vitals | no |
| `IN_CONSULTATION` | save note draft, sign note, draft prescription, cancel | authorized clinician/role | no |
| `NOTE_SIGNED` | publish prescription, issue invoice, cancel | immutable signed note | no |
| `PRESCRIPTION_PUBLISHED` | issue invoice, record payment, complete, cancel | published prescription if required by policy | no |
| `COMPLETED` | governed amendment/refund only | all completion preconditions satisfied | yes |
| `CANCELLED` | governed correction only | reason required, audit written | yes |

Every transition is a command endpoint, validates the current state in a transaction, requires tenant scope and least-privilege permission, propagates a correlation ID, records an audit event, and supports an idempotency key where retryable. Invalid transitions return `409 Conflict`. Admin configuration endpoints never mutate these states.

## Scheduling boundary

Scheduling remains unresolved at baseline because both scheduling and walk-in paths are present. Before release, discovery must choose one outcome: complete scheduling atomically with reservation, timezone, booking, reschedule, cancellation, check-in, no-show, and queue proof; or remove incomplete scheduling routes/UI and document walk-in-only scope. A reachable incomplete hybrid is prohibited.

## Immutable clinical and financial rules

- Signed notes and published prescriptions are immutable; corrections create governed, versioned amendments.
- Invoice/payment state changes use commands and transactions only.
- Duplicate commands return the original result without duplicate clinical or financial effects.
- Completion, cancellation, document generation, and payment effects are explicit and audited.
