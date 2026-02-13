#!/bin/bash
# guard_no_auth_state_leak.sh
# Purpose: Non-bypassable guardrail to prevent auth state leaks (tracking, CI artifacts, secret echoes).
# Used in CI (pre/post workflow phases) and local testing.
# Fails immediately if violations detected; writes deterministic evidence JSON.

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
STATE_FILE="tests/playwright/.auth/state.json"
STATE_DIR="$(dirname "$STATE_FILE")"
FT_GUARD_PHASE="${FT_GUARD_PHASE:-pre}"  # "pre" or "post"
GUARD_DIR="/tmp/pw_state_guard_$(date -u +"%Y-%m-%dT%H%M%SZ")"
mkdir -p "$GUARD_DIR"

RESULT="OK"
REASON_CODE="STATE_GUARD_OK"
VIOLATIONS=0

# ============================================================================
# Pre-phase checks
# ============================================================================
if [ "$FT_GUARD_PHASE" = "pre" ]; then
  echo "[STATE_GUARD] Phase: PRE (before state injection)"
  
  # Check 1: state.json MUST NOT be tracked or staged
  if git ls-files --error-unmatch "$STATE_FILE" 2>/dev/null; then
    echo "[STATE_GUARD] ERROR: $STATE_FILE is tracked by git (violation)" >&2
    RESULT="FAIL"
    REASON_CODE="STATE_FILE_TRACKED"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
  
  if git diff --name-only --cached 2>/dev/null | grep -q "$(echo "$STATE_FILE" | sed 's/\//\\\//g')"; then
    echo "[STATE_GUARD] ERROR: $STATE_FILE is staged in git (violation)" >&2
    RESULT="FAIL"
    REASON_CODE="STATE_FILE_TRACKED"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
  
  # Check 2: Guard against secret echo risks in workflow
  # Ensure pw_dashboard_state_only.yml does NOT contain bare echo of FT_AUTH_STATE_JSON_B64
  WORKFLOW_FILE=".github/workflows/pw_dashboard_state_only.yml"
  if [ -f "$WORKFLOW_FILE" ]; then
    # This is a *simple* heuristic: flag if echo+var appears in workflow
    if grep -E "echo.*\$.*FT_AUTH_STATE_JSON_B64|echo.*FT_AUTH_STATE_JSON_B64" "$WORKFLOW_FILE" 2>/dev/null; then
      echo "[STATE_GUARD] ERROR: Workflow contains echo of FT_AUTH_STATE_JSON_B64 (secret echo risk)" >&2
      RESULT="FAIL"
      REASON_CODE="STATE_SECRET_ECHO_RISK"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi
  
  # Check 3: Guard against set -x in install_state_from_env.sh (would echo secrets)
  INSTALL_SCRIPT="scripts/proof/install_state_from_env.sh"
  if [ -f "$INSTALL_SCRIPT" ]; then
    if grep -E "^set -x|^[[:space:]]*set -x" "$INSTALL_SCRIPT" 2>/dev/null | grep -v "^#"; then
      echo "[STATE_GUARD] ERROR: $INSTALL_SCRIPT contains 'set -x' (would echo secrets)" >&2
      RESULT="FAIL"
      REASON_CODE="STATE_SECRET_ECHO_RISK"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi

# ============================================================================
# Post-phase checks
# ============================================================================
elif [ "$FT_GUARD_PHASE" = "post" ]; then
  echo "[STATE_GUARD] Phase: POST (after Playwright run, before artifact upload)"
  
  # Check 1: Newest test output dir must NOT contain state.json
  LATEST_TEST_DIR=$(ls -1dt /tmp/pw_dash_diag_* 2>/dev/null | head -1)
  if [ -n "$LATEST_TEST_DIR" ] && [ -d "$LATEST_TEST_DIR" ]; then
    if [ -f "$LATEST_TEST_DIR/$STATE_FILE" ]; then
      echo "[STATE_GUARD] ERROR: state.json found in test artifact directory ($LATEST_TEST_DIR)" >&2
      RESULT="FAIL"
      REASON_CODE="STATE_FILE_PRESENT_IN_ARTIFACT_DIR"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
    # Also check with just filename in case it leaked
    if [ -f "$LATEST_TEST_DIR/state.json" ]; then
      echo "[STATE_GUARD] ERROR: state.json found in test directory (leaked artifact)" >&2
      RESULT="FAIL"
      REASON_CODE="STATE_FILE_PRESENT_IN_ARTIFACT_DIR"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi
  
  # Check 2: state.json should exist (injected) but MUST NOT be in repo
  if [ -f "$STATE_FILE" ]; then
    if git ls-files --error-unmatch "$STATE_FILE" 2>/dev/null; then
      echo "[STATE_GUARD] ERROR: $STATE_FILE exists AND is tracked (should be untracked)" >&2
      RESULT="FAIL"
      REASON_CODE="STATE_FILE_TRACKED"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi
  
  # Check 3: Verify .gitignore includes state.json patterns
  if [ -f ".gitignore" ]; then
    if ! grep -q "tests/playwright/.auth/state.json" ".gitignore"; then
      echo "[STATE_GUARD] ERROR: .gitignore missing tests/playwright/.auth/state.json pattern" >&2
      RESULT="FAIL"
      REASON_CODE="UNKNOWN"
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  fi
  
  # Check 4: No echo of secrets in recent logs (heuristic)
  # Look for suspicious patterns in Playwright logs
  if [ -n "$LATEST_TEST_DIR" ] && [ -d "$LATEST_TEST_DIR" ]; then
    if grep -r "FT_AUTH_STATE_JSON_B64" "$LATEST_TEST_DIR" 2>/dev/null | grep -v "^Binary"; then
      echo "[STATE_GUARD] WARNING: FT_AUTH_STATE_JSON_B64 reference found in logs (check for secret leak)" >&2
      # This is a warning, not a hard fail, since it might be a comment
    fi
  fi
fi

# ============================================================================
# Write deterministic evidence JSON (no timestamps inside, stable key ordering)
# ============================================================================
EVIDENCE_FILE="$GUARD_DIR/state-guard-result.json"

node -e "
const fs = require('fs');
const evidence = {
  reason_code: '$REASON_CODE',
  result: '$RESULT',
  violations: $VIOLATIONS,
  phase: '$FT_GUARD_PHASE'
};
// Sort keys for deterministic JSON
const sorted = {};
Object.keys(evidence).sort().forEach(k => sorted[k] = evidence[k]);
fs.writeFileSync('$EVIDENCE_FILE', JSON.stringify(sorted, null, 2) + '\n');
" 2>/dev/null || true

echo "[STATE_GUARD] Evidence written to $EVIDENCE_FILE"
cat "$EVIDENCE_FILE"

# ============================================================================
# Exit with appropriate code
# ============================================================================
if [ "$RESULT" = "OK" ]; then
  echo "[STATE_GUARD] ✓ All checks passed"
  exit 0
else
  echo "[STATE_GUARD] ✗ Violations detected ($VIOLATIONS)" >&2
  exit 1
fi
