# Bugs, Gaps, and Blockers

## Critical
- **Runtime verification blocker:** Local stack unavailable during audit; critical workflows could not be revalidated end-to-end in this run.
  - Evidence: local `curl` health failure, no active `docker compose ps` services.

## High
- **PDF fallback risk:** Placeholder rendering fallback in PDF service can conceal template/data incompatibilities.
  - Evidence: `apps/pdf/Program.cs` fallback generation path.
- **Determinism assurance gap:** Need runtime proof that payload/version/hash behavior is consistently enforced under failures/retries.
  - Evidence: deterministic fields exist, but this pass lacked live pipeline verification.

## Medium
- **Frontend reliability debt:** Large volume of `react-hooks/exhaustive-deps` warnings in operator/admin lint.
  - Evidence: `pnpm --filter @vexel/operator lint`, `pnpm --filter @vexel/admin lint` outputs.
- **Typecheck fragility in operator:** stale `.next/types` expectations can create false failures depending on build state.
  - Evidence: prior `tsc --noEmit` behavior versus post-build state.
- **Tooling drift warning:** `pnpm.overrides` in `apps/worker/package.json` has no effect there.

## Low
- **Prompt/doc filename mismatch:** Some requested governance filenames are not literal repo files; equivalents exist.

## MVP blockers to safe expansion
1. Re-establish reproducible runtime smoke validation baseline.
2. Hard-fail deterministic PDF rendering path (or explicitly govern fallback semantics).
3. Close critical lint/reliability warnings in high-traffic operator/admin flows.
4. Create/refresh authoritative task truth tracker tied to implemented evidence.
