#!/bin/bash
# tools/verify_build_identity_pack.sh
#
# Verify that:
#  1. src/gadget-ui/src/build/buildIdentity.gen.ts exists
#  2. The UI_GIT_SHA in it matches git HEAD
#  3. Report mismatches with clear fail reason
#
# Exit: 0 if verified, 1 if mismatch or missing

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly BUILD_IDENTITY_FILE="$PROJECT_ROOT/src/gadget-ui/src/build/buildIdentity.gen.ts"

# ============================================================================
# CHECK 1: File exists
# ============================================================================
if [ ! -f "$BUILD_IDENTITY_FILE" ]; then
  echo "[FAIL_BUILD_IDENTITY] MISSING: $BUILD_IDENTITY_FILE"
  echo "REMEDIATION: Run 'node tools/gen_ui_build_identity.mjs' during build"
  exit 1
fi

# ============================================================================
# CHECK 2: Extract UI_GIT_SHA from generated file
# ============================================================================
UI_SHA_PATTERN="export const UI_GIT_SHA: string = '([0-9a-f]{40})';"
UI_GIT_SHA=$(grep -oP "$UI_SHA_PATTERN" "$BUILD_IDENTITY_FILE" | sed -E "s/export const UI_GIT_SHA: string = '([0-9a-f]{40})';/\1/" || true)

if [ -z "$UI_GIT_SHA" ] || [ ${#UI_GIT_SHA} -ne 40 ]; then
  echo "[FAIL_BUILD_IDENTITY] INVALID SHA in $BUILD_IDENTITY_FILE"
  echo "  Got: '$UI_GIT_SHA' (length: ${#UI_GIT_SHA})"
  echo "  Expected: 40-character hex string"
  exit 1
fi

# ============================================================================
# CHECK 3: Extract HEAD commit SHA
# ============================================================================
HEAD_SHA=$(cd "$PROJECT_ROOT" && git rev-parse HEAD)

if [ -z "$HEAD_SHA" ] || [ ${#HEAD_SHA} -ne 40 ]; then
  echo "[FAIL_BUILD_IDENTITY] INVALID HEAD SHA"
  echo "  Got: '$HEAD_SHA'"
  exit 1
fi

# ============================================================================
# CHECK 4: Verify match
# ============================================================================
if [ "$UI_GIT_SHA" != "$HEAD_SHA" ]; then
  echo "[FAIL_BUILD_IDENTITY] MISMATCH"
  echo "  UI_GIT_SHA: $UI_GIT_SHA"
  echo "  HEAD SHA:   $HEAD_SHA"
  echo ""
  echo "REMEDIATION: The generated build identity does not match HEAD."
  echo "  This means the UI bundle was not generated from current commit."
  echo "  Run: npm run build"
  exit 1
fi

# ============================================================================
# SUCCESS
# ============================================================================
echo "[PASS_BUILD_IDENTITY] UI_GIT_SHA matches HEAD"
echo "  SHA: $UI_GIT_SHA"
exit 0
