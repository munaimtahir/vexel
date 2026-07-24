#!/usr/bin/env bash
# Vexel stack uptime check. Runs on a schedule (see crontab), hits the internal
# API health endpoint, and appends a state-change log entry when the result
# flips between healthy and unhealthy so an outage doesn't go unnoticed again
# (the stack was down for ~7 weeks with nothing watching it, prior to 2026-07-24).

set -euo pipefail

HEALTH_URL="http://127.0.0.1:9021/api/health"
STATE_FILE="/home/munaim/srv/apps/vexel/runtime/health-check.state"
LOG_FILE="/home/munaim/srv/apps/vexel/runtime/health-check.log"

mkdir -p "$(dirname "$STATE_FILE")"

now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
prev_state="unknown"
[ -f "$STATE_FILE" ] && prev_state="$(cat "$STATE_FILE")"

if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
  new_state="up"
else
  new_state="down"
fi

if [ "$new_state" != "$prev_state" ]; then
  echo "$now state_change prev=$prev_state new=$new_state" >> "$LOG_FILE"
fi

echo "$new_state" > "$STATE_FILE"
