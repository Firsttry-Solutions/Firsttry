#!/bin/bash
# guard_no_auth_state_leak.sh
# Purpose: Non-bypassable guardrail to prevent auth state leaks (tracking, CI artifacts, secret echoes).
# Contract-true: exact JSON schema, deterministic evidence, fail-closed.

set -euo pipefail

# ============================================================================
# Configuration
# ============================================================================
STATE_FILE="tests/playwright/.auth/state.json"
FT_GUARD_PHASE="${FT_GUARD_PHASE:-pre}"
FT_GUARD_EXPECT_STATE_CLEANUP="${FT_GUARD_EXPECT_STATE_CLEANUP:-0}"
GUARD_DIR="/tmp/pw_state_guard_$(date -u +"%Y-%m-%dT%H%M%SZ")"
mkdir -p "$GUARD_DIR"

# Initialize evidence (will be overwritten with deterministic values)
RESULT="OK"
REASON_CODE="UNKNOWN"
VIOLATIONS=0
TRACKED=false
STAGED=false
STATE_EXISTS=false
NEWEST_OUT_DIR=""
OUT_DIR_HAS_STATE=false
ECHO_RISK=false

# ============================================================================
# Helper: Fail with reason code (priority-based)
# ============================================================================
set_failure() {
  local code="$1"
  local should_fail="false"
  
  # Priority order: first failure wins
  if [ "$REASON_CODE" = "UNKNOWN" ]; then
    REASON_CODE="$code"
    RESULT="FAIL"
    VIOLATIONS=$((VIOLATIONS + 1))
    should_fail="true"
  fi
}

# ============================================================================
# Check 1: STATE_FILE_TRACKED (priority 1)
# ============================================================================
check_tracked() {
  echo "[STATE_GUARD] Checking if state.json is tracked by git..."
  
  # Check if tracked
  if git ls-files --error-unmatch "$STATE_FILE" 2>/dev/null; then
    echo "[STATE_GUARD] ERROR: $STATE_FILE is tracked by git" >&2
    TRACKED=true
    set_failure "STATE_FILE_TRACKED"
    return
  fi
  
  # Check if staged
  if git diff --name-only --cached 2>/dev/null | grep -Fx "$STATE_FILE" >/dev/null; then
    echo "[STATE_GUARD] ERROR: $STATE_FILE is staged in git" >&2
    STAGED=true
    set_failure "STATE_FILE_TRACKED"
    return
  fi
}

# ============================================================================
# Check 2: STATE_SECRET_ECHO_RISK (priority 2)
# ============================================================================
check_secret_echo_risk() {
  echo "[STATE_GUARD] Checking for secret echo risks..."
  
  # Check 1: install_state_from_env.sh must not have set -x
  local install_script="scripts/proof/install_state_from_env.sh"
  if [ -f "$install_script" ]; then
    if grep -E "^set -x|^[[:space:]]*set -x" "$install_script" 2>/dev/null | grep -v "^#" >/dev/null; then
      echo "[STATE_GUARD] ERROR: $install_script contains 'set -x' (would echo secrets)" >&2
      ECHO_RISK=true
      set_failure "STATE_SECRET_ECHO_RISK"
      return
    fi
  fi
  
  # Check 2: workflow must not echo FT_AUTH_STATE_JSON_B64
  local workflow_file=".github/workflows/pw_dashboard_state_only.yml"
  if [ -f "$workflow_file" ]; then
    # Disallowed patterns: (echo|printenv|env\s*\|) followed by anything with FT_AUTH_STATE_JSON_B64
    if grep -E '(echo|printenv|env\s*\|).*FT_AUTH_STATE_JSON_B64' "$workflow_file" 2>/dev/null | grep -v "^[[:space:]]*#" >/dev/null; then
      echo "[STATE_GUARD] ERROR: Workflow contains echo/printenv/pipe of FT_AUTH_STATE_JSON_B64" >&2
      ECHO_RISK=true
      set_failure "STATE_SECRET_ECHO_RISK"
      return
    fi
    # Also disallowed: ::add-mask:: (we don't mask; we avoid printing)
    if grep '::add-mask::.*FT_AUTH_STATE_JSON_B64' "$workflow_file" 2>/dev/null >/dev/null; then
      echo "[STATE_GUARD] ERROR: Workflow attempts to mask FT_AUTH_STATE_JSON_B64 (should not print it)" >&2
      ECHO_RISK=true
      set_failure "STATE_SECRET_ECHO_RISK"
      return
    fi
  fi
}

