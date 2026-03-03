#!/usr/bin/env bash
set -euo pipefail

DOMAIN="vexel.alshifalab.pk"
ROOT_DIR="${ROOT_DIR:-/home/munaim/srv/apps/vexel}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker is not installed."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin is not available."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is not installed."
  exit 1
fi

cd "$ROOT_DIR"

if [[ ! -f docker-compose.yml ]]; then
  echo "ERROR: docker-compose.yml not found in $ROOT_DIR"
  exit 1
fi

check_http_code() {
  local url="$1"
  local expected="${2:-200}"
  local got=""
  local attempt=1
  local max_attempts=15
  while (( attempt <= max_attempts )); do
    if got="$(curl -sS --connect-timeout 2 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)" && [[ "$got" == "$expected" ]]; then
      echo "PASS: $url -> HTTP $got"
      return 0
    fi
    sleep 1
    (( attempt++ ))
  done
  echo "FAIL: $url -> HTTP ${got:-000} (expected $expected)"
  return 1
}

check_json_health() {
  local url="$1"
  local body=""
  local attempt=1
  local max_attempts=15
  while (( attempt <= max_attempts )); do
    if body="$(curl -fsS --connect-timeout 2 "$url" 2>/dev/null)" && echo "$body" | grep -q '"status":"ok"\|"status": "ok"'; then
      echo "PASS: $url -> $body"
      return 0
    fi
    sleep 1
    (( attempt++ ))
  done
  echo "FAIL: $url did not return status ok."
  echo "Body: ${body:-<empty>}"
  return 1
}

check_http_code_public() {
  local url="$1"
  local expected="${2:-200}"
  if check_http_code "$url" "$expected"; then
    return 0
  fi
  echo "WARN: Direct public check failed, retrying via local Caddy resolve."
  local got=""
  local attempt=1
  local max_attempts=15
  while (( attempt <= max_attempts )); do
    if got="$(curl -sS --connect-timeout 2 --resolve "${DOMAIN}:443:127.0.0.1" -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)" && [[ "$got" == "$expected" ]]; then
      echo "PASS: $url -> HTTP $got (via local resolve)"
      return 0
    fi
    sleep 1
    (( attempt++ ))
  done
  echo "FAIL: $url -> HTTP ${got:-000} (expected $expected)"
  return 1
}

check_json_health_public() {
  local url="$1"
  if check_json_health "$url"; then
    return 0
  fi
  echo "WARN: Direct public check failed, retrying via local Caddy resolve."
  local body=""
  local attempt=1
  local max_attempts=15
  while (( attempt <= max_attempts )); do
    if body="$(curl -fsS --connect-timeout 2 --resolve "${DOMAIN}:443:127.0.0.1" "$url" 2>/dev/null)" && echo "$body" | grep -q '"status":"ok"\|"status": "ok"'; then
      echo "PASS: $url -> $body (via local resolve)"
      return 0
    fi
    sleep 1
    (( attempt++ ))
  done
  echo "FAIL: $url did not return status ok."
  echo "Body: ${body:-<empty>}"
  return 1
}

echo "==> Bringing up stack with build"
docker compose up -d --build

echo
echo "==> Service status"
docker compose ps

echo
echo "==> Localhost smoke checks"
check_json_health "http://127.0.0.1:9021/api/health"
check_http_code "http://127.0.0.1:9022/health/pdf"
check_http_code "http://127.0.0.1:9023/admin/login"
check_http_code "http://127.0.0.1:9024/lims/worklist"
check_http_code "http://127.0.0.1:9025/"
check_http_code "http://127.0.0.1:9027/minio/health/live"

echo
echo "==> Public-domain smoke checks (DOMAIN fixed: $DOMAIN)"
check_json_health_public "https://$DOMAIN/api/health"
check_http_code_public "https://$DOMAIN/admin/login"
check_http_code_public "https://$DOMAIN/lims/worklist"

echo
echo "All resume checks passed."
