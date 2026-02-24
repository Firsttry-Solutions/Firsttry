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
# Step 1: Record Git Status (Allow Dirty Tree by Default)
# ============================================================================

DIRTY="$(git status --porcelain || true)"
printf "%s\n" "$DIRTY" > "$RUN_DIR/GIT_STATUS.txt"

if [ -n "$DIRTY" ]; then
    echo "1" > "$RUN_DIR/GIT_DIRTY.txt"
    echo "WARN: git working tree dirty (continuing). Set FT_REQUIRE_CLEAN_TREE=1 to fail-closed." | tee -a "$RUN_DIR/WARNINGS.txt"
    if [ "${FT_REQUIRE_CLEAN_TREE:-0}" = "1" ]; then
        echo "FAIL: dirty working tree and FT_REQUIRE_CLEAN_TREE=1" | tee -a "$RUN_DIR/ERROR.txt"
        echo "RUN_DIR=$RUN_DIR"
        exit 1
    fi
else
    echo "0" > "$RUN_DIR/GIT_DIRTY.txt"
fi

# ============================================================================
# Step 2: Validate StorageState if Present
# ============================================================================

if [ -f "$STATE_PATH" ]; then
    sha256sum "$STATE_PATH" | awk '{print $1}' > "$RUN_DIR/storageState.sha256.txt"
    wc -c < "$STATE_PATH" | tr -d ' ' > "$RUN_DIR/storageState.bytes.txt"
    
    set +e
    python3 - <<'PY'
import json, sys
p = "/workspaces/Firsttry/e2e/.auth/storageState.json"
with open(p, "r", encoding="utf-8") as f:
    d = json.load(f)
if not isinstance(d, dict):
    raise SystemExit("storageState not an object")
cookies = d.get("cookies")
origins = d.get("origins")
if not isinstance(cookies, list):
    raise SystemExit("cookies not a list")
if not isinstance(origins, list):
    raise SystemExit("origins not a list")
print("OK")
PY
    PY_RC=$?
    set -e
    
    if [ "$PY_RC" -eq 0 ]; then
        echo "PASS" > "$RUN_DIR/storageState.shape.txt"
    else
        echo "FAIL" > "$RUN_DIR/storageState.shape.txt"
        echo "FAIL: storageState JSON shape invalid" > "$RUN_DIR/storageState.shape_error.txt"
        echo "RUN_DIR=$RUN_DIR"
        exit 1
    fi
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
