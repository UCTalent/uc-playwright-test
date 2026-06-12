# Playwright VPS Nightly Automation

## Auth model

Tests use `storageState.json` by default. This means the verification flow is done once, then nightly runs reuse the saved session.

Refresh auth locally or on a headed VPS session:

```bash
cd playwright-tests
TEST_GOOGLE_EMAIL=your-admin@example.com TEST_GOOGLE_PASSWORD='your-password' npm run auth:refresh
```

After completing verification, store the generated file in Secret Manager:

```bash
gcloud secrets create playwright-storage-state-dev --data-file=playwright-tests/storageState.json
```

If the secret already exists, add a new version:

```bash
gcloud secrets versions add playwright-storage-state-dev --data-file=playwright-tests/storageState.json
```

Nightly runs fail fast with a clear message if this file is missing or expired.

## VPS layout

Expected default host paths:

```text
/opt/uctalents/playwright-tests
```

The Cloud Build sync step copies this repository and builds the Docker image on the VPS. Runtime state stays inside the scheduler container and its Docker-managed volume instead of host bind mounts.

## Inspecting the service

```bash
sudo docker ps
sudo docker logs -f uc-playwright-dev
```

To inspect files and logs inside the running container:

```bash
sudo docker exec -it uc-playwright-dev bash
```

Inside the container, runtime data is kept under:

```text
/data/storageState.json
/data/logs
/data/reports
```

## Cloud Build service deploy

`cloudbuild.vps.dev.yaml` in this repository syncs the suite to the VPS, builds the Docker image, recreates the long-running scheduler container, and injects `storageState.json` from Secret Manager:

```bash
gcloud builds submit --config cloudbuild.vps.dev.yaml .
```

To run multiple instances on one VM, submit the same build with different values for:

- `_CONTAINER_NAME`
- `_DOCKER_IMAGE`
- `_DATA_VOLUME`
- `_DEPLOY_DIR`
- `_STORAGE_STATE_SECRET_NAME`
- `_SCHEDULE_HOUR`
- `_SCHEDULE_MINUTE`
- `_TIMEZONE`
- `_CPU_LIMIT`
- `_MEMORY_LIMIT`
- `_SHM_SIZE`
- `_PIDS_LIMIT`
- `_FRONTEND_URL`
- `_ATS_URL`
- `_API_URL`

Default schedule:

```text
02:00 Asia/Ho_Chi_Minh
```

The container itself keeps running and waits until the next scheduled run. There is no host cron in this model.

Recommended default guardrails per instance:

- `--cpus 1.5`
- `--memory 2g`
- `--shm-size 1g`
- `--pids-limit 512`
- Docker log rotation with `max-size=20m` and `max-file=5`
