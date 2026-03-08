#!/bin/bash
##############################################################################
# verify_ui_naming_contract.sh
# 
# STRICT CONTRACT ENFORCEMENT:
# Ensures the gadget-ui codebase uses ONLY clean naming conventions.
# 
# BANNED TOKENS (anywhere in src/gadget-ui/):
#   - UI_BUILD_SHA (use UI_GIT_SHA or __FT_BUILD_SHA__ instead)
#   - ui_artifact_sha (use ui_git_sha instead)
#
# EXIT CODE:
#   0 = PASS (contract upheld)
#   1 = FAIL (contract violated)
##############################################################################

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${REPO_ROOT}/src/gadget-ui"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 UI Naming Contract Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Target: ${TARGET_DIR}"
echo "Banned tokens: UI_BUILD_SHA, ui_artifact_sha"
echo ""

# Check for banned tokens
if rg -n "UI_BUILD_SHA|ui_artifact_sha" "${TARGET_DIR}" 2>/dev/null; then
  echo ""
  echo "❌ FAIL: Banned naming tokens found in gadget-ui"
  echo "   Replace UI_BUILD_SHA with UI_GIT_SHA or __FT_BUILD_SHA__"
  echo "   Replace ui_artifact_sha with ui_git_sha"
  exit 1
else
  echo "✅ PASS: Zero matches of banned naming tokens"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
fi
