# Vexel Mobile Android Setup (Ubuntu)

This guide assumes a fresh Ubuntu machine and no preinstalled mobile tooling.

## 1) Node.js + package manager

Install Node.js 20 LTS (recommended for this repo; baseline is 18+), then verify:

```bash
node -v
npm -v
```

This repo uses `pnpm` at workspace level. Install and verify:

```bash
npm i -g pnpm
pnpm -v
```

If you prefer npm for only this app, that also works.

Note: Expo SDK 55 in this app may fail on older Node 18 builds (for example 18.19.x). If startup fails, switch to Node 20 LTS.

## 2) Install app dependencies + Expo tooling

Global Expo install is optional. Preferred usage is `npx expo`.

```bash
cd apps/mobile
pnpm install
# or: npm install
```

Start Metro:

```bash
npx expo start
```

Optional global CLI (only if you need it):

```bash
npm i -g expo-cli
```

## 3) Android Studio + SDK + Emulator (Ubuntu)

### A) Install Android Studio

```bash
sudo snap install android-studio --classic
```

### B) Install required SDK components in Android Studio

Open Android Studio once, then install:
- Android SDK Platform (latest stable)
- Android SDK Build-Tools
- Android Emulator
- Android SDK Platform-Tools

### C) Set Android environment variables

Add to `~/.bashrc` (or `~/.zshrc`):

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
```

If `cmdline-tools/latest` is missing, use your actual folder path, for example:
`$ANDROID_HOME/cmdline-tools/bin` or `$ANDROID_HOME/cmdline-tools/<version>/bin`.

Reload shell:

```bash
source ~/.bashrc
# or: source ~/.zshrc
```

### D) Verify Android tooling

```bash
adb version
emulator -version
```

### E) Create an emulator (AVD)

In Android Studio:
1. Open `Device Manager`
2. Click `Create Device`
3. Choose a Pixel device
4. Select a stable x86_64 system image
5. Finish and start the emulator

### F) Run app on emulator

From `apps/mobile`:

```bash
npx expo start
```

Then press `a` in the Expo terminal to open Android emulator.

## 4) Physical Android phone via USB (fallback)

1. On phone, enable `Developer options`.
2. Enable `USB debugging`.
3. Connect phone with a USB data cable.
4. Verify device:

```bash
adb devices
```

5. Run app:

```bash
npx expo start
```

Press `a` to target Android device, or scan QR with Expo Go.

Troubleshooting:
- `unauthorized` in `adb devices`: accept RSA fingerprint prompt on phone.
- No device listed:
  - try another cable/USB port
  - run:

```bash
adb kill-server
adb start-server
adb devices
```

## 5) Expo Go (fast sanity check)

1. Install `Expo Go` from Play Store.
2. Start project:

```bash
cd apps/mobile
npx expo start
```

3. Scan the QR code from Expo terminal.

Use Expo Go for fast functional checks. Production/release builds should use EAS.

## 6) Native build dependencies (only when required)

For libraries requiring custom native modules, use EAS:

```bash
npm i -g eas-cli
eas login
```

For v0, prefer Expo Go-compatible libraries to avoid requiring native builds.

## 7) App config dependency

App API base URL config is in:
- `src/config/env.ts` (`API_BASE_URL` default: `https://lims.alshifalab.pk`)

Note: API base URL should become tenant-domain based later.

## 8) Common failure modes and fixes

- `SDK location not found`
  - `ANDROID_HOME` is missing/wrong; fix env vars and reload shell.
- `adb: command not found`
  - add `$ANDROID_HOME/platform-tools` to `PATH`.
- Emulator is very slow
  - enable virtualization (KVM) in BIOS and on Ubuntu:

```bash
sudo apt update
sudo apt install -y qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils
sudo usermod -aG kvm,libvirt $USER
```

Log out/in, then start emulator again.

- Expo `Network response timed out`
  - ensure phone and PC are on same Wi-Fi.
  - if network is restricted, use USB debugging + `adb devices` and run through Android target.
