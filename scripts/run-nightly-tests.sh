#!/usr/bin/env bash
set -euo pipefail

E2E_DIR="${E2E_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG_DIR="${E2E_LOG_DIR:-$E2E_DIR/nightly-logs}"
REPORT_DIR="${E2E_REPORT_DIR:-$E2E_DIR/nightly-reports}"
RUN_ID="$(date +%F-%H%M%S)"

mkdir -p "$LOG_DIR" "$REPORT_DIR"
cd "$E2E_DIR"

export CI="${CI:-true}"
export CI_AUTH_MODE="${CI_AUTH_MODE:-reuse}"
export FRONTEND_URL="${FRONTEND_URL:-https://uctalent.dev}"
export BASE_URL="${BASE_URL:-$FRONTEND_URL}"
export ATS_URL="${ATS_URL:-https://business.uctalent.dev}"

LOG_FILE="$LOG_DIR/playwright-$RUN_ID.log"

{
  echo "▶ Playwright nightly run: $RUN_ID"
  echo "▶ E2E_DIR=$E2E_DIR"
  echo "▶ FRONTEND_URL=$FRONTEND_URL"
  echo "▶ ATS_URL=$ATS_URL"
  echo "▶ CI_AUTH_MODE=$CI_AUTH_MODE"

  if [ ! -f "$E2E_DIR/storageState.json" ]; then
    echo "❌ Missing $E2E_DIR/storageState.json"
    echo "Run: CI_AUTH_MODE=refresh npm run auth:refresh"
    echo "Then copy storageState.json to this VPS directory."
    exit 3
  fi

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
} 2>&1 | tee "$LOG_FILE"

if [ -d "$E2E_DIR/playwright-report" ]; then
  cp -R "$E2E_DIR/playwright-report" "$REPORT_DIR/playwright-report-$RUN_ID"
fi

echo "✅ Nightly run finished. Log: $LOG_FILE"
