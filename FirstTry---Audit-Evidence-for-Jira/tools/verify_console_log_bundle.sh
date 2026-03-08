#!/bin/bash
#
# verify_console_log_bundle.sh
#
# GATE: Verify runtime console has NO errors attributable to OUR bundle
#
# Input: CONSOLE_LOG_FILE (path to browser console log)
#        Optional: RUN_DIR (for evidence capture)
#
# Exit: 0 on PASS (no our-bundle errors found)
#       1 on FAIL (errors found)
#       2 on SKIP (no log file provided)
#

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
CONSOLE_LOG_FILE="${CONSOLE_LOG_FILE:-}"
RUN_DIR="${RUN_DIR:-.}"
GIT_SHA_FULL="$(git rev-parse HEAD)"
GIT_SHA_SHORT="$(git rev-parse --short=7 HEAD)"
BUNDLE_PATTERN="app\\..*\\.js|app\\.${GIT_SHA_SHORT}"

# === SKIP if no log file provided ===
if [ -z "$CONSOLE_LOG_FILE" ] || [ ! -f "$CONSOLE_LOG_FILE" ]; then
  echo "[${SCRIPT_NAME}] SKIPPED: No console log file provided"
  echo "[${SCRIPT_NAME}] To verify: export CONSOLE_LOG_FILE=/path/to/console.txt"
  exit 2
fi

echo "[${SCRIPT_NAME}] Verifying console.log against bundle: $GIT_SHA_SHORT"
echo "[${SCRIPT_NAME}] Log file: $CONSOLE_LOG_FILE"

# === FAIL RULES ===
# These errors are attributed to OUR bundle if they mention our bundle name/sha

FAIL_PATTERNS=(
  "Applying inline style violates"      # CSP inline-style violation
  "Uncaught"                            # Uncaught JS error
  "TypeError"                           # Type error
  "ReferenceError"                      # Reference error
)

ALLOWLIST_PATTERNS=(
  "TeamCentralCardClient"
  "gateway/api/townsquare"
  "gateway/api/watermelon"
  "/rest/api/3/mypreferences"
  "FeatureGateClients"
  "removeOldAnalytics"
  "AJS"
  "IndexedDB timed out"
  "removeInteractionsCallback"
)

VIOLATIONS_FOUND=0
EVIDENCE_FILE="${RUN_DIR}/20_console_gate_violations.txt"

# === CHECK for each fail pattern ===
for pattern in "${FAIL_PATTERNS[@]}"; do
  echo "[${SCRIPT_NAME}] Checking: $pattern"
  
  # Find lines matching pattern
  # BUT exclude allowlist patterns and Jira internal errors
  if grep -i "$pattern" "$CONSOLE_LOG_FILE" 2>/dev/null | \
     grep -v -E "$(IFS="|"; echo "${ALLOWLIST_PATTERNS[*]}")" > /tmp/console_match.txt 2>&1; then
    
    # Now check if any match mentions our bundle
    if grep -E "$BUNDLE_PATTERN" /tmp/console_match.txt > /dev/null 2>&1; then
      echo "❌ FAIL: Found $pattern in our bundle"
      cat /tmp/console_match.txt | tee -a "$EVIDENCE_FILE"
      VIOLATIONS_FOUND=$((VIOLATIONS_FOUND + 1))
    fi
  fi
done

rm -f /tmp/console_match.txt

if [ "$VIOLATIONS_FOUND" -gt 0 ]; then
  echo "[${SCRIPT_NAME}] ❌ FAILED: $VIOLATIONS_FOUND error(s) in our bundle"
  exit 1
fi

echo "[${SCRIPT_NAME}] ✅ PASS: No CSP or runtime errors in our bundle console"
exit 0
