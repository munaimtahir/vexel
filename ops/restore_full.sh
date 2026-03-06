#!/usr/bin/env bash
# =============================================================================
# restore_full.sh — Vexel Full Restore
# Restores from a full backup package created by backup_full.sh.
#
# Usage: ./restore_full.sh <backup_package.tar.gz> [--confirm]
#   --confirm   Skip the interactive prompt (for automation)
#
# WARNING: This will DROP and recreate the vexel database.
#          Run on a fresh VPS or before stack is live with real data.
# =============================================================================
set -euo pipefail

BACKUP_PKG="${1:-}"
CONFIRM="${2:-}"

if [ -z "$BACKUP_PKG" ]; then
  echo "Usage: $0 <path/to/vexel-full-YYYYMMDD_HHMMSS.tar.gz> [--confirm]" >&2
  exit 1
fi
if [ ! -f "$BACKUP_PKG" ]; then
  echo "ERROR: Backup file not found: $BACKUP_PKG" >&2
  exit 1
fi

VEXEL_ROOT="/home/munaim/srv/apps/vexel"
LOG_DIR="$VEXEL_ROOT/runtime/data/logs"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
WORK_DIR="/tmp/vexel-restore-${TIMESTAMP}"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/restore_full_${TIMESTAMP}.log"

exec > >(tee -a "$LOG_FILE") 2>&1
echo "[$(date -Iseconds)] ===== Vexel Full Restore START ====="
echo "[$(date -Iseconds)] Package: $BACKUP_PKG"

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

error_exit() {
  echo "[$(date -Iseconds)] ERROR: $1" >&2
  echo "[$(date -Iseconds)] Rollback: The database has NOT been touched if the error occurred before the DROP step." >&2
  exit 1
}

# Safety prompt
if [ "$CONFIRM" != "--confirm" ]; then
  echo ""
  echo "  !! WARNING: This will DROP the vexel database and restore from backup."
  echo "  !! All current data will be lost."
  echo ""
  read -r -p "  Type 'yes-restore' to proceed: " RESPONSE
  if [ "$RESPONSE" != "yes-restore" ]; then
    echo "Aborted."
    exit 0
  fi
fi

# --- 1. Extract package ---------------------------------------------------
echo "[$(date -Iseconds)] Extracting backup package..."
mkdir -p "$WORK_DIR"
tar xzf "$BACKUP_PKG" -C "$WORK_DIR" --strip-components=1 \
  || error_exit "Failed to extract backup package"

# Verify manifest exists
[ -f "$WORK_DIR/manifest.json" ] || error_exit "manifest.json not found in package — invalid backup"
echo "[$(date -Iseconds)] Manifest:"
cat "$WORK_DIR/manifest.json"
echo ""

# --- 2. Verify Docker stack is running ------------------------------------
echo "[$(date -Iseconds)] Checking Docker stack..."
docker inspect vexel-postgres-1 --format '{{.State.Status}}' 2>/dev/null | grep -q running \
  || error_exit "vexel-postgres-1 is not running. Start stack first: cd $VEXEL_ROOT && docker compose up -d postgres"

# --- 3. Restore database --------------------------------------------------
[ -f "$WORK_DIR/db/vexel.dump" ] || error_exit "DB dump not found in package"

echo "[$(date -Iseconds)] Dropping and recreating database..."
docker exec vexel-postgres-1 psql -U vexel postgres -c "DROP DATABASE IF EXISTS vexel;" \
  || error_exit "Failed to drop database"
docker exec vexel-postgres-1 psql -U vexel postgres -c "CREATE DATABASE vexel OWNER vexel;" \
  || error_exit "Failed to create database"

echo "[$(date -Iseconds)] Restoring DB from dump..."
cat "$WORK_DIR/db/vexel.dump" | docker exec -i vexel-postgres-1 pg_restore \
  -U vexel -d vexel --no-password --exit-on-error \
  || error_exit "pg_restore failed"
echo "[$(date -Iseconds)] Database restored."

# --- 4. Restore MinIO data ------------------------------------------------
if [ -f "$WORK_DIR/minio/minio_data.tar.gz" ]; then
  echo "[$(date -Iseconds)] Restoring MinIO volume..."
  docker run --rm \
    -v vexel_minio_data:/minio_data \
    -v "$WORK_DIR/minio":/backup:ro \
    alpine:latest \
    sh -c "rm -rf /minio_data/* && tar xzf /backup/minio_data.tar.gz -C /minio_data" \
    || error_exit "MinIO restore failed"
  echo "[$(date -Iseconds)] MinIO restored."
fi

# --- 5. Restore vexel.Caddyfile + re-link --------------------------------
if [ -f "$WORK_DIR/proxy/vexel.Caddyfile" ]; then
  echo "[$(date -Iseconds)] Restoring Caddy config..."
  mkdir -p "$VEXEL_ROOT/runtime/proxy"
  cp "$WORK_DIR/proxy/vexel.Caddyfile" "$VEXEL_ROOT/runtime/proxy/vexel.Caddyfile"

  # Ensure symlink in shared overrides
  ln -sf "$VEXEL_ROOT/runtime/proxy/vexel.Caddyfile" \
         /home/munaim/srv/proxy/caddy/overrides/vexel.Caddyfile

  # Reload Caddy via admin API
  CADDY_ADAPTED=$(caddy adapt --config /etc/caddy/Caddyfile 2>/dev/null)
  if [ $? -eq 0 ]; then
    echo "$CADDY_ADAPTED" | curl -sf -X POST \
      -H "Content-Type: application/json" \
      -d @- http://localhost:2019/load \
      && echo "[$(date -Iseconds)] Caddy reloaded." \
      || echo "[$(date -Iseconds)] WARN: Caddy reload failed — reload manually"
  fi
fi

# --- 6. Decrypt env file hint --------------------------------------------
if [ -f "$WORK_DIR/env/.env.enc" ]; then
  echo "[$(date -Iseconds)] Encrypted .env found in package."
  echo "[$(date -Iseconds)] To decrypt: openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass pass:<BACKUP_PASSPHRASE> -in .env.enc -out .env"
  echo "[$(date -Iseconds)] Then copy to: $VEXEL_ROOT/.env"
fi

echo ""
echo "[$(date -Iseconds)] ===== Restore COMPLETE ====="
echo "[$(date -Iseconds)] Restart app stack: cd $VEXEL_ROOT && docker compose up -d"
echo "[$(date -Iseconds)] Log: $LOG_FILE"
