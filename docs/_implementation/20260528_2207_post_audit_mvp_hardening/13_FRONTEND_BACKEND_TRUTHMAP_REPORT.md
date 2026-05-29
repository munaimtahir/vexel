# Frontend-Backend Truthmap Report

This report confirms the mapping between frontend components and backend services:

- All active operator views use the generated `@vexel/sdk` package for data access and workflow action execution.
- No direct `fetch` or `axios` bypasses are active in LIMS MVP views.
- Contract-first OpenAPI validation passes.
- Admin UI pages have zero direct database access (they communicate only via NestJS endpoints).
