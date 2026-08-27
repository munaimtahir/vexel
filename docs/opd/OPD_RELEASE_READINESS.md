# OPD Release Readiness

> **SUPERSESSION NOTICE:** Prior release-readiness documents validated LIMS/platform scope or explicitly deferred OPD. They are historical-only and cannot be reused as OPD production evidence. OPD has an independent release decision.

**Decision: NOT READY**

## Why

- Two competing OPD model families remain present and reachable.
- Canonical migration/reconciliation and retirement evidence is absent.
- Complete clinical, billing, tenant-security, concurrency, document, browser, migration, and deployment evidence is absent or explicitly partial.
- Existing historical OPD evidence states that dedicated browser E2E and PDF runtime verification were not completed.

## Required release gate

All requirements in [`OPD_RELEASE_SCOPE.md`](../releases/OPD_RELEASE_SCOPE.md) must have current passing evidence. A prior green LIMS/platform verdict cannot satisfy any OPD gate.

## Historical documents excluded

See the explicit list in `docs/releases/OPD_RELEASE_SCOPE.md`. In particular, `docs/_audit/FINAL_VERDICT_2026_05_27/GO_NO_GO_VERDICT.md`, `docs/_audit/MVP_RELEASE_GATE_AUDIT.md`, and the earlier `docs/_audit/opd/` slice verdict/runtime documents are not OPD production approval.
