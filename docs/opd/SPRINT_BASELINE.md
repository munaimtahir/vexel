# OPD Sprint Baseline

**Baseline date:** 2026-08-27  
**Repository:** `/home/munaim/srv/apps/vexel`  
**Branch:** `main`  
**Baseline release decision:** `NOT READY`

## Repository reality

- The requested `/home/munaim/Documents/github/vexel` checkout is absent; this repository is the available workspace and authoritative working tree for this sprint.
- OPD is not a blank module. It has API, Prisma, OpenAPI, SDK, Admin, Operator, mobile references, document integration, migrations, and historical audit artifacts.
- Two OPD runtime families are present and therefore canonical consolidation is incomplete:
  - legacy `Provider` / `ProviderSchedule` / `Appointment` / `OPDVisit` / legacy clinical and billing records;
  - command-oriented `OpdDoctor` / `OpdEncounter` / `OpdVital` / `OpdNote` / `OpdEncounterPrescription` / `OpdCommandLog`.
- Existing OPD evidence itself states that dedicated OPD browser E2E and local PDF renderer verification were not completed.
- The current OpenAPI and controller expose both legacy provider/scheduling/visit routes and command-oriented encounter routes. This is not evidence of one canonical workflow.

## Required baseline verification

The following checks are required for the release and must be rerun after implementation changes. No current OPD release evidence is inferred from prior platform results:

```text
pnpm install --frozen-lockfile
pnpm --filter @vexel/api prisma:generate
pnpm check:sdk-freshness
pnpm lint
pnpm ui:color-lint
pnpm check:admin-openapi-parity
pnpm typecheck
pnpm build
pnpm --filter @vexel/api test
pnpm --filter @vexel/sdk test
```

## Baseline evidence sources

- `apps/api/src/opd/opd.controller.ts`
- `apps/api/src/opd/opd.service.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260225032214_opd_mvp_data_model/`
- `apps/api/prisma/migrations/20260326000100_opd_kmvp_module/`
- `apps/api/prisma/migrations/20260327000100_opd_mvp_doctor_profile_and_workflow/`
- `packages/contracts/openapi.yaml`
- `docs/_audit/opd/00_current_opd_truth.md`
- `docs/_audit/opd/09_runtime_verification.md`

## Baseline conclusion

OPD has reusable implementation, but it is not release-certified. Canonical consolidation, complete workflow coverage, current security/concurrency/document proof, browser verification, and deployment evidence remain required.
