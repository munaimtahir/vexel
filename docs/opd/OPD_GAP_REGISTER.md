# OPD Gap Register

**Release decision:** `NOT READY`

| Area | Classification | Evidence / gap | Required closure evidence |
|---|---|---|---|
| Domain model | duplicate/obsolete | Legacy provider/appointment/visit models coexist with `OpdEncounter` runtime | Canonical decision, additive reconciliation, retired routes/tables or documented safe retirement |
| Contract | incomplete | OpenAPI exposes both OPD families and broad scaffold-era surfaces | Canonical contract, obsolete path removal, SDK regeneration and freshness pass |
| Registration | incomplete | Command registration exists, but complete duplicate/retry/concurrency proof is absent | Transactional command tests and browser workflow evidence |
| Intake/vitals | incomplete | Intake command exists; complete range validation, repeat history, role behavior, and signed-record protection are not proven | Unit/integration/E2E evidence |
| Consultation/notes | incomplete | Existing KMVP note path is not proven as a complete draft/sign/immutable/amendment lifecycle | Canonical commands, ownership tests, immutable/version evidence |
| Prescription | incomplete | Publish path exists; complete draft/sign/publish lifecycle and secure tenant retrieval are not release-proven | API, deterministic document, authorization, and browser evidence |
| Scheduling | incomplete | Provider schedules, availability, appointments, and visits remain reachable alongside encounter workflow | Retain and complete atomically, or remove from active scope with migration/boundary evidence |
| Billing | incomplete | Billing service/routes exist, but concurrent payment, void/correction/refund, and full audit proof are absent | Transaction/concurrency/billing test evidence |
| Documents | test-required | Existing audit records missing local PDF runtime verification and dedicated OPD E2E | Worker/PDF retry, payload/PDF hash, retrieval, and rendered-output evidence |
| Feature flags | incomplete | Existing flags contain scaffold/planned OPD keys and mixed naming history | Tenant-authoritative flag matrix and disabled-tenant tests |
| RBAC | insecure | Controller permissions are broad (`ENCOUNTER_MANAGE`, `MODULE_ADMIN`, `DOCUMENT_GENERATE`) and clinician ownership is not demonstrated end-to-end | Least-privilege role matrix and ownership denial tests |
| Tenant isolation | test-required | Service methods often accept tenant IDs, but complete relation/download/job isolation is not proven | Cross-tenant API, DB relation, document, and E2E tests |
| Admin | incomplete | Doctors/providers/schedules/flags pages exist; complete clinic, billing, templates, audit, and retry surfaces are not proven | Admin parity and authorization evidence |
| Operator | incomplete | OPD pages exist across both route families; complete canonical workflow and failure states are not proven | Canonical route inventory and browser E2E evidence |
| Migrations | migration-required | Three additive OPD migrations created parallel tables; no verified reconciliation/retirement migration exists. Sequence allocation was count-based before this sprint | Empty/representative DB migration and reconciliation tests; concurrent sequence evidence |
| Observability | operationally unready | OPD-specific job failure, retry, metrics, alert, and incident evidence is absent | Deployment/operations evidence and runbooks |
| Release evidence | incomplete | Prior OPD slice evidence explicitly says runtime proof is partial | Current OPD evidence set and `OPD_RELEASE_LEDGER.md` |
