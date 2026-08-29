# OPD Requirements Traceability

**Decision:** `NOT READY`
**Rule:** a requirement passes only with implementation, automated test, browser evidence, and deployment evidence.

| Requirement | Implementation | Automated | Browser | Deployment | Verdict |
|---|---|---|---|---|---|
| Canonical domain/legacy retirement | Canonical models active; duplicate billing repaired | partial | partial | destructive migration unproven | FAIL |
| Scheduling/queue/linkage | partial commands only | partial | none | none | FAIL |
| Registration/intake | implemented | unit partial | intake page smoke | API smoke | PARTIAL |
| Consultation/draft/sign | start/sign implemented; draft/ownership absent | state unit only | partial | partial | FAIL |
| Immutable amendments | absent | absent | absent | absent | FAIL |
| Prescription versions/publication | publication implemented; immutable versions absent | partial | incomplete | historical only | FAIL |
| Billing/refunds/corrections | create/issue/pay/void/receipt partial | focused unit partial | incomplete | registration/invoice smoke | FAIL |
| Tenant/RBAC/ownership | tenant filters and permissions partial | incomplete | super-admin only | incomplete | FAIL |
| Deterministic OPD documents | shared pipeline | general tests only | incomplete | incomplete | FAIL |
| Operator/Admin parity | basic pages | typecheck pending final | two basic OPD checks | incomplete | FAIL |
| Migration/rollback | destructive retirement migration | no representative reconciliation test | n/a | no rollback | FAIL |
| Full deployment/recovery | Compose exists | n/a | incomplete | existing-volume API only | FAIL |

See `OPD_GAP_REGISTER.md` for exact closure criteria.
