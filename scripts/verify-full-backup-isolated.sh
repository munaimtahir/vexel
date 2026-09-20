#!/usr/bin/env bash
# Verify a full Vexel backup on a disposable PostgreSQL target.
# This never connects to the live compose network or volumes.
set -euo pipefail

BACKUP_PKG="${1:-}"
if [[ -z "$BACKUP_PKG" || ! -f "$BACKUP_PKG" ]]; then
  echo "Usage: $0 <vexel-full-YYYYMMDD_HHMMSS.tar.gz>" >&2
  exit 1
fi

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/vexel-isolated-restore.XXXXXX")"
CONTAINER="vexel-isolated-restore-$$"
cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

echo "[1/5] Extracting backup package"
tar xzf "$BACKUP_PKG" -C "$WORK_DIR" --strip-components=1
test -s "$WORK_DIR/manifest.json"
test -s "$WORK_DIR/db/vexel.dump"
test -s "$WORK_DIR/minio/minio_data.tar.gz"

echo "[2/5] Validating manifest and object-storage archive"
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync(process.argv[1])); if (!m || !m.timestamp || m.backup_type !== 'full') process.exit(1); console.log(JSON.stringify({timestamp:m.timestamp, backupType:m.backup_type, database:m.db?.database ?? null}));" "$WORK_DIR/manifest.json"
tar tzf "$WORK_DIR/minio/minio_data.tar.gz" >/dev/null

echo "[3/5] Starting disposable PostgreSQL target"
docker run -d --rm --name "$CONTAINER" \
  -e POSTGRES_USER=vexel \
  -e POSTGRES_PASSWORD=isolated-proof-only \
  -e POSTGRES_DB=vexel \
  -v "$WORK_DIR/db":/backup:ro \
  postgres:16-alpine >/dev/null
until docker exec "$CONTAINER" pg_isready -U vexel -d vexel >/dev/null 2>&1; do sleep 1; done

echo "[4/5] Restoring database dump into disposable target"
docker exec "$CONTAINER" pg_restore -U vexel -d vexel --no-owner --exit-on-error /backup/vexel.dump >/dev/null

echo "[5/5] Checking restored records"
docker exec "$CONTAINER" psql -U vexel -d vexel -Atc \
  "SELECT json_build_object('tenants',(SELECT count(*) FROM tenants),'patients',(SELECT count(*) FROM patients),'encounters',(SELECT count(*) FROM encounters),'documents',(SELECT count(*) FROM documents));"
echo "Isolated full-backup restore PASS"
