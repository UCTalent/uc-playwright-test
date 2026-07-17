#!/usr/bin/env bash
# Structural verification that main's Tailscale deploy connectivity and
# fix/deploy-automation's modular scripts are both present and wired.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
FAIL=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; FAIL=$((FAIL + 1)); }

require_file() {
  if [ -f "$1" ]; then pass "file exists: $1"
  else fail "missing file: $1"
  fi
}

require_grep() {
  local file="$1" pattern="$2" label="$3"
  if grep -qE "$pattern" "$file"; then pass "$label"
  else fail "$label (pattern /$pattern/ not in $file)"
  fi
}

forbid_grep() {
  local file="$1" pattern="$2" label="$3"
  if grep -qE "$pattern" "$file"; then fail "$label (forbidden pattern /$pattern/ found in $file)"
  else pass "$label"
  fi
}

echo "=== verify-deploy-sync: structural checks ==="

# --- Required files ---
require_file "cloudbuild.vps.dev.yaml"
require_file "cloudbuild.vps.dev.trigger.yaml"
require_file "scripts/setup-vps-deps.sh"
require_file "scripts/merge-env.sh"
require_file "scripts/register-cron.sh"
require_file "scripts/run-nightly-tests.sh"

# --- bash -n on all shipped shell scripts ---
for f in scripts/*.sh; do
  if bash -n "$f"; then pass "bash -n $f"
  else fail "bash -n $f"
  fi
done

# --- Deploy YAML: Tailscale connectivity (from main) ---
for yaml in cloudbuild.vps.dev.yaml cloudbuild.vps.dev.trigger.yaml; do
  require_grep "$yaml" 'tailscale up' "$yaml has tailscale up"
  require_grep "$yaml" 'TAILSCALE_AUTHKEY' "$yaml references TAILSCALE_AUTHKEY"
  require_grep "$yaml" 'VPS_KNOWN_HOST' "$yaml references VPS_KNOWN_HOST"
  require_grep "$yaml" 'StrictHostKeyChecking=yes' "$yaml uses strict known_hosts"
  require_grep "$yaml" 'tailscale logout' "$yaml cleans up with tailscale logout"
  require_grep "$yaml" "100\\.85\\.11\\.97" "$yaml uses Tailscale host 100.85.11.97"
  forbid_grep "$yaml" '14\\.225\\.210\\.119' "$yaml must not use public IP 14.225.210.119"
  forbid_grep "$yaml" 'StrictHostKeyChecking=no' "$yaml must not disable host key checks"
done

# --- Deploy YAML: modular script wiring (from fix) ---
require_grep "cloudbuild.vps.dev.yaml" 'setup-vps-deps\.sh' "deploy calls setup-vps-deps.sh"
require_grep "cloudbuild.vps.dev.yaml" 'merge-env\.sh' "deploy calls merge-env.sh"
require_grep "cloudbuild.vps.dev.yaml" 'register-cron\.sh' "deploy calls register-cron.sh"
require_grep "cloudbuild.vps.dev.yaml" 'setup-vps-deps\.sh is missing' "deploy preflight checks setup-vps-deps.sh"
require_grep "cloudbuild.vps.dev.yaml" 'merge-env\.sh is missing' "deploy preflight checks merge-env.sh"
require_grep "cloudbuild.vps.dev.yaml" 'register-cron\.sh is missing' "deploy preflight checks register-cron.sh"

# --- Trigger YAML: optional deploy + nohup ---
require_grep "cloudbuild.vps.dev.trigger.yaml" 'IF_DEPLOY' "trigger supports optional deploy"
require_grep "cloudbuild.vps.dev.trigger.yaml" 'nohup' "trigger runs nightly via nohup"
require_grep "cloudbuild.vps.dev.trigger.yaml" 'setup-vps-deps\.sh' "trigger calls setup-vps-deps when deploying"
require_grep "cloudbuild.vps.dev.trigger.yaml" 'merge-env\.sh' "trigger calls merge-env when deploying"
require_grep "cloudbuild.vps.dev.trigger.yaml" 'ENV_PREFIX=dev' "trigger sets ENV_PREFIX=dev"

# --- Secrets / substitutions ---
for yaml in cloudbuild.vps.dev.yaml cloudbuild.vps.dev.trigger.yaml; do
  require_grep "$yaml" 'TAILSCALE_AUTH_KEY_DEV' "$yaml maps TAILSCALE_AUTH_KEY_DEV secret"
  require_grep "$yaml" 'vps-dev-known-host' "$yaml maps vps-dev-known-host secret"
  require_grep "$yaml" 'dev-vm-ssh-key' "$yaml maps dev-vm-ssh-key secret"
  require_grep "$yaml" 'ssh-port-dev' "$yaml maps ssh-port-dev secret"
done

# --- $$ escaping for shell vars in Cloud Build YAML ---
require_grep "cloudbuild.vps.dev.yaml" '\$\$TAILSCALE_AUTHKEY' "deploy escapes TAILSCALE_AUTHKEY for Cloud Build"
require_grep "cloudbuild.vps.dev.yaml" '\$\$SSH_PORT' "deploy escapes SSH_PORT for Cloud Build"
require_grep "cloudbuild.vps.dev.yaml" '\$\$DEPLOY_DIR' "deploy escapes DEPLOY_DIR for Cloud Build"
require_grep "cloudbuild.vps.dev.trigger.yaml" '\$\$IF_DEPLOY' "trigger escapes IF_DEPLOY for Cloud Build"
require_grep "cloudbuild.vps.dev.trigger.yaml" '\$\$TAILSCALE_AUTHKEY' "trigger escapes TAILSCALE_AUTHKEY for Cloud Build"

# --- rsync safety ---
for yaml in cloudbuild.vps.dev.yaml cloudbuild.vps.dev.trigger.yaml; do
  require_grep "$yaml" "exclude='\\.env'" "$yaml rsync excludes .env"
  require_grep "$yaml" "exclude='storageState\\.json'" "$yaml rsync excludes storageState.json"
  require_grep "$yaml" 'Invalid or dangerous DEPLOY_DIR' "$yaml validates DEPLOY_DIR"
done

# --- Cron registration supplies ENV_PREFIX ---
require_grep "scripts/register-cron.sh" 'ENV_PREFIX=dev' "register-cron sets ENV_PREFIX=dev"

# --- Nightly runner improvements ---
require_grep "scripts/run-nightly-tests.sh" 'ENV_PREFIX' "nightly uses ENV_PREFIX"
require_grep "scripts/run-nightly-tests.sh" 'PIPE_EXIT' "nightly preserves real exit code"
require_grep "scripts/run-nightly-tests.sh" '\$\{ENV_PREFIX\}-playwright-report' "nightly prefixes report with ENV_PREFIX"

# --- Standalone scripts are self-contained (drive real entrypoints) ---
# merge-env: missing template should not fail hard when we only check help path via dry logic
if grep -q 'env.template' scripts/merge-env.sh; then pass "merge-env references .env.template"
else fail "merge-env missing .env.template handling"
fi
if grep -q 'npm ci' scripts/setup-vps-deps.sh; then pass "setup-vps-deps runs npm ci"
else fail "setup-vps-deps missing npm ci"
fi
if grep -q 'crontab' scripts/register-cron.sh; then pass "register-cron uses crontab"
else fail "register-cron missing crontab"
fi

# --- Drive merge-env.sh real entrypoint with a temp dir ---
TMPDIR_TEST="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_TEST"' EXIT
mkdir -p "$TMPDIR_TEST"
printf '%s\n' 'CI=true' 'FRONTEND_URL=https://example.test' > "$TMPDIR_TEST/.env.template"
touch "$TMPDIR_TEST/.env"
bash scripts/merge-env.sh "$TMPDIR_TEST"
if grep -q '^CI=true$' "$TMPDIR_TEST/.env" && grep -q '^FRONTEND_URL=https://example.test$' "$TMPDIR_TEST/.env"; then
  pass "merge-env.sh real run merges keys into .env"
else
  fail "merge-env.sh real run did not merge expected keys"
fi
# second run must not duplicate — recreate template after first run removed it
printf '%s\n' 'CI=true' 'FRONTEND_URL=https://example.test' > "$TMPDIR_TEST/.env.template"
bash scripts/merge-env.sh "$TMPDIR_TEST"
COUNT="$(grep -c '^CI=true$' "$TMPDIR_TEST/.env" || true)"
if [ "$COUNT" = "1" ]; then pass "merge-env.sh is idempotent (no duplicate CI)"
else fail "merge-env.sh duplicated CI (count=$COUNT)"
fi

# --- Drive register-cron.sh args parsing (no actual crontab write: dry parse) ---
# Validate the script accepts 5 args by extracting CRON_CMD construction via bash -x dry?
# Safer: source-free check that script fails without breaking when CRON is unavailable —
# run with a fake crontab via PATH override.
FAKEBIN="$TMPDIR_TEST/fakebin"
CRONSTORE="$TMPDIR_TEST/crontab.store"
mkdir -p "$FAKEBIN"
: > "$CRONSTORE"
cat > "$FAKEBIN/crontab" <<EOF
#!/usr/bin/env bash
STORE="$CRONSTORE"
if [ "\${1:-}" = "-l" ]; then
  if [ -s "\$STORE" ]; then cat "\$STORE"; exit 0; fi
  exit 1
fi
# install mode: read stdin into store
cat > "\$STORE"
exit 0
EOF
chmod +x "$FAKEBIN/crontab"
PATH="$FAKEBIN:$PATH" bash scripts/register-cron.sh /opt/test/deploy /opt/test/logs /opt/test/reports 5 18
if grep -q 'ENV_PREFIX=dev' "$CRONSTORE" && grep -q 'CRON_ID=uc-playwright-e2e-nightly' "$CRONSTORE"; then
  pass "register-cron.sh real entrypoint writes ENV_PREFIX=dev cron line"
else
  fail "register-cron.sh did not write expected cron line (store=$(cat "$CRONSTORE" 2>/dev/null || true))"
fi

# --- YAML parse if PyYAML available ---
if python3 -c "import yaml" 2>/dev/null; then
  python3 -c "
import yaml, sys
for p in ['cloudbuild.vps.dev.yaml','cloudbuild.vps.dev.trigger.yaml']:
    d = yaml.safe_load(open(p))
    assert 'steps' in d and len(d['steps']) >= 2
    secrets = {s['env'] for s in d['availableSecrets']['secretManager']}
    for req in ('VM_SSH_KEY','SSH_PORT','TAILSCALE_AUTHKEY','VPS_KNOWN_HOST'):
        assert req in secrets, f'{p} missing secret {req}'
    assert d['substitutions']['_VM_HOST'] == '100.85.11.97', p
print('YAML structure assertions OK')
"
  pass "PyYAML structure assertions"
else
  pass "PyYAML not installed — skipped parse assertions"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "=== ALL CHECKS PASSED ==="
  exit 0
else
  echo "=== $FAIL CHECK(S) FAILED ==="
  exit 1
fi
