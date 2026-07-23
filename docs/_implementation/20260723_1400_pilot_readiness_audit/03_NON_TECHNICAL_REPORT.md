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

## What's needed before a pilot can start

In order:

1. **Turn the system back on** and confirm the address works and data is intact. (This is the blocking step — nothing else can be truly confirmed until this is done.)
2. **Finish the cash-handling piece**, if the pilot will involve taking payments through the system.
3. **Actually test the live, running system end-to-end** — walk through register → order → collect → result → verify → publish on the real address, not just on a developer's local machine (which is how all the prior "passed" test results were actually obtained, despite some notes implying otherwise).
4. **Add a safety net** so that future changes to the code are automatically checked before they can break things — right now that check has to be run by hand, which is how an outage like this can go unnoticed.
5. **Decide on scope** — is this a lab-only pilot, or does it include the outpatient module too? The outpatient piece is more ready than expected, so it's a genuine option, not just a "someday."

## Bottom line

The application itself — the actual software — is in noticeably better shape than the project's own documentation currently suggests, particularly for the outpatient module. The thing standing between "documented as live" and "actually usable by a pilot" isn't a mountain of unfinished features; it's that the lights are currently off, and a couple of specific, well-understood gaps (cash handling, live re-verification) need to be closed before flipping them back on with confidence.
