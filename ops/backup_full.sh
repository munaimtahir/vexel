#!/usr/bin/env bash
# =============================================================================
# backup_full.sh — Vexel Full Backup
# Creates a timestamped package: DB dump + Caddy config + encrypted env + MinIO
# Output: /home/munaim/srv/apps/vexel/runtime/backups/full/vexel-full-YYYYMMDD_HHMMSS.tar.gz
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VEXEL_ROOT="${VEXEL_ROOT:-/home/munaim/srv/apps/vexel}"
LOG_DIR="$VEXEL_ROOT/runtime/data/logs"
BACKUP_DIR="$VEXEL_ROOT/runtime/backups/full"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
PKG_NAME="vexel-full-${TIMESTAMP}"
WORK_DIR="$VEXEL_ROOT/runtime/tmp/${PKG_NAME}"

mkdir -p "$LOG_DIR" "$BACKUP_DIR"
LOG_FILE="$LOG_DIR/backup_full_${TIMESTAMP}.log"

exec > >(tee -a "$LOG_FILE") 2>&1
echo "[$(date -Iseconds)] ===== Vexel Full Backup START ====="

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

error_exit() {
  echo "[$(date -Iseconds)] ERROR: $1" >&2
  exit 1
}

# --- 1. DB dump -----------------------------------------------------------
echo "[$(date -Iseconds)] Dumping PostgreSQL (vexel_pgdata)..."
mkdir -p "$WORK_DIR/db"
docker exec vexel-postgres-1 pg_dump \
  -U vexel -d vexel \
  --format=custom \
  --no-password \
  > "$WORK_DIR/db/vexel.dump" \
  || error_exit "pg_dump failed"
echo "[$(date -Iseconds)] DB dump: $(du -sh "$WORK_DIR/db/vexel.dump" | cut -f1)"

# --- 2. Caddy config ------------------------------------------------------
echo "[$(date -Iseconds)] Copying Caddy config..."
mkdir -p "$WORK_DIR/proxy"
cp "$VEXEL_ROOT/runtime/proxy/vexel.Caddyfile" "$WORK_DIR/proxy/vexel.Caddyfile"

# --- 3. Env file (encrypt with AES-256) -----------------------------------
echo "[$(date -Iseconds)] Encrypting env file..."
mkdir -p "$WORK_DIR/env"
if [ -f "$VEXEL_ROOT/.env" ]; then
  PASSPHRASE="${BACKUP_PASSPHRASE:-}"
  if [ -z "$PASSPHRASE" ]; then
    if [ "${NODE_ENV:-development}" = "production" ]; then
      error_exit "BACKUP_PASSPHRASE is required in production"
    fi
    echo "[$(date -Iseconds)] WARN: BACKUP_PASSPHRASE not set — using dev fallback"
    PASSPHRASE="dev-only-vexel-backup-passphrase"
  fi
  openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
    -pass "pass:$PASSPHRASE" \
    -in "$VEXEL_ROOT/.env" \
    -out "$WORK_DIR/env/.env.enc" \
    || error_exit "env encryption failed"
  echo "[$(date -Iseconds)] Env encrypted. Decrypt with: openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass pass:<passphrase> -in .env.enc -out .env"
fi

# --- 4. MinIO data (docker volume tarball) --------------------------------
echo "[$(date -Iseconds)] Archiving MinIO data volume..."
mkdir -p "$WORK_DIR/minio"
docker run --rm \
  -v vexel_minio_data:/minio_data:ro \
  -v "$WORK_DIR/minio":/backup \
  alpine:latest \
  tar czf /backup/minio_data.tar.gz -C /minio_data . \
  || error_exit "MinIO volume backup failed"
echo "[$(date -Iseconds)] MinIO archive: $(du -sh "$WORK_DIR/minio/minio_data.tar.gz" | cut -f1)"

# --- 5. docker-compose.yml snapshot ---------------------------------------
cp "$VEXEL_ROOT/docker-compose.yml" "$WORK_DIR/docker-compose.yml"

# --- 6. Manifest ----------------------------------------------------------
DB_SIZE=$(du -sh "$WORK_DIR/db/vexel.dump" | cut -f1)
MINIO_SIZE=$(du -sh "$WORK_DIR/minio/minio_data.tar.gz" | cut -f1)
cat > "$WORK_DIR/manifest.json" <<EOF
{
  "backup_type": "full",
  "timestamp": "$(date -Iseconds)",
  "hostname": "$(hostname)",
  "vexel_root": "$VEXEL_ROOT",
  "db": {
    "engine": "postgresql",
    "container": "vexel-postgres-1",
    "database": "vexel",
    "format": "pg_custom",
    "size": "$DB_SIZE"
  },
  "minio": {
    "volume": "vexel_minio_data",
    "size": "$MINIO_SIZE"
  },
  "env_encrypted": true,
  "caddy_config": "proxy/vexel.Caddyfile"
}
EOF

# --- 7. Package -----------------------------------------------------------
echo "[$(date -Iseconds)] Creating final archive..."
tar czf "$BACKUP_DIR/${PKG_NAME}.tar.gz" -C "$VEXEL_ROOT/runtime/tmp" "$PKG_NAME"
FINAL_SIZE=$(du -sh "$BACKUP_DIR/${PKG_NAME}.tar.gz" | cut -f1)

echo "[$(date -Iseconds)] ===== Backup COMPLETE ====="
echo "[$(date -Iseconds)] Package : $BACKUP_DIR/${PKG_NAME}.tar.gz"
echo "[$(date -Iseconds)] Size    : $FINAL_SIZE"
echo "[$(date -Iseconds)] Log     : $LOG_FILE"
