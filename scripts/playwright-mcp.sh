#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${PLAYWRIGHT_MCP_OUTPUT_DIR:-$ROOT_DIR/.playwright-cli}"

mkdir -p "$OUT_DIR"

exec pnpm exec playwright-mcp \
  --headless \
  --isolated \
  --output-dir "$OUT_DIR" \
  --output-mode stdout \
  --save-session \
  --save-trace \
  "$@"
