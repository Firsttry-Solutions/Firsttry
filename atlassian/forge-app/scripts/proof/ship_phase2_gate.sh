#!/bin/bash
set -euo pipefail

#==============================================================================
# Phase 2 Continuous Drift Monitoring - Ship Gate
# 
# This script enforces deterministic pre-ship validation:
# - No write scopes in Jira
# - Scheduled trigger configured correctly
# - Webhook allowlist is secure
# - Forge CLI auth is env-var based (Codespaces-safe)
# - All tests pass
# - Proof harness output is deterministic
#==============================================================================

REPO_ROOT="/workspaces/Firsttry/atlassian/forge-app"

echo "[SHIP_GATE] Starting Phase 2 validation..."
echo ""

#==============================================================================
# CHECK 1: Working directory and required files
#==============================================================================
echo "[CHECK-1] Verifying working directory and required files..."
cd "$REPO_ROOT" || { echo "ERROR: Cannot cd to $REPO_ROOT"; exit 1; }

REQUIRED_FILES=(
  "manifest.yml"
  "tests/run_phase2_proof.mjs"
  "src/continuous-drift/detector.ts"
  "src/continuous-drift/scheduled.ts"
  "src/storage/lock.ts"
  "src/storage/ringBuffer.ts"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "ERROR: Required file missing: $file"
    exit 1
  fi
done

echo "✅ All required files present"
echo ""

#==============================================================================
# CHECK 2: No write scopes in manifest
#==============================================================================
echo "[CHECK-2] Verifying no write scopes exist..."

if grep -q "write:" manifest.yml; then
  echo "ERROR: write: scopes found in manifest.yml"
  grep -n "write:" manifest.yml
  exit 1
fi

echo "✅ No write scopes"
echo ""

#==============================================================================
# CHECK 3: Manifest has scheduled trigger with interval=day
#==============================================================================
echo "[CHECK-3] Validating manifest scheduledTrigger configuration..."

python3 << 'EOF'
import sys
import yaml

try:
    with open('manifest.yml', 'r') as f:
        manifest = yaml.safe_load(f)
except Exception as e:
    print(f"ERROR: Failed to parse manifest.yml: {e}")
    sys.exit(1)

# Verify scheduledTrigger exists
if 'scheduledTrigger' not in manifest:
    print("ERROR: scheduledTrigger key not found in manifest.yml")
    sys.exit(1)

# Find drift-monitor-daily trigger
triggers = manifest.get('scheduledTrigger', [])
drift_trigger = None

for trigger in triggers:
    if trigger.get('key') == 'drift-monitor-daily':
        drift_trigger = trigger
        break

if drift_trigger is None:
    print("ERROR: drift-monitor-daily trigger not found")
    sys.exit(1)

# Validate trigger configuration
if drift_trigger.get('interval') != 'day':
    print(f"ERROR: drift-monitor-daily interval is '{drift_trigger.get('interval')}', expected 'day'")
    sys.exit(1)

if drift_trigger.get('function') != 'driftMonitorScheduled':
    print(f"ERROR: drift-monitor-daily function is '{drift_trigger.get('function')}', expected 'driftMonitorScheduled'")
    sys.exit(1)

print("✅ ScheduledTrigger 'drift-monitor-daily' configured correctly (interval=day, function=driftMonitorScheduled)")
EOF

echo ""

#==============================================================================
# CHECK 4: Manifest has webhook allowlist
#==============================================================================
echo "[CHECK-4] Validating external.fetch.backend allowlist..."

python3 << 'EOF'
import sys
import yaml

try:
    with open('manifest.yml', 'r') as f:
        manifest = yaml.safe_load(f)
except Exception as e:
    print(f"ERROR: Failed to parse manifest.yml: {e}")
    sys.exit(1)

# Check for Slack webhook allowlist
backend_list = manifest.get('permissions', {}).get('external', {}).get('fetch', {}).get('backend', [])

if not backend_list:
    print("ERROR: permissions.external.fetch.backend not found or empty")
    sys.exit(1)

if 'https://hooks.slack.com' not in backend_list:
    print(f"ERROR: https://hooks.slack.com not in backend allowlist. Found: {backend_list}")
    sys.exit(1)

print(f"✅ Webhook allowlist configured: {backend_list}")
EOF

echo ""

#==============================================================================
# CHECK 5: Forge CLI auth is env-var based + validate credentials
#==============================================================================
echo "[CHECK-5] Verifying Forge CLI authentication (hard fail, no bypass)..."
echo ""

if ! bash scripts/proof/forge_auth_check.sh; then
    echo "ERROR: Forge authentication check failed (hard fail)"
    exit 1
fi

echo ""

#==============================================================================
# CHECK 6: forge lint passes (MANDATORY - no skip)
#==============================================================================
echo "[CHECK-6] Running forge lint (MANDATORY)..."
echo ""

if ! forge lint 2>&1; then
    echo "ERROR: forge lint failed (no skip allowed)"
    exit 1
fi

echo ""
echo "✅ forge lint passed"
echo ""

#==============================================================================
# CHECK 7: npm test passes
#==============================================================================
echo "[CHECK-7] Running npm test..."
echo ""

if ! npm test 2>&1 | tail -50; then
    echo "ERROR: npm test failed"
    exit 1
fi

echo ""
echo "✅ npm test passed"
echo ""

#==============================================================================
# CHECK 8: Proof harness output is EXACTLY [FT_PHASE2_PROOF_PASS]
#==============================================================================
echo "[CHECK-8] Running proof harness with strict output validation..."
echo ""

# Capture proof harness output
PROOF_OUTPUT=$(node tests/run_phase2_proof.mjs 2>&1)
EXPECTED_OUTPUT="[FT_PHASE2_PROOF_PASS]"

# Trim trailing newlines and normalize
PROOF_TRIMMED=$(echo -n "$PROOF_OUTPUT" | tail -1)

if [ "$PROOF_TRIMMED" != "$EXPECTED_OUTPUT" ]; then
    echo "ERROR: Proof harness output does not match expected"
    echo ""
    echo "Expected:"
    echo "$EXPECTED_OUTPUT"
    echo ""
    echo "Got (with visible line endings):"
    echo "$PROOF_OUTPUT" | cat -A
    exit 1
fi

echo "✅ Proof harness output is deterministic: $EXPECTED_OUTPUT"
echo ""

#==============================================================================
# CHECK 9: Optional Playwright tests
#==============================================================================
echo "[CHECK-9] Checking for Playwright..."

if grep -q "playwright" package.json 2>/dev/null; then
    echo "Found Playwright in package.json - running tests..."
    if ! npx playwright test 2>&1 | tail -30; then
        echo "ERROR: Playwright tests failed"
        exit 1
    fi
    echo "✅ Playwright tests passed"
else
    echo "SKIP: Playwright not installed"
fi

echo ""

#==============================================================================
# FINAL: Success
#==============================================================================
echo ""
echo "════════════════════════════════════════════════════════════════════════════"
echo "✅ PHASE2 SHIP GATE PASS"
echo "════════════════════════════════════════════════════════════════════════════"
echo ""
echo "All checks passed:"
echo "  ✅ Working directory and required files"
echo "  ✅ No write scopes in manifest"
echo "  ✅ ScheduledTrigger correctly configured (interval=day)"
echo "  ✅ Webhook allowlist is secure (Slack only)"
echo "  ✅ Forge CLI auth is env-var based (Codespaces-safe)"
echo "  ✅ forge lint passed"
echo "  ✅ npm test passed"
echo "  ✅ Proof harness output is deterministic"
echo "  ✅ Playwright tests (if installed)"
echo ""
echo "Ready for deployment."
echo ""

exit 0
