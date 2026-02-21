#!/usr/bin/env bash
# CI: Fail if openapi.yaml has changed but SDK types are stale.
# Usage: Run in CI after any PR that modifies packages/contracts/openapi.yaml

set -euo pipefail

OPENAPI="packages/contracts/openapi.yaml"
SDK_TYPES="packages/sdk/src/generated/api.d.ts"

# Check if openapi.yaml changed in this PR/commit
if git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -q "$OPENAPI"; then
  echo "⚠️  openapi.yaml changed — verifying SDK is regenerated..."

  # Regenerate
  pnpm sdk:generate

  # Check if generated file differs from committed
  if ! git diff --quiet "$SDK_TYPES"; then
    echo "❌ SDK types are stale. Run 'pnpm sdk:generate' and commit the result."
    exit 1
  fi

  echo "✅ SDK is up to date."
fi
