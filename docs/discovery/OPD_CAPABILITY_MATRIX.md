# OPD capability matrix

Status is the highest state supported by current executable evidence.

| Capability | Schema | OpenAPI | SDK | Backend | Frontend | Navigation | Real Wiring | Persistence | Tests | Runtime | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Shared patient search/create | shared | yes | yes | yes | yes | registration | SDK | yes | page/API | passed | USABLE |
| Doctor master | yes | yes | yes | CRUD | Admin/picker | yes | SDK | yes | mock/route | GET 200 | USABLE |
| Clinic/department/specialty | strings | fields | yes | stored | Admin | doctor page | SDK | denormalized | none | not exercised | PARTIAL |
| Recurring schedules | yes | yes | yes | list/create | no | no | no | yes | mocked | not direct | BACKEND ONLY |
| Availability slots | derived | yes | yes | yes | no | no | no | reads appts | mocked | not direct | BACKEND ONLY |
| Appointment book/list | yes | yes | yes | yes | no | no | no | yes | no real DB | list 200 | BACKEND ONLY |
| Appointment commands | yes | yes | yes | malformed routes | no | no | no | intended | none | canonical paths absent | PARTIAL |
| Walk-in registration | yes/shared | yes | yes | command | form | yes | SDK | yes | browser | passed | USABLE with atomicity gap |
| Appointment registration link | relation | incomplete | incomplete | undocumented fields | no | no | no | possible | none | no | PARTIAL |
| Queue | yes | yes | yes | list/sort | no | broken link | no | read model | mocked | API 200 | BACKEND ONLY |
| Chief complaint/intake/vitals | yes | yes | yes | command | intake page | yes | SDK | yes | shallow browser | page loads | WIRED |
| Repeat vitals/history | capable | no | no | blocked by state | no | no | no | capable | none | no | SCHEMA ONLY |
| Consultation start | state | yes | yes | command | button | yes | SDK | yes | workflow unit | not full E2E | WIRED |
| Draft note | versioned | yes | yes | command | no | no | no | yes | none | no | BACKEND ONLY |
| Sign note | yes | yes | yes | command | combined action | yes | SDK | yes | mocked ownership | no full E2E | WIRED |
| Note amendment/approval | yes | yes | yes | commands | no | no | no | yes | mocked request | no | BACKEND ONLY |
| Free-text prescription | yes | yes | yes | runtime-broken | form | yes | SDK | intended | no integration | Prisma error | PARTIAL |
| Prescription immutable history | version fields | latest read | yes | overwrites design | no history UI | no | no | incorrect | none | no | PARTIAL |
| Encounter final/cancel | state | yes | yes | commands | no | no | no | yes | state unit | no | BACKEND ONLY |
| Invoice create/list/detail | shared | incompatible | yes | yes | pages | yes | `as any` | yes | mocks | API 200 | PARTIAL |
| Issue/void/pay/refund | shared | yes | yes | commands | partial stale UI | detail | wrong paths | yes | mocked | slash 404 | BACKEND ONLY |
| Consultation receipt PDF | shared doc | yes | yes | deterministic | broken button | detail | wrong path | yes | none | canonical API published | BACKEND ONLY |
| Prescription PDF | shared doc | yes | yes | intended | download intent | doctor | SDK | blocked | none | blocked | PARTIAL |
| OPD settings | yes | yes | yes | get/update | no | no | no | yes | mock usage | GET 200 | BACKEND ONLY |
| Tenant OPD flags | shared | yes | yes | partial enforcement | Admin/partial UI | yes | SDK | yes | no deny E2E | rows present | PARTIAL |
| LIMS/RIMS/procedure orders | no OPD link | no | no | no | no | no | no | no | none | no | ABSENT |
| Structured ICD diagnosis | free text | free text | yes | free text | note fields | limited | partial | yes | none | no | CONCEPT ONLY |
| Referral/follow-up workflow | strings | strings | yes | strings | incomplete | no | no | strings | none | no | CONCEPT ONLY |
| Visit summary/certificate | no | no | no | no | no | no | no | no | none | no | ABSENT |

Secondary approximations derived from these 29 rows: schema/shared persistence 24/29 (83%); contract/SDK 23/29 (79%, including drifted shapes); backend code 23/29 (79%); any frontend presence 12/29 (41%); plausibly wired without a known hard break 8/29 (28%); currently runtime-usable prerequisites/actions 6/29 (21%); any direct automated attention 8/29 (28%), mostly mock/page-presence; complete production-style OPD E2E 0/29 (0%).
