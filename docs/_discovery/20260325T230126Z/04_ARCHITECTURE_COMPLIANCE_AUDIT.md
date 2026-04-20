# Architecture Compliance Audit

## Compliant areas
- Contract-first artifacts are present and enforced through CI.
- Frontend API access is strongly governed toward SDK usage.
- Next.js apps are API-client oriented (no intentional Prisma usage found in operator/admin paths audited).
- Workflow command endpoints are implemented for major transitions.
- Tenant-aware data model is structurally present.
- Deterministic document fields are structurally present.

## Risky areas
- Deterministic PDF claim is weakened by placeholder/fallback render path.
- Runtime verification gap in this session means architecture behavior is partially unproven live.
- Numerous frontend hook dependency warnings indicate reliability debt.
- Mixed maturity across modules (core LIMS strong, mobile partial).

## Violations / architecture defects found
1. **Document-engine strictness drift (High):** placeholder PDF fallback path exists (`apps/pdf/Program.cs`), which can mask template/render issues and dilute deterministic rendering guarantees.
2. **Governance tracking drift (Medium):** requested `TASKS.md`-style authoritative tracker is not clearly present/authoritative in current doc set.
3. **Operational truth drift (Medium):** documentation suggests validated live stack, but local reproducibility in this session is unverified (stack down).

## Anti-patterns observed
- Broad/silent catch patterns in parts of document/encounter flow can hide operational failures instead of surfacing deterministic failure states.
- Lint-warning tolerance at scale may permit fragile React dataflow behavior.

## Architectural debt summary
- Debt is not primarily in structure; it is in **truth-alignment and hardening** (runtime reproducibility, deterministic rendering strictness, and governance tracker clarity).
