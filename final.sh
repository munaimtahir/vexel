#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/munaim/srv/apps/vexel"
DOMAIN="https://vexel.alshifalab.pk"
LOCAL_API="http://127.0.0.1:9021"
ADMIN_EMAIL="admin@vexel.pk"
ADMIN_PASS="admin123"
TARGET_USER="munaim"

echo "==> [1/6] Fixing Caddy log permissions"
sudo mkdir -p /var/log/caddy
sudo touch /var/log/caddy/mediq.log
sudo chown -R caddy:caddy /var/log/caddy
sudo chmod 750 /var/log/caddy
sudo chmod 640 /var/log/caddy/mediq.log

echo "==> [2/6] Reloading and restarting Caddy"
sudo systemctl daemon-reload
sudo systemctl restart caddy
sudo systemctl status caddy --no-pager -l | sed -n '1,20p'

echo "==> [3/6] Ensuring docker group access"
if ! getent group docker >/dev/null 2>&1; then
  sudo groupadd docker
fi
sudo usermod -aG docker "$TARGET_USER"

echo "==> [4/6] Running resume + smokes in docker group shell"
newgrp docker <<'EOF2'
set -euo pipefail

APP_DIR="/home/munaim/srv/apps/vexel"
DOMAIN="https://vexel.alshifalab.pk"
LOCAL_API="http://127.0.0.1:9021"
ADMIN_EMAIL="admin@vexel.pk"
ADMIN_PASS="admin123"

cd "$APP_DIR"

echo "==> Verify docker access"
docker ps >/dev/null

echo "==> Resume stack"
chmod +x scripts/new-server-resume.sh
./scripts/new-server-resume.sh

echo "==> Smoke checks"
code_local=$(curl -sS -o /tmp/vx_local.out -w '%{http_code}' "$LOCAL_API/api/health" || true)
code_pub=$(curl -sS -o /tmp/vx_pub.out -w '%{http_code}' "$DOMAIN/api/health" || true)
code_root=$(curl -sS -o /tmp/vx_root.out -w '%{http_code}' "$DOMAIN/" || true)
code_auth=$(curl -sS -o /tmp/vx_auth.out -w '%{http_code}' -X POST "$DOMAIN/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" || true)

docker_status="PASS"
local_status="FAIL"
public_status="FAIL"
auth_status="FAIL"

[ "$code_local" = "200" ] && local_status="PASS"
if [ "$code_pub" = "200" ] && { [ "$code_root" = "200" ] || [ "$code_root" = "307" ] || [ "$code_root" = "308" ]; }; then
  public_status="PASS"
fi
[ "$code_auth" = "200" ] && auth_status="PASS"

echo
echo "Git sync: SKIP"
echo "Transfer artifact restore: SKIP"
echo "Dependency install: SKIP"
echo "Docker stack bring-up: $docker_status"
echo "Local smoke endpoints: $local_status"
echo "Public domain smoke endpoints: $public_status"
echo "Auth smoke: $auth_status"

if [ "$local_status" = "FAIL" ] || [ "$public_status" = "FAIL" ] || [ "$auth_status" = "FAIL" ]; then
  echo "If FAIL: root cause + exact fix + rerun status"
  echo "root cause: One or more smoke endpoints returned non-200/redirect or were unreachable."
  echo "exact fix: inspect compose + caddy logs below."
  echo "rerun status: PARTIAL FAIL"
  docker compose ps || true
  docker compose logs --tail=300 api worker admin operator pdf minio || true
  sudo journalctl -u caddy -n 300 --no-pager || true
  exit 1
fi
EOF2

echo "==> [5/6] Final quick checks"
sudo systemctl is-active caddy
cd "$APP_DIR" && docker compose ps

echo "==> [6/6] Completed"
