#!/bin/bash

# 🎯 UCTalent E2E Tests - Automated Setup Script
# This script handles the entire setup process for E2E tests

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     UCTalent E2E Tests - Automated Setup                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

# Step 1: Check if in playwright-tests directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found${NC}"
    echo -e "${YELLOW}Please run this script from the playwright-tests directory${NC}"
    exit 1
fi

# Step 2: Check .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    
    if [ -f ".env.example" ]; then
        echo -e "${BLUE}📋 Creating .env from .env.example...${NC}"
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env file${NC}"
        echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env and add your credentials:${NC}"
        echo -e "   - TEST_GOOGLE_EMAIL"
        echo -e "   - TEST_GOOGLE_PASSWORD\n"
    else
        echo -e "${RED}❌ Neither .env nor .env.example found${NC}"
        exit 1
    fi
fi

# Step 3: Verify .env has required variables
if ! grep -q "TEST_GOOGLE_EMAIL" .env || ! grep -q "TEST_GOOGLE_PASSWORD" .env; then
    echo -e "${RED}❌ Missing credentials in .env${NC}"
    echo -e "${YELLOW}Please add these to .env:${NC}"
    echo -e "   TEST_GOOGLE_EMAIL = your-email@uctalent.io"
    echo -e "   TEST_GOOGLE_PASSWORD = your-password\n"
    exit 1
fi

echo -e "${GREEN}✅ .env configuration found${NC}\n"

# Step 4: Check dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
if command -v pnpm &> /dev/null; then
    pnpm install
elif command -v npm &> /dev/null; then
    npm install
else
    echo -e "${RED}❌ Neither pnpm nor npm found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dependencies installed${NC}\n"

# Step 5: Run login setup
echo -e "${BLUE}🔐 Setting up authentication...${NC}"
echo -e "${YELLOW}ℹ️  A browser window will open for Google login${NC}"
echo -e "${YELLOW}    Follow the prompts and close the browser when done\n${NC}"

if [ -d ".auth" ]; then
    read -p "Existing .auth directory found. Refresh session? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf .auth
        node login.setup.js
    fi
else
    node login.setup.js
fi

if [ ! -d ".auth" ]; then
    echo -e "${RED}❌ Authentication setup failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Authentication session saved${NC}\n"

# Step 6: Ready to run tests
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"

echo -e "${BLUE}🚀 Ready to run tests!${NC}\n"
echo -e "${YELLOW}Run your tests with:${NC}"
echo -e "   ${GREEN}npm test${NC}              - Run all tests (headless)"
echo -e "   ${GREEN}npm run test:ui${NC}       - Run tests with UI mode"
echo -e "   ${GREEN}npm run test:headed${NC}   - Run tests in headed browser\n"

echo -e "${BLUE}📚 Documentation:${NC}"
echo -e "   - DATA_SAFETY.md        - Data safety & security info"
echo -e "   - .env.example          - Configuration template"
echo -e "   - fixtures.ts           - Test setup & helpers\n"

echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "   - Re-run this script if tests fail with auth errors"
echo -e "   - Use 'npm run test:ui' for interactive debugging"
echo -e "   - Check DATA_SAFETY.md for read-only guarantees\n"
