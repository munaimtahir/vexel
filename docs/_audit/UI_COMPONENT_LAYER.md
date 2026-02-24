# App Component Layer — Usage Rules

## Components

| Component | File | Usage |
|-----------|------|-------|
| `PageHeader` | `components/app/page-header.tsx` | Top of every page. `title` + optional `description` + `actions` slot. |
| `SectionCard` | `components/app/section-card.tsx` | Groups related content. Optional `title` + `actions`. Use `noPadding` for tables. |
| `StatCard` | `components/app/stat-card.tsx` | KPI numbers on dashboards. |
| `DataTable` | `components/app/data-table.tsx` | Any tabular list. `columns` + `data` + `keyExtractor`. `onRowClick` for row navigation. |
| `EmptyState` | `components/app/empty-state.tsx` | Zero-data state. Always include `title` + optional `description` + `action`. |
| `ErrorState` | `components/app/error-state.tsx` | API error state. `message` + optional `onRetry`. |
| `SkeletonPage` | `components/app/skeleton-page.tsx` | Loading state. Drop in while data fetches. |
| `ConfirmDialog` | `components/app/confirm-dialog.tsx` | Confirm before destructive commands (cancel encounter, etc.). |
| `EncounterStatusBadge` | `components/app/status-badge.tsx` | Encounter workflow status. |
| `DocumentStatusBadge` | `components/app/status-badge.tsx` | Document lifecycle status. |
| `DueBadge` | `components/app/status-badge.tsx` | Red badge when `dueAmount > 0`. |

## Rules
1. Every page MUST have a `<PageHeader>`.
2. Every page MUST handle loading, empty, and error states.
3. Never invent new status color systems — extend `status-badge.tsx`.
4. Never write `style={{}}` inline objects in new pages.
5. `DataTable` for all lists with >2 columns.
