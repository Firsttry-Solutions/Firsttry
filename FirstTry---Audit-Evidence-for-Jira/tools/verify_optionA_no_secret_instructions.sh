#!/usr/bin/env bash
set -euo pipefail

# Verify: Option A has no secret instruction footguns
# Scans for dangerous patterns that expose base64 state to stdout/logs
# Excludes documentation about what NOT to do (marked with DO NOT, ❌, or in code comments)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Files to scan
FILES_TO_CHECK=(
  "${REPO_ROOT}/scripts/proof/optionA_generate_state_with_novnc.sh"
  "${REPO_ROOT}/docs/PLAYWRIGHT_SSO_AUTH_STATE.md"
)

FOUND_ISSUES=0

echo "[GATE] Scanning for secret instruction footguns..."
echo ""

# Scan wrapper script for ACTUAL bad instructions (not warnings)
echo "[GATE] Checking: ${FILES_TO_CHECK[0]}"
WRAPPER_FILE="${FILES_TO_CHECK[0]}"

# In wrapper: flag ONLY if we see the actual dangerous instruction being EXECUTED
# (not in warnings, reminders, or comments)
# Dangerous pattern: echo "   export FT_PLAYWRIGHT_STATE_B64="$(cat /tmp/state.b64)""
if grep 'echo.*export FT_PLAYWRIGHT_STATE_B64.*\$(' "$WRAPPER_FILE" 2>/dev/null | grep -v "^[[:space:]]*#" | grep -v "DO NOT" > /dev/null; then
  echo "[GATE] ❌ FAILED: Found dangerous export instruction in wrapper"
  grep -n 'echo.*export FT_PLAYWRIGHT_STATE_B64' "$WRAPPER_FILE" | grep -v "^[[:space:]]*#" | grep -v "DO NOT"
  FOUND_ISSUES=$((FOUND_ISSUES + 1))
fi

echo "[GATE] Checking: ${FILES_TO_CHECK[1]}"
DOCS_FILE="${FILES_TO_CHECK[1]}"

# In docs: flag ONLY if we see code that EXECUTES the dangerous pattern
# Safe: comments/warnings saying "DO NOT run cat /tmp/state.b64"
# Unsafe: code blocks showing bash that EXECUTES cat/export
# Dangerous patterns in docs (only if in executable code, not in warnings):
#  1. "export FT_PLAYWRIGHT_STATE_B64=\"\$(cat /tmp/state.b64)\"" in bash code (not in ❌ block)
#  2. "cat /tmp/state.b64" in a code block without ❌ prefix

# Check for: export FT_PLAYWRIGHT_STATE_B64="$(cat /tmp/state.b64)" in actual code (not in ❌ DO NOT sections)
if grep 'export FT_PLAYWRIGHT_STATE_B64.*\$.*cat /tmp/state\.b64' "$DOCS_FILE" 2>/dev/null | grep -v "^.*❌\|^.*DO NOT\|^.*CRITICAL\|^.*Security Note" > /dev/null; then
  echo "[GATE] ❌ FAILED: Found actual dangerous export in docs (not in warning section)"
  grep -n 'export FT_PLAYWRIGHT_STATE_B64.*\$.*cat /tmp/state\.b64' "$DOCS_FILE" | grep -v "❌" | grep -v "DO NOT"
  FOUND_ISSUES=$((FOUND_ISSUES + 1))
fi

echo ""

if [[ $FOUND_ISSUES -gt 0 ]]; then
  echo "[GATE] ❌ FAILED: Found $FOUND_ISSUES dangerous pattern(s)"
  exit 1
fi

echo "[GATE] ✅ PASS: No secret instruction footguns detected"
exit 0

