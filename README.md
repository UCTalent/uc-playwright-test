# UCTalent Playwright E2E

This repository contains the Playwright end-to-end suite for UCTalent.

## Local start

This repo runs against the existing dev/public URLs. It does not boot frontend, ATS, or backend locally.

1. Install dependencies:

```bash
pnpm install
```

2. Create `.env` from [the template](.env.example) and confirm the required URLs and auth values are set.

3. Refresh the auth state once if `storageState.json` is missing or expired:

```bash
TEST_GOOGLE_EMAIL=your-admin@example.com TEST_GOOGLE_PASSWORD='your-password' npm run auth:refresh
```

4. Run the suite:

```bash
npm run test
```

For an interactive run, use `npm run test:ui` or `npm run test:headed`.

## Which file do we run?

Use these files for these jobs:

- Backend deploy to VPS: `uc-talent-backend/cloudbuild.vps.dev.yaml`
- Nightly Playwright execution on VPS: `playwright-tests/scripts/run-nightly-tests.sh`
- Playwright auth refresh: `npm run auth:refresh`

Do not use `playwright-tests/cloudbuild.yaml` for the current VPS flow. The active deployment flow is driven by the backend Cloud Build config, which can also install the nightly cron job on the VPS.

## Architecture

The test suite does not need to boot every repository on the VPS.

- `frontend`: use the existing dev/public environment
- `ATS`: use the existing dev/public environment
- `backend`: deploy to VPS
- `playwright-tests`: run on VPS and point to the URLs above

In practice, the VPS is used for:

- running the backend dev deployment
- storing `storageState.json`
- running nightly Playwright jobs via cron

## Required URLs

Set these values in `.env`:

```bash
FRONTEND_URL=https://uctalent.dev
BASE_URL=https://uctalent.dev
ATS_URL=https://business.uctalent.dev
API_BASE_URL=https://api.nest.uctalent.dev
CI_AUTH_MODE=reuse
```

Adjust `API_BASE_URL` if your dev backend is exposed on a different domain.

## One-time auth setup

Refresh the Playwright session once when you need to create or renew `storageState.json`:

```bash
TEST_GOOGLE_EMAIL=your-admin@example.com TEST_GOOGLE_PASSWORD='your-password' npm run auth:refresh
```

This creates `storageState.json`. Nightly runs and normal `reuse` runs use that file and skip manual verification.

## VPS flow

1. Deploy backend with Cloud Build:

```bash
gcloud builds submit --config uc-talent-backend/cloudbuild.vps.dev.yaml uc-talent-backend
```

2. Put this repository on the VPS at:

```text
/opt/uctalents/playwright-tests
```

3. Install dependencies once on the VPS:

```bash
cd /opt/uctalents/playwright-tests
npm ci
npx playwright install chromium
```

4. Run a smoke test manually:

```bash
CI_AUTH_MODE=reuse npm run test:nightly
```

5. Or use the VPS runner directly:

```bash
/opt/uctalents-e2e/run-nightly-tests.sh
```

## Nightly automation

The cron installer lives in:

- `uc-talent-backend/cloudbuild.vps.dev.yaml`

Enable it by setting:

```yaml
_INSTALL_E2E_CRON: 'true'
```

When enabled, Cloud Build will SSH into the VPS, install the runner, and create the nightly cron entry.
