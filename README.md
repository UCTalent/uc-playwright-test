# UCTalent Playwright E2E

This repository contains the Playwright end-to-end suite for UCTalent.

## Which file do we run?

Use these files for these jobs:

- Backend deploy to VPS: `uc-talent-backend/cloudbuild.vps.dev.yaml` in the backend repository
- Playwright VPS sync + Docker image build + service container deploy: `cloudbuild.vps.dev.yaml` in this repository
- Nightly Playwright execution on VPS: `scripts/run-nightly-tests.sh`
- Playwright auth refresh: `npm run auth:refresh`

Do not use the old `playwright-tests/cloudbuild.yaml`. In the current flow, backend deployment stays in the backend repository, while this repository's `cloudbuild.vps.dev.yaml` syncs the Playwright suite to the VPS, builds a Docker image there, and recreates a long-running scheduler container on the VM.

## Architecture

The test suite does not need to boot every repository on the VPS.

- `frontend`: use the existing dev/public environment
- `ATS`: use the existing dev/public environment
- `backend`: deploy to VPS
- `playwright-tests`: run on VPS and point to the URLs above

In practice, the VPS is used for:

- running the backend dev deployment
- running a long-lived Playwright scheduler container

## Required URLs

Set these values in `.env`:

```bash
FRONTEND_URL=https://uctalent.dev
BASE_URL=https://uctalent.dev
ATS_URL=https://business.uctalent.dev
API_BASE_URL=https://api.nest.uctalent.dev
CI_AUTH_MODE=reuse
```

Adjust `API_BASE_URL` if your VPS backend is exposed on a different dev domain.

## One-time auth setup

Refresh the Playwright session once:

```bash
cd playwright-tests
TEST_GOOGLE_EMAIL=your-admin@example.com TEST_GOOGLE_PASSWORD='your-password' npm run auth:refresh
```

This creates `storageState.json`. Store the exact file contents in Secret Manager so Cloud Build can write it onto the VPS during deploy. Nightly runs reuse that file and do not wait for manual verification.

## VPS flow

1. Deploy backend with Cloud Build:

```bash
gcloud builds submit --config uc-talent-backend/cloudbuild.vps.dev.yaml uc-talent-backend
```

2. Sync this repository to the VPS, build the Docker image, and recreate the scheduler container with Cloud Build from this repository:

```bash
gcloud builds submit --config cloudbuild.vps.dev.yaml .
```

3. The default target directory on the VPS is:

```text
/opt/uctalents/playwright-tests
```

4. Override substitutions per instance when you want multiple Playwright containers on one VM:

```bash
gcloud builds submit --config cloudbuild.vps.dev.yaml \
  --substitutions=_CONTAINER_NAME=uc-playwright-staging,_DOCKER_IMAGE=uc-playwright-e2e:staging,_DATA_VOLUME=uc-playwright-staging-data,_DEPLOY_DIR=/opt/uctalents/playwright-tests-staging,_STORAGE_STATE_SECRET_NAME=playwright-storage-state-staging,_CPU_LIMIT=1,_MEMORY_LIMIT=1536m,_FRONTEND_URL=https://staging.example.com,_ATS_URL=https://ats-staging.example.com,_API_URL=https://api-staging.example.com .
```

5. Save the generated `storageState.json` into Secret Manager:

```bash
gcloud secrets create playwright-storage-state-dev --data-file=storageState.json
```

If the secret already exists, add a new version instead:

```bash
gcloud secrets versions add playwright-storage-state-dev --data-file=storageState.json
```

6. Make sure the Cloud Build service account used by the trigger has `roles/secretmanager.secretAccessor` on that secret.

7. Inspect the running service:

```bash
ssh <vps-user>@<vps-ip> 'sudo docker ps'
ssh <vps-user>@<vps-ip> 'sudo docker logs -f uc-playwright-dev'
ssh <vps-user>@<vps-ip> 'sudo docker exec -it uc-playwright-dev bash'
```

## Scheduler Container

The deploy creates one long-running container per instance. That container:

- keeps running on the VM with `--restart unless-stopped`
- waits until the configured schedule time
- executes `scripts/run-nightly-tests.sh` from inside the container
- stores `storageState.json`, logs, and reports inside its Docker-managed data volume

The default runtime settings come from substitutions in:

- `cloudbuild.vps.dev.yaml`

Defaults:

- `_CONTAINER_NAME=uc-playwright-dev`
- `_DATA_VOLUME=uc-playwright-dev-data`
- `_SCHEDULE_HOUR=2`
- `_SCHEDULE_MINUTE=0`
- `_TIMEZONE=Asia/Ho_Chi_Minh`
- `_CPU_LIMIT=1.5`
- `_MEMORY_LIMIT=2g`
- `_SHM_SIZE=1g`
- `_PIDS_LIMIT=512`
- `_LOG_MAX_SIZE=20m`
- `_LOG_MAX_FILE=5`

Each instance is deployed as exactly one long-running container with its own name, volume, resource limits, and `docker logs` rotation policy. Override the limit substitutions per environment so one heavy run cannot starve the whole VPS.

The build reads `storageState.json` from Secret Manager secret `${_STORAGE_STATE_SECRET_NAME}` and injects it into the running container.

`TEST_GOOGLE_EMAIL` and `TEST_GOOGLE_PASSWORD` can also live in Secret Manager, but the current deploy does not use them because the scheduler container runs in `CI_AUTH_MODE=reuse`.
