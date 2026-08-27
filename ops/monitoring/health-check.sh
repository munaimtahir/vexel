#!/usr/bin/env bash
# Vexel stack uptime check. Runs on a schedule (see crontab), hits the internal
# API health endpoint AND the public HTTPS endpoint, and appends a state-change
# log entry whenever either flips between healthy and unhealthy so an outage
# doesn't go unnoticed again (the stack was down for ~7 weeks with nothing
# watching it, prior to 2026-07-24).
#
# Public check added 2026-08-27 after a real incident where the internal
# check stayed "up" continuously for ~5 days while the public domain
# (vexel.alshifalab.pk) was completely unreachable — a Caddy routing gap
# unrelated to the app itself (see docs/ops/INCIDENTS.md, 2026-08-27 entry).
# Checking only the internal endpoint can't catch that class of outage.

set -euo pipefail

HEALTH_URL="http://127.0.0.1:9021/api/health"
PUBLIC_URL="https://vexel.alshifalab.pk/api/health"
STATE_FILE="/home/munaim/srv/apps/vexel/runtime/health-check.state"
PUBLIC_STATE_FILE="/home/munaim/srv/apps/vexel/runtime/health-check.public.state"
LOG_FILE="/home/munaim/srv/apps/vexel/runtime/health-check.log"

mkdir -p "$(dirname "$STATE_FILE")"

now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

check_and_log() {
  local label="$1" url="$2" state_file="$3"
  local prev_state="unknown"
  [ -f "$state_file" ] && prev_state="$(cat "$state_file")"

  local new_state
  if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
    new_state="up"
  else
    new_state="down"
  fi

  if [ "$new_state" != "$prev_state" ]; then
    echo "$now state_change target=$label prev=$prev_state new=$new_state" >> "$LOG_FILE"
  fi

  echo "$new_state" > "$state_file"
}

check_and_log internal "$HEALTH_URL" "$STATE_FILE"
check_and_log public "$PUBLIC_URL" "$PUBLIC_STATE_FILE"
