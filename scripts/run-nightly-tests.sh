#!/usr/bin/env bash
set -euo pipefail

E2E_DIR="${E2E_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG_DIR="${E2E_LOG_DIR:-$E2E_DIR/nightly-logs}"
REPORT_DIR="${E2E_REPORT_DIR:-$E2E_DIR/nightly-reports}"
ENV_PREFIX="${ENV_PREFIX:-dev}"
RUN_ID="$(date +%F-%H%M%S)"

mkdir -p "$LOG_DIR" "$REPORT_DIR"
cd "$E2E_DIR"

export CI="${CI:-true}"
export CI_AUTH_MODE="${CI_AUTH_MODE:-reuse}"
export ALLOW_GUEST_FALLBACK="${ALLOW_GUEST_FALLBACK:-true}"
export FRONTEND_URL="${FRONTEND_URL:-https://uctalent.dev}"
export BASE_URL="${BASE_URL:-$FRONTEND_URL}"
export ATS_URL="${ATS_URL:-https://business.uctalent.dev}"

LOG_FILE="$LOG_DIR/playwright-$RUN_ID.log"

PIPE_EXIT=0
{
  echo "▶ Playwright nightly run: $RUN_ID"
  echo "▶ E2E_DIR=$E2E_DIR"
  echo "▶ FRONTEND_URL=$FRONTEND_URL"
  echo "▶ ATS_URL=$ATS_URL"
  echo "▶ CI_AUTH_MODE=$CI_AUTH_MODE"
  echo "▶ ALLOW_GUEST_FALLBACK=$ALLOW_GUEST_FALLBACK"
  echo "▶ ENV_PREFIX=$ENV_PREFIX"

  if [ ! -d "$E2E_DIR/node_modules" ]; then
    echo "▶ Installing npm dependencies..."
    npm ci
  fi

  if [ ! -d "$HOME/.cache/ms-playwright" ]; then
    echo "▶ Installing Playwright Chromium..."
    npx playwright install chromium
  fi

  echo "▶ Running test suite..."
  npm run test:nightly
} 2>&1 | tee "$LOG_FILE" || PIPE_EXIT=$?

# Always copy the report — Playwright generates it even on test failure.
# Cloud Build / cron still sees the real exit code via PIPE_EXIT below.
if [ -d "$E2E_DIR/playwright-report" ]; then
  cp -R "$E2E_DIR/playwright-report" "$REPORT_DIR/${ENV_PREFIX}-playwright-report-$RUN_ID"
  echo "✅ Report copied: $REPORT_DIR/${ENV_PREFIX}-playwright-report-$RUN_ID"
fi

echo "✅ Nightly run finished. Log: $LOG_FILE"
exit $PIPE_EXIT
