#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${PLAYWRIGHT_MCP_OUTPUT_DIR:-$ROOT_DIR/.playwright-cli}"
RUNTIME_LIB_DIR="${PLAYWRIGHT_RUNTIME_LIB_DIR:-/tmp/pw-libs/usr/lib/x86_64-linux-gnu}"

mkdir -p "$OUT_DIR"

# If user-space runtime libs exist, preload them so Chromium can boot without sudo install-deps.
if [[ -d "$RUNTIME_LIB_DIR" ]]; then
  export LD_LIBRARY_PATH="$RUNTIME_LIB_DIR${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

exec pnpm exec playwright-mcp \
  --headless \
  --isolated \
  --output-dir "$OUT_DIR" \
  --output-mode stdout \
  --save-session \
  --save-trace \
  "$@"
