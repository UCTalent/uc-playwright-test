# Playwright VPS Nightly Automation

## Auth model

Tests use `storageState.json` by default. This means the verification flow is done once, then nightly runs reuse the saved session.

Refresh auth locally or on a headed VPS session:

```bash
cd playwright-tests
TEST_GOOGLE_EMAIL=your-admin@example.com TEST_GOOGLE_PASSWORD='your-password' npm run auth:refresh
```

After completing verification, copy the generated file to the VPS test directory:

```bash
scp playwright-tests/storageState.json <vps-user>@<vps-ip>:/opt/uctalents/playwright-tests/storageState.json
```

Nightly runs fail fast with a clear message if this file is missing or expired.

## VPS layout

Expected default paths:

```text
/opt/uctalents/playwright-tests
/opt/uctalents/playwright-logs
/opt/uctalents/playwright-reports
/opt/uctalents-e2e/run-nightly-tests.sh
```

Clone or copy the repository so that `playwright-tests/package.json` exists at `/opt/uctalents/playwright-tests`.

## Manual smoke run on VPS

```bash
cd /opt/uctalents/playwright-tests
npm ci
npx playwright install chromium
CI_AUTH_MODE=reuse npm run test:nightly
```

Or run the wrapper:

```bash
/opt/uctalents-e2e/run-nightly-tests.sh
```

## Cloud Build cron install

`uc-talent-backend/cloudbuild.vps.dev.yaml` installs the cron only when this substitution is enabled:

```yaml
_INSTALL_E2E_CRON: 'true'
```

Default schedule:

```cron
0 2 * * *
```

This runs every day at 02:00 in the VPS timezone.
