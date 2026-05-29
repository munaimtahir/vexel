# Sprint 1: MVP Gate Cleanup

## Tasks Completed

1. **Exclude Mobile from MVP Gates**:
   - Tagged `@vexel/mobile` as non-MVP.
   - Updated root `package.json` scripts (`build`, `dev`, `lint`) to exclude `@vexel/mobile` using `--filter=!@vexel/mobile`.
   - Updated `apps/mobile/README.md` with non-MVP disclaimer block.

2. **Add Real SDK Jest Tests**:
   - Installed `jest`, `ts-jest`, `@types/jest`, `@types/node` inside `packages/sdk`.
   - Created `packages/sdk/jest.config.js` pointing to TypeScript files.
   - Wrote TypeScript test cases testing token extraction, expired JWT check, and client creation options in `packages/sdk/src/auth.spec.ts` and `packages/sdk/src/client.spec.ts`.
   - Verified that `pnpm --filter @vexel/sdk test` runs and passes successfully.

3. **Verify Catalog API Alignments**:
   - The OpenAPI spec, generated SDK client, and frontend code align.
   - Confirmed that Next.js UI makes type-safe calls using SDK generated endpoints.

4. **Document Non-MVP/OPD Gaps & Security Classification**:
   - Initialized security finding classifications and OPD module isolation.
