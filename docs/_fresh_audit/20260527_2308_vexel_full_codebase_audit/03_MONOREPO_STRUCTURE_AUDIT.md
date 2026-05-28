# Monorepo Structure Audit (From Scratch)

Primary evidence:
- Directory listing (depth 2): `logs/phase1_dirs_maxdepth2.txt`
- File listing (depth 3, first 1000): `logs/phase1_files_maxdepth3_head1000.txt`
- Key file discovery: `logs/phase1_key_files_find.txt`
- Top-level area listings: `logs/phase1_ls_apps.txt`, `logs/phase1_ls_packages.txt`, `logs/phase1_ls_docker.txt`, `logs/phase1_ls_scripts.txt`

Observed top-level structure (high level)
- `apps/`: `admin`, `api`, `e2e`, `mobile`, `operator`, `pdf`, `worker`
- `packages/`: `contracts`, `sdk`, `theme`, `ui-system`
- `docker/` and root `docker-compose.yml` present
- Root `pnpm-lock.yaml` present

Expected layout verification
- `apps/api`: FOUND
- `apps/worker`: FOUND
- `apps/pdf`: FOUND
- `apps/admin`: FOUND
- `apps/operator`: FOUND
- `packages/contracts`: FOUND
- `packages/sdk`: FOUND

Additional/non-baseline areas
- `apps/mobile`: FOUND (not in the locked baseline list; requires later review for scope/risks)
- `apps/e2e`: FOUND (Playwright or other e2e harness likely; to be verified in Phase 2/16/17)

Structure table (initial)

| Area | Expected? | Found? | Detected Stack (from files) | Key Files (examples) | Tests Present (not verified yet) | Build Script (not verified yet) | Risk (initial) |
|---|---|---|---|---|---|---|---|
| `apps/api` | Yes | Yes | Node/TS (package.json), Dockerfile | `apps/api/package.json`, `apps/api/Dockerfile` | Unknown | Unknown | Medium (requires contract/tenancy/workflow verification) |
| `apps/worker` | Yes | Yes | Node/TS (package.json), Dockerfile | `apps/worker/package.json`, `apps/worker/Dockerfile` | Unknown | Unknown | Medium (queue/correlation/audit propagation must be proven) |
| `apps/pdf` | Yes | Yes | .NET (csproj), Dockerfile | `apps/pdf/vexel-pdf.csproj`, `apps/pdf/Dockerfile` | Unknown | Unknown | High (local `dotnet` missing; may block non-container verification) |
| `apps/admin` | Yes | Yes | Node/TS (package.json), Dockerfile, `.env.example` | `apps/admin/package.json`, `apps/admin/Dockerfile`, `apps/admin/.env.example` | Unknown | Unknown | Medium (must prove SDK-only + route governance) |
| `apps/operator` | Yes | Yes | Node/TS (package.json), Dockerfile | `apps/operator/package.json`, `apps/operator/Dockerfile` | Unknown | Unknown | Medium (must prove `/lims/*` namespacing + SDK-only + workflow) |
| `packages/contracts` | Yes | Yes | Node (package.json) | `packages/contracts/package.json` | Unknown | Unknown | High (contract is canonical; must lint/validate) |
| `packages/sdk` | Yes | Yes | Node (package.json) | `packages/sdk/package.json` | Unknown | Unknown | High (SDK-only frontend rule depends on this) |
| `apps/e2e` | Not required | Yes | Node (package.json) | `apps/e2e/package.json` | Likely | Unknown | Medium (e2e reliability + artifacts currently in git status) |
| `apps/mobile` | Not required | Yes | Node (package.json) | `apps/mobile/package.json` | Unknown | Unknown | Low/Medium (scope creep risk; must ensure it doesn’t violate guardrails) |

Notable findings (structure-only; not a verdict)
- Root `.env` exists (`./.env` appears in key-file discovery). This is a **security/process risk** until reviewed (Phase 3/19) and confirmed whether it contains secrets and whether it is intended to be committed.
- Repo worktree is dirty with generated/build artifacts (e.g., `tsconfig.tsbuildinfo`, e2e report/test-results changes). This does not block auditing but is recorded as baseline context (Phase 0).

