#!/usr/bin/env bash
set -u

APP_DIR="/home/munaim/srv/apps/vexel"
DOMAIN="https://vexel.alshifalab.pk"
LOCAL_API="http://127.0.0.1:9021"
ADMIN_EMAIL="admin@vexel.pk"
ADMIN_PASS="admin123"

GIT_SYNC="SKIP"
TRANSFER_RESTORE="SKIP"
DEPENDENCY_INSTALL="SKIP"
DOCKER_BRINGUP="FAIL"
LOCAL_SMOKE="FAIL"
PUBLIC_SMOKE="FAIL"
AUTH_SMOKE="FAIL"

ROOT_CAUSE=""
FIX_APPLIED=""
RERUN_STATUS="NOT RUN"

run_and_capture() {
  local step="$1"
  shift
  echo "==> ${step}"
  "$@"
  return $?
}

http_code() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  if [ -n "$data" ]; then
    curl -sS -o /tmp/vexel_resp.$$ -w "%{http_code}" -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -d "$data" || echo "000"
  else
    curl -sS -o /tmp/vexel_resp.$$ -w "%{http_code}" -X "$method" "$url" || echo "000"
  fi
}

diag_dump() {
  echo "==> Diagnostics"
  docker compose ps || true
  docker compose logs --tail=300 api worker admin operator pdf minio || true
  journalctl -u caddy -n 300 --no-pager || true
}

ensure_docker_group() {
  if ! getent group docker >/dev/null 2>&1; then
    sudo groupadd docker
  fi
  sudo usermod -aG docker "$USER"
}

resume_stack() {
  cd "$APP_DIR" || return 1
  chmod +x scripts/new-server-resume.sh
  ./scripts/new-server-resume.sh
}

smoke_checks() {
  local c1 c2 c3 c4
  c1="$(http_code GET "$LOCAL_API/api/health")"
  c2="$(http_code GET "$DOMAIN/api/health")"
  c3="$(http_code GET "$DOMAIN/")"
  c4="$(http_code POST "$DOMAIN/api/auth/login" "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")"

  [ "$c1" = "200" ] && LOCAL_SMOKE="PASS" || LOCAL_SMOKE="FAIL"
  if [ "$c2" = "200" ] && { [ "$c3" = "200" ] || [ "$c3" = "307" ] || [ "$c3" = "308" ]; }; then
    PUBLIC_SMOKE="PASS"
  else
    PUBLIC_SMOKE="FAIL"
  fi
  [ "$c4" = "200" ] && AUTH_SMOKE="PASS" || AUTH_SMOKE="FAIL"

  echo "Local /api/health: $c1"
  echo "Public /api/health: $c2"
  echo "Public /: $c3"
  echo "Public auth login: $c4"
}

main() {
  cd "$APP_DIR" || {
    echo "Cannot cd to $APP_DIR"
    exit 1
  }

  echo "==> Pre-check docker access"
  if docker ps >/dev/null 2>&1; then
    echo "Docker access already OK"
  else
    ROOT_CAUSE="User '$USER' cannot access /var/run/docker.sock (not in docker group or session not refreshed)."
    FIX_APPLIED="Added user to docker group (and refreshed shell group context if possible)."

    echo "Docker access missing, applying minimal safe fix"
    if ! ensure_docker_group; then
      echo "Failed to modify docker group/user (sudo required)."
      echo
      echo "Git sync: $GIT_SYNC"
      echo "Transfer artifact restore: $TRANSFER_RESTORE"
      echo "Dependency install: $DEPENDENCY_INSTALL"
      echo "Docker stack bring-up: $DOCKER_BRINGUP"
      echo "Local smoke endpoints: $LOCAL_SMOKE"
      echo "Public domain smoke endpoints: $PUBLIC_SMOKE"
      echo "Auth smoke: $AUTH_SMOKE"
      echo "If FAIL: root cause + exact fix + rerun status"
      echo "root cause: $ROOT_CAUSE"
      echo "exact fix: run 'sudo usermod -aG docker $USER' then re-login/newgrp docker"
      echo "rerun status: BLOCKED (needs sudo + session refresh)"
      exit 1
    fi

    if command -v newgrp >/dev/null 2>&1; then
      newgrp docker <<'EOF2'
set -u
APP_DIR="/home/munaim/srv/apps/vexel"
cd "$APP_DIR" || exit 1
if ! docker ps >/dev/null 2>&1; then
  echo "Docker still not accessible after newgrp"
  exit 2
fi
chmod +x scripts/new-server-resume.sh
./scripts/new-server-resume.sh
EOF2
      rc=$?
      if [ $rc -eq 0 ]; then
        DOCKER_BRINGUP="PASS"
        RERUN_STATUS="PASS"
      else
        DOCKER_BRINGUP="FAIL"
        RERUN_STATUS="FAIL (resume script error after group fix)"
        diag_dump
      fi
    else
      DOCKER_BRINGUP="FAIL"
      RERUN_STATUS="BLOCKED (newgrp unavailable; re-login required)"
    fi
  fi

  if [ "$DOCKER_BRINGUP" = "FAIL" ] && [ -z "$ROOT_CAUSE" ]; then
    ROOT_CAUSE="Docker stack resume failed; see diagnostics output."
    FIX_APPLIED="No additional fix applied."
    diag_dump
  fi

  if [ "$DOCKER_BRINGUP" = "PASS" ]; then
    smoke_checks
  fi

  echo
  echo "Git sync: $GIT_SYNC"
  echo "Transfer artifact restore: $TRANSFER_RESTORE"
  echo "Dependency install: $DEPENDENCY_INSTALL"
  echo "Docker stack bring-up: $DOCKER_BRINGUP"
  echo "Local smoke endpoints: $LOCAL_SMOKE"
  echo "Public domain smoke endpoints: $PUBLIC_SMOKE"
  echo "Auth smoke: $AUTH_SMOKE"

  if [ "$DOCKER_BRINGUP" = "FAIL" ] || [ "$LOCAL_SMOKE" = "FAIL" ] || [ "$PUBLIC_SMOKE" = "FAIL" ] || [ "$AUTH_SMOKE" = "FAIL" ]; then
    echo "If FAIL: root cause + exact fix + rerun status"
    echo "root cause: ${ROOT_CAUSE:-Unknown failure}"
    if [ -n "$FIX_APPLIED" ]; then
      echo "exact fix: $FIX_APPLIED"
    else
      echo "exact fix: Review diagnostics and apply minimal safe fix."
    fi
    echo "rerun status: $RERUN_STATUS"
  fi
}

main "$@"
