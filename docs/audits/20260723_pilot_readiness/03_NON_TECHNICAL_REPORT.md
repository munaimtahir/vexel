# Vexel — What It Is, What's Built, and What's Left (Plain-Language Report)

**For:** anyone deciding whether/when to pilot Vexel, without needing a technical background.
**Date:** 2026-07-23

---

## What is Vexel?

Vexel is a software system for running a clinical laboratory (a "LIMS" — Laboratory Information Management System). It's being built so that later it can also handle outpatient clinic visits (OPD), and eventually other hospital departments, without having to be rebuilt from scratch.

It's designed for multiple separate organizations ("tenants") to use the same system while keeping their data completely separate — the equivalent of one building with fully soundproofed, separately locked offices, not open-plan.

The core lab workflow it supports:

1. **Register a patient** and record their basic details.
2. **Order tests** for that patient (blood work, etc.).
3. **Collect the specimen** (draw blood, take a swab).
4. **Enter results** for each test.
5. **Verify** the results (a second, more senior person checks and signs off).
6. **Publish a report** — a PDF document the patient/clinic can download, generated automatically once results are verified.

There are two separate apps people interact with:
- The **Operator app** — used by lab staff day-to-day (registration, collection, results, verification).
- The **Admin app** — used by whoever manages the system (setting up which tests are offered, managing staff accounts and permissions, configuring each organization, viewing audit trails).

---

## What's actually built

The good news: **the core lab workflow described above is genuinely built**, on both the technical "engine room" (the server) and the two apps people use. This isn't a rough prototype — it follows a strict, disciplined set of internal rules (data always tagged to the right organization, every change to a patient's case logged for audit, documents generated the same way every time so they can be trusted) and those rules were checked in the code, not just assumed.

There's also a written-off "future module" for outpatient clinic visits (OPD — doctor visits, appointments, prescriptions, billing) that turns out to be **much further along than the project's own notes suggested** — it has real, working screens and is wired up properly, even though nobody had previously flagged it as ready.

A automated test suite exists and, where it was run during this review, passed (210 automated checks on the server side, all green).

## What's built but not fully finished

A few pieces exist as data/structure but the actual working logic behind them is incomplete:
- **Handling cash payments at the lab counter** — the plumbing for it exists, but the piece of code that actually does the work appears to be missing. If a pilot needs to take payments directly through the system, this needs to be finished first.
- **The internal activity/log viewer** — exists as a screen, but it's not clear yet where its data is actually coming from. Worth checking before relying on it.
- A little bit of duplicated, half-cleaned-up internal structure around the outpatient module (harmless today, but untidy — like having two draft copies of a filing system that were never merged into one).

## The single biggest issue: it's not currently switched on

This is the most important finding of this review. The project's own notes say the system is "live" at a public web address. **It is not.** The technical services that make the app work were stopped about seven weeks ago and never restarted, and the address itself has since been removed from the server's routing configuration — so right now, nobody could open the app even if they tried.

The reassuring part: the underlying data storage appears to still be intact and untouched. This looks like an operational oversight (something got switched off and nobody was watching for it), not data loss or a code failure. Turning it back on is expected to be straightforward, not a rebuild.

There's also currently **no automatic alarm** that would have caught this outage — nothing was watching the site and flagging that it had gone dark for seven weeks. That's worth fixing regardless of pilot timing.

## What "fully pilot-ready" now means (scope confirmed after this review)

Three things were added to the requirement after the first pass of this review:

1. **The entire patient journey must work, live, all the way to a printed report in someone's hand** — not just "the code exists for it." Every step (register, order, collect specimen, enter results, verify, publish, and physically print the report) needs to be walked through on the real running system, twice, for two different client organizations, before anyone calls it pilot-ready.
2. **The backup system needs to be proven, not assumed.** The code for taking backups and restoring from them already exists, but nobody has confirmed a backup was actually taken and could actually be restored. That needs to be tested for real before a pilot starts trusting the system with real patient data. If testing turns up a real gap (most likely: nothing currently runs backups automatically on a schedule), that gets built.
3. **A set of day-to-day management reports needs to be built — this is new work, not a fix.** Right now the system can show a list of *finished, published* reports, but a lab manager can't yet ask the system things like: "What's this patient's full history with us?", "How many patients did we register last Tuesday?", "Which patients are still waiting on results right now?", or "What's the status of receipt #1234?" These are genuinely useful, expected features for running a lab day-to-day, and they don't exist yet in this form. This should be built once the core patient journey above is proven to work, not before.

## What's needed before a pilot can start

In order:

1. **Turn the system back on** and confirm the address works and data is intact. (This is the blocking step — nothing else can be truly confirmed until this is done.)
2. **Finish the cash-handling piece**, since it sits directly in the patient-cycle path (most labs collect payment at registration or reporting).
3. **Walk the complete patient cycle live, twice, on two different client organizations, ending in an actual printed report** — not just tested on a developer's own machine (which is how all the prior "passed" test results were actually obtained, despite some notes implying otherwise).
4. **Prove the backup system actually works** by taking a real backup and actually restoring from it, then make sure backups run automatically on a schedule.
5. **Build the missing day-to-day reports** (patient history, registration counts by date, worklist by status, receipt status lookup) — once step 3 confirms the core system is solid underneath them.
6. **Add a safety net** so that future changes to the code are automatically checked before they can break things — right now that check has to be run by hand, which is how an outage like this went unnoticed for seven weeks.
7. **Confirm final scope** — this pilot is being planned as the lab (LIMS) system in full. The outpatient clinic module is further along than expected and could be added later, but it's being kept out of this pilot unless there's a specific reason to include it.

## Bottom line

The application itself — the actual software — is in noticeably better shape than the project's own documentation currently suggests, particularly for the outpatient module. What's now required for "pilot-ready" is more complete than the original review assumed: it's not enough for each piece to exist in code — the full patient journey has to be proven working end-to-end including the printed report, the backup system has to be proven (not just present), and a handful of everyday management reports that don't exist yet need to be built. None of this is a mountain of unfinished work, but it is real, sequenced work — turning the lights back on is step one, not the whole job.
