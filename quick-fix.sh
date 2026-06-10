#!/bin/bash

# 🚀 UCTalent E2E Tests - Quick Fix Script
# Run this when tests fail with authentication errors

set -e

echo "🔧 UCTalent E2E Tests - Quick Fix"
echo "════════════════════════════════════════"
echo ""

cd /Users/admin/repos/uctalents/playwright-tests

# Step 1: Clear old session
echo "📋 Step 1: Clearing expired session..."
if [ -d ".auth" ]; then
    rm -rf .auth
    echo "✅ Old session cleared"
else
    echo "✅ No old session to clear"
fi
echo ""

# Step 2: Verify credentials
echo "📋 Step 2: Checking credentials..."
if ! grep -q "TEST_GOOGLE_EMAIL" .env; then
    echo "❌ ERROR: TEST_GOOGLE_EMAIL not in .env"
    exit 1
fi
if ! grep -q "TEST_GOOGLE_PASSWORD" .env; then
    echo "❌ ERROR: TEST_GOOGLE_PASSWORD not in .env"
    exit 1
fi
TEST_EMAIL=$(grep "TEST_GOOGLE_EMAIL" .env | cut -d' ' -f3)
echo "✅ Email: ${TEST_EMAIL%.*}@..."
echo ""

# Step 3: Run login setup
echo "📋 Step 3: Creating fresh session..."
echo "⏳ This will open browser for ~60-90 seconds..."
echo "⚠️  DO NOT CLOSE THE BROWSER WINDOW - Script will close it automatically"
echo ""

node login.setup.js

# Step 4: Verify session
echo ""
echo "📋 Step 4: Verifying session..."
if [ -d ".auth" ]; then
    ITEM_COUNT=$(ls -1 .auth | wc -l)
    echo "✅ Session created with $ITEM_COUNT items"
else
    echo "❌ Session creation failed"
    exit 1
fi
echo ""

# Step 5: Run diagnostic
echo "📋 Step 5: Running diagnostic test..."
node diagnose.js
echo ""

# Step 6: Ready to test
echo "════════════════════════════════════════"
echo "✅ Setup Complete! Ready to run tests"
echo "════════════════════════════════════════"
echo ""
echo "Run your tests:"
echo "  npm test              # Headless mode (fast)"
echo "  npm run test:interactive   # Browser open, terminal interactive"
echo "  npm run test:headed        # See browser (debug)"
echo "  npm run test:ui            # Interactive mode"
echo ""
