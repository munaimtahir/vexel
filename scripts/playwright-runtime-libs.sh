#!/usr/bin/env bash
set -euo pipefail

LIB_ROOT="${PLAYWRIGHT_RUNTIME_LIB_DIR:-/tmp/pw-libs}"
DEB_DIR="$LIB_ROOT/debs"
LIB_DIR="$LIB_ROOT/usr/lib/x86_64-linux-gnu"

PACKAGES=(
  libnspr4
  libnss3
  libatk1.0-0t64
  libatk-bridge2.0-0t64
  libatspi2.0-0t64
  libxdamage1
  libasound2t64
)

mkdir -p "$DEB_DIR"

if ! command -v apt >/dev/null 2>&1; then
  echo "apt is not available; cannot bootstrap Playwright runtime libs." >&2
  exit 1
fi

echo "Downloading Playwright runtime libs into: $DEB_DIR"
(
  cd "$DEB_DIR"
  apt download "${PACKAGES[@]}" >/dev/null
)

echo "Extracting runtime libs into: $LIB_ROOT"
for deb in "$DEB_DIR"/*.deb; do
  dpkg-deb -x "$deb" "$LIB_ROOT"
done

echo "Playwright runtime libs ready at: $LIB_DIR"
