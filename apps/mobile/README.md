# Vexel Mobile (Expo)

Quickstart (Ubuntu):

```bash
cd apps/mobile
node -v
npm -v
pnpm -v
pnpm install
# or: npm install
npx expo start
```

Use Node 20 LTS for Expo SDK 55 compatibility in this app.

Run targets:
- Android emulator (preferred): start emulator, then press `a` in Expo terminal.
- USB Android device (fallback): enable USB debugging, confirm with `adb devices`, then press `a`.
- Expo Go (fast sanity check): install Expo Go and scan QR from `npx expo start`.

Full setup guide:
- [SETUP_ANDROID.md](./SETUP_ANDROID.md)

Quality checks:

```bash
pnpm --filter @vexel/mobile lint
pnpm --filter @vexel/mobile typecheck
```
