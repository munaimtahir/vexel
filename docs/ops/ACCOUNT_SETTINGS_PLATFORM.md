# Account / Settings Platform Pattern

## Scope
- Universal self-service account pattern for all authenticated users.
- Works across Operator and Admin apps.
- Module-agnostic by design (LIMS, OPD, future RAD/IPD).

## API Contract
- `GET /account/me`
- `PATCH /account/me`
- `POST /account/change-password`
- `GET /admin/navigation`
- `GET /admin/landing`

## Permissions
- Self-service:
  - `account.profile.read-self`
  - `account.profile.update-self`
  - `account.password.change-self`
- Admin app shell:
  - `admin.app.access`
  - `admin.dashboard.read`
  - `admin.audit.read`
  - `admin.jobs.read`
  - `admin.jobs.retry`
  - `admin.users.read`
  - `admin.users.write`
  - `admin.roles.read`
  - `admin.roles.write`
  - `admin.tenants.read`
  - `admin.tenants.write`
  - `admin.feature_flags.read`
  - `admin.feature_flags.write`
  - `admin.catalog.read`
  - `admin.catalog.write`

## Landing Behavior
- If user has `admin.app.access` or any `admin.*` permission:
  - landing is first permitted route from deterministic priority:
  - `/dashboard`, `/catalog`, `/audit`, `/jobs`, `/users`, `/roles`, `/tenants`, `/feature-flags`
- Otherwise:
  - landing is `/account` (self-service safe page)

## Reuse Guidance
- Future modules should keep account self-service under platform routes (`/account/*`), not module-specific routes.
- Sidebar/account affordances should remain visible for all authenticated users.
- Admin shell must continue capability-driven rendering to avoid dead links.
