#!/usr/bin/env bash
set -e

DEPLOY_DIR="${1:-/opt/uctalents/playwright-tests}"
cd "$DEPLOY_DIR"

echo "=== Merging .env on VPS ==="
touch .env

if [ -f .env.template ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    key=$(echo "$line" | cut -d= -f1)
    val=$(echo "$line" | cut -d= -f2-)
    if ! grep -q "^${key}=" .env; then
      echo "${key}=${val}" >> .env
      echo "  Added missing env: ${key}"
    fi
  done < .env.template
  rm -f .env.template
  echo '✓ .env merged and cleaned'
else
  echo '⚠️ .env.template not found, skipping merge'
fi
