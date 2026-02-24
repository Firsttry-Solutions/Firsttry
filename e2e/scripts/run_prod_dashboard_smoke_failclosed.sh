#!/usr/bin/env bash

set -euo pipefail

cd /workspaces/Firsttry

# ============================================================================
# Fail-Closed Prod Dashboard Smoke Test Runner
# ============================================================================
# Purpose:
#   - Run Playwright smoke test with atomic fail-closed behavior
#   - Capture all evidence (timestamps, git state, Playwright output)
#   - Validate storageState if present
#   - Never expose secrets or start VNC
#   - Exit non-zero on ANY failure

RUN_DIR="/tmp/ft_prod_dashboard_smoke_run_$(date -u +%Y%m%dT%H%M%SZ)"
STATE_PATH="/workspaces/Firsttry/e2e/.auth/storageState.json"

# Create evidence directory
mkdir -p "$RUN_DIR"

# ============================================================================
# Step 0: Record Metadata
# ============================================================================

echo "$RUN_DIR" > "$RUN_DIR/RUN_DIR.txt"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$RUN_DIR/START_UTC.txt"
git rev-parse HEAD > "$RUN_DIR/GIT_HEAD.txt"

# ============================================================================
# Step 1: Verify Repo Cleanliness (Fail-Closed)
# ============================================================================

if ! git status --porcelain > "$RUN_DIR/GIT_STATUS.txt"; then
    echo "ERROR: git status failed" >&2
    echo "RUN_DIR=$RUN_DIR"
    exit 1
fi

if [ -s "$RUN_DIR/GIT_STATUS.txt" ]; then
    echo "ERROR: Repository is dirty (uncommitted changes detected)" >&2
    cat "$RUN_DIR/GIT_STATUS.txt" >&2
    echo "RUN_DIR=$RUN_DIR"
    exit 1
fi

# ============================================================================
# Step 2: Validate StorageState if Present
# ============================================================================

if [ -f "$STATE_PATH" ]; then
    # Record proof without exposing content
    if ! sha256sum "$STATE_PATH" > "$RUN_DIR/storageState.sha256.txt"; then
        echo "ERROR: Failed to compute sha256 of storageState" >&2
        echo "RUN_DIR=$RUN_DIR"
        exit 1
    fi
    
    wc -c < "$STATE_PATH" > "$RUN_DIR/storageState.bytes.txt"
    
    # Validate JSON shape (cookies and origins must be arrays)
    VALIDATION_RESULT=$(python3 -c "
import json
try:
    with open('$STATE_PATH', 'r') as f:
        data = json.load(f)
    has_cookies = isinstance(data.get('cookies'), list)
    has_origins = isinstance(data.get('origins'), list)
    if has_cookies and has_origins:
        print('PASS')
        exit(0)
    else:
        print('FAIL')
        exit(1)
except Exception as e:
    print(f'FAIL: {str(e)}')
    exit(1)
" 2>&1) || VALIDATION_RESULT="FAIL"
    
    echo "$VALIDATION_RESULT" > "$RUN_DIR/storageState.shape.txt"
    
    if [ "$VALIDATION_RESULT" != "PASS" ]; then
        echo "ERROR: StorageState validation failed: $VALIDATION_RESULT" >&2
        echo "RUN_DIR=$RUN_DIR"
        exit 1
    fi
else
    echo "INFO: storageState.json not found (optional)" >&2
fi

# ============================================================================
# Step 3: Run Playwright Test (Capture Output & Exit Code)
# ============================================================================

PLAYWRIGHT_EXIT_CODE=0
npx playwright test e2e/tests/prod_dashboard_smoke.spec.ts --reporter=line 2>&1 | tee "$RUN_DIR/playwright_run.txt" || PLAYWRIGHT_EXIT_CODE=$?

# ============================================================================
# Step 4: Locate Child Evidence Directory
# ============================================================================

# Find the newest /tmp/ft_dashboard_smoke_* directory
NEWEST_EVIDENCE=$(find /tmp -maxdepth 1 -type d -name 'ft_dashboard_smoke_*' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | awk '{print $2}' || true)

if [ -z "$NEWEST_EVIDENCE" ]; then
    echo "ERROR: No /tmp/ft_dashboard_smoke_* evidence directory found after Playwright run" >&2
    echo "RUN_DIR=$RUN_DIR"
    exit 1
fi

echo "$NEWEST_EVIDENCE" > "$RUN_DIR/child_evidence_dir.txt"

# ============================================================================
# Step 5: Fail-Closed Decision
# ============================================================================

if [ $PLAYWRIGHT_EXIT_CODE -ne 0 ]; then
    echo "" >&2
    echo "ERROR: Playwright test exited with code $PLAYWRIGHT_EXIT_CODE" >&2
    echo "RUN_DIR=$RUN_DIR"
    exit 1
fi

# ============================================================================
# Step 6: Success Path
# ============================================================================

echo "PASS: $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$RUN_DIR/SUCCESS.txt"
echo "RUN_DIR=$RUN_DIR"
exit 0
