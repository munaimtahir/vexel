# Non-MVP Classification

| Module | Classification | Risk to MVP | Notes |
| ------ | -------------- | ----------- | ----- |
| OPD | FUTURE_NON_MVP | LOW | Present in code but gated. |
| Mobile | FUTURE_NON_MVP | NONE | Excluded from build. |
| Analytics | PLANNED | LOW | Placeholder components only. |

## Explicitly Excluded Non-MVP Routes
The following routes are present in the frontend applications as placeholders or dynamic links for future OPD capability, and are formally classified as `FUTURE_NON_MVP`. They are non-blocking for LIMS MVP validation:

1. **`DELETE /opd/providers/{providerId}`** (Admin App)
   - **Classification:** `FUTURE_NON_MVP`
   - **Status:** `COMPLETE`
   - **Notes:** Non-blocking for LIMS MVP. Gated on the frontend and not implemented in the backend API contract.
   
2. **`POST /opd/billing/invoices/{invoiceId}/payments`** (Operator App)
   - **Classification:** `FUTURE_NON_MVP`
   - **Status:** `COMPLETE`
   - **Notes:** Non-blocking for LIMS MVP. Gated on the frontend and not implemented in the backend API contract.
