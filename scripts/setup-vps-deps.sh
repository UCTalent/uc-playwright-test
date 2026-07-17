#!/usr/bin/env bash
set -e

DEPLOY_DIR="${1:-/opt/uctalents/playwright-tests}"
cd "$DEPLOY_DIR"

echo "=== Installing dependencies on VPS ==="
echo "Target directory: $DEPLOY_DIR"

# Ensure Node.js >= 18 is present and compatible
NODE_OK=0
if command -v node > /dev/null 2>&1; then
  NODE_VERSION=$(node -v | cut -d'v' -f2)
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1)
  if [ "$NODE_MAJOR" -ge 18 ]; then
    NODE_OK=1
  fi
fi

if [ "$NODE_OK" = "0" ]; then
  echo 'Node.js not found or version is < 18. Installing Node 20 LTS...'
  sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg
  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi
echo "Node version: $(node -v)"

# Install npm dependencies
npm ci --prefer-offline
echo '✓ npm ci done'

# Install Playwright Chromium browser
npx playwright install chromium --with-deps
echo '✓ Playwright Chromium install/verify complete'

# Ensure runner script is executable
chmod +x "$DEPLOY_DIR/scripts/run-nightly-tests.sh"
echo '✓ setup-vps-deps.sh complete'
