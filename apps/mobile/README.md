# Vexel Mobile (Expo)

New Expo React Native app scaffold for Vexel Health v0 in mock mode.

## Run

```bash
pnpm --filter @vexel/mobile start
pnpm --filter @vexel/mobile android
pnpm --filter @vexel/mobile ios
pnpm --filter @vexel/mobile web
```

## Quality checks

```bash
pnpm --filter @vexel/mobile lint
pnpm --filter @vexel/mobile typecheck
```

## Route map

- `/` -> Home dashboard tiles (LIMS, OPD)
- `/(auth)/login` -> Demo login screen
- `/lims/status` -> LIMS status placeholder with mock stats
- `/opd/dashboard` -> OPD dashboard placeholder

## Theme and shared UI

- `src/theme/colors.ts` -> NeoSlate + Ember color tokens
- `src/theme/spacing.ts` -> spacing + radius tokens
- `src/components/StatCard.tsx` -> reusable stat card

## API layer stub

- `src/config/settings.ts` keeps tenant API base URL explicit and changeable.
- Default app setting is `https://lims.alshifalab.pk` from `app.json` (`expo.extra.defaultApiBaseUrl`).
- `src/api/client.ts` exposes:
  - `getLimsStatusMock()`
  - `getOpdStatusMock()`

These are mock-only right now and include TODOs to switch to generated OpenAPI SDK calls in v1.

## TODO checklist (v1 integration)

- [ ] Generate and wire mobile-safe OpenAPI SDK client package.
- [ ] Replace `getLimsStatusMock()` with SDK-backed calls.
- [ ] Replace `getOpdStatusMock()` with SDK-backed calls.
- [ ] Add auth token storage/refresh integration using shared auth contract.
- [ ] Add tenant/base URL settings screen and persist selected value.
- [ ] Add React Query for caching/loading/error states around SDK calls.
- [ ] Add module feature-flag fetch and gate OPD visibility from backend.
