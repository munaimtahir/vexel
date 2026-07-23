#!/usr/bin/env bash
set -euo pipefail

# Must be run with sudo, e.g. sudo ./docker.sh
if [ "${EUID}" -ne 0 ]; then
  echo "Please run with sudo: sudo ./docker.sh"
  exit 1
fi

TARGET_USER="${SUDO_USER:-}"
if [ -z "$TARGET_USER" ]; then
  echo "Could not detect your normal user from SUDO_USER."
  echo "Run as: sudo ./docker.sh"
  exit 1
fi

echo "==> Enabling Docker access for user: $TARGET_USER"

# Ensure docker group exists
if ! getent group docker >/dev/null 2>&1; then
  groupadd docker
fi

# Add user to docker group (safe to run multiple times)
usermod -aG docker "$TARGET_USER"

echo "==> Done"
echo
echo "IMPORTANT: Group change applies after re-login or new shell group refresh."
echo "Run one of these as your normal user (NOT sudo):"
echo "  1) newgrp docker"
echo "  2) log out and log in again"
echo
echo "Verification command (normal user):"
echo "  docker ps"
