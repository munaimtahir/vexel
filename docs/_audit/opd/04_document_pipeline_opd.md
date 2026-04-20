# OPD Document Pipeline

## Implemented OPD document outputs
- OPD prescription (`OPD_PRESCRIPTION`)
- OPD invoice/consultation receipt (`OPD_INVOICE_RECEIPT`)

## Deterministic integration
- Documents generated through shared `DocumentsService.generateDocument(...)`.
- Source binding uses OPD encounter (`sourceType: OPD_ENCOUNTER`, `sourceRef: encounterId`).
- Payload includes explicit template/version identifiers for OPD slice.

## Prescription format alignment
- OPD prescription payload maps doctor profile identity fields dynamically:
  - name, degrees, designation, PMDC/PHC, clinic name/address, signature metadata.
- Rendering logic updated to support OPD prescription/receipt keys in PDF service.

## Receipt retrieval
- Encounter-level receipt metadata/file endpoints added to contract + controller/service:
  - `GET /opd/encounters/{encounterId}/receipt`
  - `GET /opd/encounters/{encounterId}/receipt/file`

## Validation status
- Contract and SDK include receipt operations.
- Local .NET runtime unavailable in this environment; PDF binary compile/render verification remains environment-blocked.
