#!/usr/bin/env bash
# =============================================================================
# healthcheck.sh — Vexel Stack Health Check
# Verifies all containers, internal ports, and the public HTTPS endpoint.
# Exit 0 = all healthy. Exit 1 = one or more checks failed.
# =============================================================================
set -euo pipefail

VEXEL_ROOT="/home/munaim/srv/apps/vexel"
LOG_DIR="$VEXEL_ROOT/runtime/data/logs"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/healthcheck_${TIMESTAMP}.log"

PASS=0; FAIL=0

check() {
  local name="$1"; shift
  if "$@" > /dev/null 2>&1; then
    echo "  ✅  $name"
    ((PASS++)) || true
  else
    echo "  ❌  $name"
    ((FAIL++)) || true
  fi
}

echo "=== Vexel Stack Health Check — $(date) ===" | tee -a "$LOG_FILE"
echo ""

echo "--- Containers ---"
for CTR in vexel-api-1 vexel-worker-1 vexel-admin-1 vexel-operator-1 vexel-pdf-1 vexel-postgres-1 vexel-redis-1 vexel-minio-1; do
  STATE=$(docker inspect "$CTR" --format '{{.State.Status}}' 2>/dev/null || echo "missing")
  if [ "$STATE" = "running" ]; then
    echo "  ✅  $CTR (running)"
    ((PASS++)) || true
  else
    echo "  ❌  $CTR (${STATE})"
    ((FAIL++)) || true
  fi
done

echo ""
echo "--- Internal Ports ---"
check "API       :9021 /api/health"  curl -sf http://127.0.0.1:9021/api/health
check "PDF       :9022 /health/pdf"  curl -sf http://127.0.0.1:9022/health/pdf
check "Admin     :9023"              curl -sf -o /dev/null http://127.0.0.1:9023/admin
check "Operator  :9024"              curl -sf -o /dev/null http://127.0.0.1:9024
check "MinIO     :9027 /health"      curl -sf http://127.0.0.1:9027/minio/health/live
check "Postgres  :5433"              docker exec vexel-postgres-1 pg_isready -U vexel
check "Redis     :6380"              docker exec vexel-redis-1 redis-cli ping

echo ""
echo "--- Public HTTPS ---"
check "https://vexel.alshifalab.pk/api/health" curl -sf https://vexel.alshifalab.pk/api/health
check "https://vexel.alshifalab.pk/admin"      curl -sf -o /dev/null https://vexel.alshifalab.pk/admin
check "https://vexel.alshifalab.pk/ (operator)" curl -sf -o /dev/null https://vexel.alshifalab.pk/

echo ""
echo "--- Caddy ---"
check "Caddy validate"  caddy validate --config /etc/caddy/Caddyfile

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ===" | tee -a "$LOG_FILE"

if [ "$FAIL" -gt 0 ]; then
  echo "HEALTH CHECK FAILED" | tee -a "$LOG_FILE"
  exit 1
fi
echo "HEALTH CHECK PASSED" | tee -a "$LOG_FILE"
