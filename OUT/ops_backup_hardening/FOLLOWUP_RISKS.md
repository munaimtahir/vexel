# Follow-up Risks

## 1. Scheduler execution is external (intentional)
- Risk: users may assume schedules auto-run inside platform.
- Current state: UI/docs now explicitly state schedule execution is external/manual.
- Follow-up: implement a dedicated scheduler executor only when product scope allows.

## 2. Non-local storage targets remain partial
- Risk: storage target records (S3/MinIO/others) can exist without full upload workflow.
- Current state: local persistent artifacts are operational; non-local execution remains limited.
- Follow-up: add explicit uploader/test execution path before declaring multi-target reliability.

## 3. Restore is code-present but disabled by default
- Risk: accidental enablement could allow destructive action if permission is granted.
- Current state: requires both `ops.restore` permission and `VEXEL_ALLOW_RESTORE=true`; script + API guards enforce fail-closed behavior.
- Follow-up: complete staging restore drill and formal sign-off process before any production enablement.

## 4. Existing historical runs may have stale artifact paths
- Risk: older run records created before retention cleanup may point to files that were manually moved/deleted.
- Current state: new retention cleanup updates run records when it purges artifacts.
- Follow-up: optional one-time reconciliation job for historical records.
