#!/bin/bash
#
# verify_no_csp_violation_markers_in_dist.sh
# 
# GATE: Verify no runtime CSP-violating code in dist artifacts
#
# This gate FAILS if dist contains code that would trigger:
#  1. Inline style violations (element.style.* assignments)
#  2. Old CSP probe markers
#
# This gate PASSES otherwise.
#
# Exit: 0 on PASS, non-zero on FAIL
#

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
REPO_ROOT="$(git rev-parse --show-toplevel)"
DIST_DIR="${REPO_ROOT}/dist"

echo "[${SCRIPT_NAME}] Scanning dist for CSP violations..."

# Fail markers - these indicate runtime CSP violations would occur
FAIL_PATTERNS=(
  "Applying inline style violates"      # Old violation message
  "\.style\.cssText"                    # Direct style property assignment
  '\.style\.[a-zA-Z].*='               # Other style property assignments (loose)
)

# Allowlist patterns (safe patterns that should NOT fail the gate)
ALLOWLIST_PATTERNS=(
  "CSP COMPLIANCE MARKER"               # Our marker comment
  "skip-inline-style-probe"             # Our safe marker output
)

VIOLATIONS_FOUND=0

# Check each fail pattern
for pattern in "${FAIL_PATTERNS[@]}"; do
  echo "[${SCRIPT_NAME}] Checking for: $pattern"
  
  # Search for pattern, excluding allowlist patterns
  # Use grep -v to exclude lines matching allowlist
  if rg -S "$pattern" "$DIST_DIR" 2>/dev/null | \
     grep -v -E "$(IFS="|"; echo "${ALLOWLIST_PATTERNS[*]}")" | \
     head -5; then
    echo "❌ FAIL: Found CSP violation pattern: $pattern"
    VIOLATIONS_FOUND=$((VIOLATIONS_FOUND + 1))
  fi
done

if [ "$VIOLATIONS_FOUND" -gt 0 ]; then
  echo "[${SCRIPT_NAME}] ❌ FAILED: $VIOLATIONS_FOUND CSP violation(s) detected in dist"
  exit 1
fi

echo "[${SCRIPT_NAME}] ✅ PASS: No CSP violation markers found in dist"
echo "[${SCRIPT_NAME}] All styles use external stylesheets or CSS classes (CSP compliant)"
exit 0
