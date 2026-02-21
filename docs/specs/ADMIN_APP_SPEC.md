# Admin App (Separate) — MVP Spec

## Purpose
Stop “building in a vacuum”. Admin app is your **Back Office** for:
- observing real data
- managing configuration
- troubleshooting
- safely running admin-only commands

## Admin App rules (locked)
1) Admin app may edit **config + reference data** only.
2) Admin app must not directly edit workflow state fields.
3) Any state change must call a **Command endpoint** (audited).
4) All actions are tenant-scoped unless super-admin.

## MVP pages (Admin App)
1) Dashboard
- tenant selector
- health: API/Worker/PDF
- last 20 audit events
- failed jobs count

2) Tenants
- create/edit tenant (name, domains, status)
- branding config placeholders (logo/header/footer)
- feature flags view

3) Users & Roles
- create user
- set roles, permissions
- branch/location access (if enabled)

4) Feature Flags
- enable/disable module.lims and sub-features

5) Catalog Admin
- manage tests, parameters, panels, mappings

6) Audit Explorer (read-only)
- filters: tenant/user/entity/action/correlationId
- view before/after JSON where available

7) Jobs & Failures (read-only + retry)
- list queues
- list failed jobs
- retry job (audited)

## Non-goals (MVP)
- no operator workflow in Admin app
- no result entry in Admin app
