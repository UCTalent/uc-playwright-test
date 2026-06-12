#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/app}"
STATE_DIR="${STATE_DIR:-/data}"
SCHEDULE_HOUR="${SCHEDULE_HOUR:-2}"
SCHEDULE_MINUTE="${SCHEDULE_MINUTE:-0}"
RUN_ON_STARTUP="${RUN_ON_STARTUP:-false}"

mkdir -p "$STATE_DIR/logs" "$STATE_DIR/reports"
ln -sf "$STATE_DIR/storageState.json" "$APP_DIR/storageState.json"

export E2E_DIR="$APP_DIR"
export E2E_LOG_DIR="$STATE_DIR/logs"
export E2E_REPORT_DIR="$STATE_DIR/reports"
export CI="${CI:-true}"
export CI_AUTH_MODE="${CI_AUTH_MODE:-reuse}"

log() {
  printf '[%s] %s\n' "$(date '+%F %T %Z')" "$*"
}

validate_schedule() {
  case "$SCHEDULE_HOUR" in
    ''|*[!0-9]*)
      echo "Invalid SCHEDULE_HOUR: $SCHEDULE_HOUR" >&2
      exit 1
      ;;
  esac
  case "$SCHEDULE_MINUTE" in
    ''|*[!0-9]*)
      echo "Invalid SCHEDULE_MINUTE: $SCHEDULE_MINUTE" >&2
      exit 1
      ;;
  esac
  if [ "$SCHEDULE_HOUR" -gt 23 ] || [ "$SCHEDULE_MINUTE" -gt 59 ]; then
    echo "Schedule out of range: ${SCHEDULE_HOUR}:${SCHEDULE_MINUTE}" >&2
    exit 1
  fi
}

wait_until_next_run() {
  local now target sleep_for target_text
  now=$(date +%s)
  target=$(date -d "today ${SCHEDULE_HOUR}:${SCHEDULE_MINUTE}:00" +%s)
  if [ "$target" -le "$now" ]; then
    target=$(date -d "tomorrow ${SCHEDULE_HOUR}:${SCHEDULE_MINUTE}:00" +%s)
  fi
  sleep_for=$((target - now))
  target_text=$(date -d "@$target" '+%F %T %Z')
  log "Next run scheduled at ${target_text}"
  sleep "$sleep_for"
}

run_suite() {
  local status snapshot_path
  log "Starting scheduled Playwright run"
  set +e
  bash "$APP_DIR/scripts/run-nightly-tests.sh"
  status=$?
  set -e
  if [ -d "$APP_DIR/playwright-report" ]; then
    snapshot_path="$STATE_DIR/reports/latest"
    rm -rf "$snapshot_path"
    cp -R "$APP_DIR/playwright-report" "$snapshot_path"
    log "Updated latest report snapshot at $snapshot_path"
  else
    log "No playwright-report directory found after run"
  fi
  log "Playwright run finished with exit code ${status}"
  return "$status"
}

validate_schedule
log "Container scheduler started for daily run at ${SCHEDULE_HOUR}:${SCHEDULE_MINUTE} ${TZ:-UTC}"

if [ "${RUN_ON_STARTUP,,}" = "true" ]; then
  run_suite || true
fi

while true; do
  wait_until_next_run
  run_suite || true
done
