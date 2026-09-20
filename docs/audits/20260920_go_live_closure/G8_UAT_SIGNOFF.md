# G8 — Operator and verifier UAT sign-off

This sheet is intentionally unsigned until a real operator and a real verifier
complete the checks against the rotated credentials. It is the final human gate
for the LIMS pilot; it does not authorize importing the 329-test catalogue.

## Session details

| Field | Operator | Verifier |
|---|---|---|
| Name | ____________________ | ____________________ |
| Role / department | ____________________ | ____________________ |
| Date and time (UTC) | ____________________ | ____________________ |
| Deployment URL | `https://vexel.alshifalab.pk` | `https://vexel.alshifalab.pk` |
| Credential source | Approved secure channel | Approved secure channel |

## Required checks

The operator performs the first five checks. The verifier performs the final
three checks using the verifier account. Record the encounter code and document
ID in the notes column; do not paste passwords or tokens into this file.

| # | Check | Result | Notes / encounter or document ID |
|---|---|---|---|
| 1 | Sign in successfully and open the LIMS worklist. | ☐ Pass ☐ Fail | ____________________ |
| 2 | Register or find a patient, create an encounter, and order the approved demo test(s). | ☐ Pass ☐ Fail | ____________________ |
| 3 | Collect and receive the specimen; confirm the worklist shows the expected status. | ☐ Pass ☐ Fail | ____________________ |
| 4 | Enter a result, save it, and confirm the value remains visible after reload. | ☐ Pass ☐ Fail | ____________________ |
| 5 | Confirm the operator cannot access verifier-only actions without the verify permission. | ☐ Pass ☐ Fail | ____________________ |
| 6 | Sign in as verifier and find the submitted result in the verification queue. | ☐ Pass ☐ Fail | ____________________ |
| 7 | Verify the result; confirm the screen reports report progress and then a rendered/published report. | ☐ Pass ☐ Fail | ____________________ |
| 8 | Open/download the report and confirm patient identity, test name, result, units/range, and timestamp are correct. | ☐ Pass ☐ Fail | ____________________ |

## Sign-off

Overall result: ☐ ACCEPTED  ☐ REJECTED  ☐ ACCEPTED WITH ACTIONS

Open actions or clinical concerns:

______________________________________________________________________________

______________________________________________________________________________

Operator signature: ____________________  Date: ____________________

Verifier signature: ____________________  Date: ____________________

Lab director / owner approval: ____________________  Date: ____________________
