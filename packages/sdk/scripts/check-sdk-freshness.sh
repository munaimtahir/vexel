#!/usr/bin/env bash
# CI: Fail if openapi.yaml has changed but SDK types are stale.
# Usage: Run in CI after any PR that modifies packages/contracts/openapi.yaml

set -euo pipefail

OPENAPI="packages/contracts/openapi.yaml"
SDK_TYPES="packages/sdk/src/generated/api.d.ts"
BASE_REF="${GITHUB_BASE_REF:-main}"
DIFF_RANGE="origin/${BASE_REF}...HEAD"

# Ensure base branch exists locally for PR range diff
if ! git rev-parse --verify "origin/${BASE_REF}" >/dev/null 2>&1; then
  git fetch --no-tags --prune origin "${BASE_REF}:${BASE_REF}" || git fetch --no-tags --prune origin "${BASE_REF}"
fi

if ! git rev-parse --verify "origin/${BASE_REF}" >/dev/null 2>&1; then
  DIFF_RANGE="HEAD~1...HEAD"
fi

# Check if openapi.yaml changed in this PR range
if git diff --name-only "${DIFF_RANGE}" 2>/dev/null | grep -q "^${OPENAPI}$"; then
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