# ============================================================================
# Check 3: STATE_FILE_PRESENT_IN_ARTIFACT_DIR (post phase only, priority 3)
# ============================================================================
check_artifact_dir() {
  if [ "$FT_GUARD_PHASE" != "post" ]; then
    return
  fi
  
  echo "[STATE_GUARD] Checking artifact directories for state.json..."
  
  local latest_out_dir=$(ls -1dt /tmp/pw_dash_diag_* 2>/dev/null | head -1)
  
  if [ -z "$latest_out_dir" ]; then
    echo "[STATE_GUARD] WARNING: No output directory /tmp/pw_dash_diag_* found" >&2
    # Don't fail here; this could be a valid miss
    return
  fi
  
  NEWEST_OUT_DIR="$latest_out_dir"
  
  if find "$latest_out_dir" -name "state.json" 2>/dev/null | head -1 | grep -q .; then
    echo "[STATE_GUARD] ERROR: state.json found in artifact directory" >&2
    OUT_DIR_HAS_STATE=true
    set_failure "STATE_FILE_PRESENT_IN_ARTIFACT_DIR"
    return
  fi
}

# ============================================================================
# Check 4: STATE_FILE_PRESENT_IN_REPO (post phase only, priority 4, conditional)
# ============================================================================
check_repo_cleanup() {
  if [ "$FT_GUARD_PHASE" != "post" ]; then
    return
  fi
  
  if [ "$FT_GUARD_EXPECT_STATE_CLEANUP" != "1" ]; then
    return
  fi
  
  echo "[STATE_GUARD] Checking if state.json was cleaned up from repo..."
  
  if [ -f "$STATE_FILE" ]; then
    echo "[STATE_GUARD] ERROR: $STATE_FILE still exists in repo (should have been cleaned)" >&2
    STATE_EXISTS=true
    set_failure "STATE_FILE_PRESENT_IN_REPO"
    return
  fi
}

# ============================================================================
# Run all checks
# ============================================================================
check_tracked
check_secret_echo_risk
check_artifact_dir
check_repo_cleanup

# ============================================================================
# Write deterministic evidence JSON (EXACT contract schema)
# ============================================================================
EVIDENCE_FILE="$GUARD_DIR/state-guard-result.json"

node -e "
const fs = require('fs');
const details = {
  echoRisk: $( [ "$ECHO_RISK" = "true" ] && echo "true" || echo "false" ),
  newestOutDir: \"$NEWEST_OUT_DIR\",
  outDirHasState: $( [ "$OUT_DIR_HAS_STATE" = "true" ] && echo "true" || echo "false" ),
  phase: \"$FT_GUARD_PHASE\",
  staged: $( [ "$STAGED" = "true" ] && echo "true" || echo "false" ),
  stateExists: $( [ "$STATE_EXISTS" = "true" ] && echo "true" || echo "false" ),
  statePath: \"$STATE_FILE\",
  tracked: $( [ "$TRACKED" = "true" ] && echo "true" || echo "false" ),
  violations: $VIOLATIONS
};

const evidence = {
  reasonCode: \"$REASON_CODE\",
  result: \"$RESULT\"
};

// Insert details in alphabetical order
evidence.details = {};
Object.keys(details).sort().forEach(k => evidence.details[k] = details[k]);

// Write with exact key order: result, reasonCode, details
const ordered = {};
['result', 'reasonCode', 'details'].forEach(k => ordered[k] = evidence[k]);

fs.writeFileSync('$EVIDENCE_FILE', JSON.stringify(ordered, null, 2) + '\n');
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
  echo "[STATE_GUARD] ✗ Violations detected ($VIOLATIONS): $REASON_CODE" >&2
  exit 1
fi
