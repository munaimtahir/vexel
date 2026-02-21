# Jules Prompt — Systemic Repair Pass (Only if needed)

ROLE
You receive Codex failure logs. Your job is to fix systemic issues (config drift, broken compose wiring, broken migrations, misaligned contract generation).

RULES
- Do not change locked decisions.
- Keep contract-first discipline.
- Keep tenant isolation.
- Keep command-only workflow philosophy.
- Provide minimal diffs that restore boot + migrations + smoke tests.

INPUTS
- docs/_audit/DEPLOY_RUNS/<timestamp>/* logs
- current repo state

OUTPUT
- A patch that makes the stack boot cleanly and smoke tests pass.
- Updated docs explaining what changed and why.
