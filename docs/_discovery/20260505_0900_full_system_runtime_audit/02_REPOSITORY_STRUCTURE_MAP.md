# 02_REPOSITORY_STRUCTURE_MAP.md

Status: COMPLETE (static discovery)

## Baseline Layout Check

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/32_expected_paths_fixed.txt`
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/33_key_entry_files_fixed.txt`

| Expected Path | Status | Detected Tech | Key Files | Problems |
|---|---|---|---|---|
| `apps/api` | FOUND | NestJS (TypeScript), Prisma | `apps/api/package.json`, `apps/api/prisma/schema.prisma` | Not assessed in this phase |
| `apps/worker` | FOUND | Node.js worker (BullMQ expected) | `apps/worker/package.json` | Not assessed in this phase |
| `apps/pdf` | FOUND | .NET (QuestPDF expected) | `.csproj` (see evidence) | Not assessed in this phase |
| `apps/admin` | FOUND | Next.js (App Router expected) | `apps/admin/package.json`, `apps/admin/next.config.ts` (see evidence) | Not assessed in this phase |
| `apps/operator` | FOUND | Next.js (App Router expected) | `apps/operator/package.json`, `apps/operator/next.config.ts` (see evidence) | Not assessed in this phase |
| `packages/contracts/openapi.yaml` | FOUND | OpenAPI contract | `packages/contracts/openapi.yaml` | Not validated yet |
| `packages/sdk` | FOUND | TypeScript SDK package | `packages/sdk/package.json`, `packages/sdk/src/*` | Not validated yet |

## Top-Level Major Folders (Observed)

Evidence:
- `docs/_discovery/20260505_0900_full_system_runtime_audit/logs/43_top_level_dirs.txt`

Notes:
- `docs/` present (specs, ops, prompts expected).
- Additional major folders (if any) will be classified as active/obsolete during later audits.
