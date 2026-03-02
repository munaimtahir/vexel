#!/usr/bin/env bash
set -euo pipefail

TRANSFER_BRANCH="${TRANSFER_BRANCH:-transfer/new-server-artifacts}"
TMP_TGZ="/tmp/vexel-ignored-lite.tgz"

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git is not installed."
  exit 1
fi

if ! command -v tar >/dev/null 2>&1; then
  echo "ERROR: tar is not installed."
  exit 1
fi

if ! command -v sha256sum >/dev/null 2>&1; then
  echo "ERROR: sha256sum is not installed."
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: Working tree is not clean. Commit/stash first."
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"

echo "==> Fetching transfer branch: $TRANSFER_BRANCH"
git fetch origin "$TRANSFER_BRANCH"

echo "==> Switching to transfer branch"
git checkout "$TRANSFER_BRANCH"

if [[ ! -f transfer/artifacts/SHA256SUMS ]]; then
  echo "ERROR: Missing transfer/artifacts/SHA256SUMS in $TRANSFER_BRANCH"
  git checkout "$CURRENT_BRANCH"
  exit 1
fi

echo "==> Verifying artifact chunk checksums"
sha256sum -c transfer/artifacts/SHA256SUMS

echo "==> Rebuilding archive from chunks"
cat transfer/artifacts/vexel-ignored-lite.tgz.part-* > "$TMP_TGZ"

echo "==> Extracting archive into repository root"
tar -xzf "$TMP_TGZ" -C .
rm -f "$TMP_TGZ"

echo "==> Returning to branch: $CURRENT_BRANCH"
git checkout "$CURRENT_BRANCH"

echo
echo "Artifact restore complete."
echo "Included: ignored files pack excluding node_modules and .env."
echo "Next: run 'pnpm install --frozen-lockfile' to regenerate node_modules."
