#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-vexel.alshifalab.pk}"
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
  local got
  got="$(curl -sS -o /dev/null -w "%{http_code}" "$url")"
  if [[ "$got" != "$expected" ]]; then
    echo "FAIL: $url -> HTTP $got (expected $expected)"
    return 1
  fi
  echo "PASS: $url -> HTTP $got"
}

check_json_health() {
  local url="$1"
  local body
  body="$(curl -fsS "$url")"
  echo "$body" | grep -q '"status":"ok"\|"status": "ok"' || {
    echo "FAIL: $url did not return status ok."
    echo "Body: $body"
    return 1
  }
  echo "PASS: $url -> $body"
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
echo "==> Public-domain smoke checks (DOMAIN=$DOMAIN)"
check_json_health "https://$DOMAIN/api/health"
check_http_code "https://$DOMAIN/admin/login"
check_http_code "https://$DOMAIN/lims/worklist"

echo
echo "All resume checks passed."
