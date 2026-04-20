# OpenAPI Delta (OPD MVP lock)

## Canonical contract updates
- Added command endpoints:
  - `/opd/commands/finalizeEncounter`
  - `/opd/commands/cancelEncounter`
  - `/opd/commands/generateReceipt`
- Added encounter receipt read/download endpoints:
  - `GET /opd/encounters/{encounterId}/receipt`
  - `GET /opd/encounters/{encounterId}/receipt/file`
- OPD encounter status schema locked to:
  - `DRAFT | READY_FOR_PRINT | COMPLETED | CANCELLED`
- OPD doctor schemas expanded for print identity:
  - designation, degrees, PMDC/PHC, clinic fields, signature metadata.

## SDK regeneration
- Regenerated `packages/sdk/src/generated/api.d.ts`.
- Verified generated operations include:
  - `generateOpdEncounterReceiptCommand`
  - `getOpdEncounterReceiptDocument`
  - `downloadOpdEncounterReceiptFile`

## Notes
- Contract remains command-first for OPD workflow mutations.
- No frontend ad-hoc payloads introduced; SDK surface reflects canonical OpenAPI.
