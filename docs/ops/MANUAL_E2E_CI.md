# Manual E2E Smoke & Release CI Workflow

This repository contains a manual-only GitHub Actions workflow to run full monorepo sanity checks and release gate validations before production deployments.

## How to Trigger the Workflow

1. Open the repository on GitHub.
2. Navigate to the **Actions** tab.
3. In the sidebar, select **Manual E2E Smoke and Release CI**.
4. Click the **Run workflow** dropdown on the right.
5. Provide a brief reason for the execution (e.g. "Post-sprint release verification").
6. Click the green **Run workflow** button.

## Key Exclusions

- **Excluded from push/PR**: This workflow will *never* run automatically on standard git push or pull requests. It must be manually dispatched.
- **Mobile app exclusion**: Excludes `@vexel/mobile` from linting and compilation scopes to ensure it does not block the LIMS web platform MVP release gates.
