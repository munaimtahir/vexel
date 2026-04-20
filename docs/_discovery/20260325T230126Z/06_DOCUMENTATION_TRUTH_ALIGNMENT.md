# Documentation Truth Alignment

## Accurate docs (largely aligned)
- `docs/specs/LOCKED_DECISIONS.md` aligns well with implemented governance patterns.
- `docs/specs/ARCHITECTURE.md` aligns with actual monorepo component boundaries.
- `docs/specs/TENANCY.md` aligns structurally with middleware + tenant fields.
- `docs/specs/LIMS_WORKFLOWS.md` aligns with command endpoint style and guards.
- `docs/specs/DOCUMENTS_PDF.md` aligns with schema intent (`payloadHash`/`pdfHash`) but not fully with fallback strictness.
- `docs/specs/TESTS.md` broadly aligns with test layering present.

## Partially accurate docs
- Ops/run docs that imply ready runtime are only partially accurate in this local session because stack was not active.
- QA gate docs align on commands, but practical warning debt remains high.

## Outdated / overstated / drifted
- Any claim of fully deterministic rendering should explicitly acknowledge placeholder fallback currently present.
- Task/progress tracking appears fragmented versus the requested single-source tracker model.

## Missing docs needed now
- Explicit “current known drifts” page (determinism fallback, warning debt, runtime reproducibility expectations).
- A single authoritative “implementation status tracker” with evidence links.
