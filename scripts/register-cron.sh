#!/usr/bin/env bash
set -e

DEPLOY_DIR="${1:-/opt/uctalents/playwright-tests}"
LOG_DIR="${2:-/opt/uctalents/playwright-logs}"
REPORT_DIR="${3:-/opt/uctalents/playwright-reports}"
CRON_MINUTE="${4:-0}"
CRON_HOUR="${5:-19}"

echo "=== Registering cron job on VPS ==="
echo "Deploy Dir: $DEPLOY_DIR"
echo "Log Dir: $LOG_DIR"
echo "Report Dir: $REPORT_DIR"
echo "Schedule (UTC): $CRON_MINUTE $CRON_HOUR * * *"

CRON_ID="CRON_ID=uc-playwright-e2e-nightly"
CRON_CMD="$CRON_MINUTE $CRON_HOUR * * * $CRON_ID ENV_PREFIX=dev E2E_DIR=$DEPLOY_DIR E2E_LOG_DIR=$LOG_DIR E2E_REPORT_DIR=$REPORT_DIR /usr/bin/env bash $DEPLOY_DIR/scripts/run-nightly-tests.sh >> $LOG_DIR/cron-wrapper.log 2>&1"

(crontab -l 2>/dev/null | grep -v "$CRON_ID" || true; echo "$CRON_CMD") | crontab -
echo '✓ Cron registered:'
crontab -l | grep "$CRON_ID"
