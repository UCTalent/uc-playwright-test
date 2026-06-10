# Playwright E2E Safety Guide

## Scope

This repository is for browser-driven verification of the existing UCTalent dev environments.

- `frontend`: existing dev/public environment
- `ATS`: existing dev/public environment
- `backend`: deployed separately to VPS when needed

The Playwright suite does not need to boot all repositories locally on the VPS. It points to the running dev URLs above.

## Auth model

Tests reuse `storageState.json` by default.

- `CI_AUTH_MODE=reuse`: uses the saved session and never waits for manual verification
- `CI_AUTH_MODE=refresh`: opens a headed browser and refreshes the saved session

Refresh the session manually when needed:

```bash
cd playwright-tests
TEST_GOOGLE_EMAIL=your-admin@example.com TEST_GOOGLE_PASSWORD='your-password' npm run auth:refresh
```

## Required environment

Create `.env` from `.env.example` and confirm these values:

```bash
TEST_GOOGLE_EMAIL=your-admin@example.com
TEST_GOOGLE_PASSWORD=your-password
FRONTEND_URL=https://uctalent.dev
BASE_URL=https://uctalent.dev
ATS_URL=https://business.uctalent.dev
API_BASE_URL=https://api.nest.uctalent.dev
CI_AUTH_MODE=reuse
```

## Safety notes

- `.env`, `storageState.json`, `.auth/`, `playwright-report/`, and `test-results/` are git-ignored
- Nightly runs fail fast when `storageState.json` is missing or expired
- Some test cases can still be skipped on production-like environments when required data is absent or static assets return `503`
- If a test interacts with mutable flows, keep it scoped to dev/staging data only

## Manual checks before nightly automation

```bash
cd /opt/uctalents/playwright-tests
npm ci
npx playwright install chromium
CI_AUTH_MODE=reuse npm run test:nightly
```

If the auth state is expired:

```bash
cd playwright-tests
CI_AUTH_MODE=refresh npm run auth:refresh
```
