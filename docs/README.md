# Vexel documentation

This directory contains the project knowledge base. Use the newest dated audit or verification record for runtime status; older records are historical evidence and must not be treated as current deployment claims.

## Document map

| Area | Purpose | Status |
|---|---|---|
| `specs/` | Authoritative architecture, tenancy, workflow, contract, and test decisions | Current source of truth |
| `ops/` | Runbooks, backups, smoke tests, deployment, and recovery procedures | Operational guidance |
| `catalog/` | Catalog source data, build outputs, import rules, and seeding instructions | Maintained product data |
| `templates/` | Document/template studio and rendering rules | Maintained product guidance |
| `ui/`, `features/`, `mocks/` | UI standards, feature notes, and mock-mode scenarios | Active supporting docs |
| `audits/` | Current, decision-relevant audits | Review before release decisions |
| `_audit/`, `_discovery/`, `_fresh_audit/`, `_implementation/`, `_verification/` | Historical audit evidence retained for traceability | Do not use as current status unless explicitly referenced |
| `archive/` | Superseded runtime evidence and working-session artifacts | Retention only; not operational guidance |

## Naming and placement standard

- Use Markdown for prose and a dated directory for each audit or verification run: `YYYYMMDD[_HHMM]_<short-purpose>/`.
- Put authoritative decisions in `specs/`, operational procedures in `ops/`, and product data in the relevant domain folder.
- Put generated logs, screenshots, traces, PDFs, and test reports in an ignored run directory under `docs/_audit/DEPLOY_RUNS/`; do not commit them at the repository root.
- Keep one current summary per audit. Supporting raw evidence belongs beside that summary, not in the repository root.
- Never copy credentials, access tokens, or production secrets into documentation or evidence.

## Current review

The latest repository-wide review is [`audits/20260723_pilot_readiness/`](audits/20260723_pilot_readiness/). It is the current source for pilot readiness and supersedes older release verdicts where they conflict.

Retention decisions for the cleanup are recorded in [`DOCUMENT_RETENTION.md`](DOCUMENT_RETENTION.md).
