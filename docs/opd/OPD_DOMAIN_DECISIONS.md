# OPD Domain Decisions

## Decision 1 — command-driven aggregate is the intended direction

The existing command-driven `OpdEncounter` family is the starting point because it already expresses command endpoints, idempotency logging, and deterministic document integration. This is not a final approval: discovery must verify it and consolidate or replace it before release.

## Decision 2 — no dual runtime

The legacy provider/appointment/visit family and command-driven family must not remain as competing live workflows. Any preservation of existing records must use additive migration/reconciliation with verified counts and rollback evidence; no dual writes or hidden compatibility endpoints.

## Decision 3 — release gate

OPD has an independent `READY`/`NOT READY` decision and cannot inherit a platform or LIMS release verdict.
