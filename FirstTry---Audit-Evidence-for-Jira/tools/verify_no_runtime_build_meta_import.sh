#!/bin/bash
#
# verify_no_runtime_build_meta_import.sh
#
# BACKBONE GATE: Verify NO production UI files import from runtime/ui_build_meta
#
# This is a belt-and-suspenders check that runs at build time.
# If this fails, the build must stop.
#
# Exit codes:
#   0 = success (no violations)
#   1 = violations found
#

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UI_SRC_DIR="$PROJECT_ROOT/src/gadget-ui/src"

if [ ! -d "$UI_SRC_DIR" ]; then
  echo "[verify_no_runtime_build_meta_import] ERROR: UI source directory not found: $UI_SRC_DIR" >&2
  exit 1
fi

# Use rg (ripgrep) if available, fall back to grep
if command -v rg &>/dev/null; then
  # ripgrep version (faster, more flexible)
  # Exclude runtime/ directory itself, and common excluded patterns
  # NOTE: Use --type ts (which includes *.ts and *.tsx); --type tsx is not a separate type in rg
  # GATE: Match ONLY runtime/ui_build_meta imports (the forbidden pattern)
  VIOLATIONS=$(rg \
    --type ts \
    --type js \
    --glob '!node_modules' \
    --glob '!dist' \
    --glob '!build' \
    --glob '!coverage' \
    --glob '!.git' \
    --glob '!__tests__' \
    --glob '!runtime/**' \
    'from\s+['"'"'"](\.?/?)?runtime/ui_build_meta' \
    "$UI_SRC_DIR" || true)
else
  # grep version (slower, but portable)
  # GATE: Match ONLY runtime/ui_build_meta imports (the forbidden pattern)
  VIOLATIONS=$(find "$UI_SRC_DIR" \
    -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    ! -path "*/node_modules/*" \
    ! -path "*/dist/*" \
    ! -path "*/build/*" \
    ! -path "*/coverage/*" \
    ! -path "*/.git/*" \
    ! -path "*/__tests__/*" \
    ! -path "*/runtime/*" \
    -exec grep -l 'from\s\+['"'"'"].*runtime/ui_build_meta' {} \; || true)
fi

if [ -n "$VIOLATIONS" ]; then
  echo "[BACKBONE_GATE_FAILED] Production UI files must NEVER import from runtime/ui_build_meta" >&2
  echo "" >&2
  echo "Violations found:" >&2
  echo "$VIOLATIONS" >&2
  echo "" >&2
  echo "FIX: Change imports to use '../ui_build_meta' (the generated, not runtime version)" >&2
  exit 1
fi

echo "[BACKBONE_GATE_OK] No runtime/ui_build_meta imports in production UI code"
exit 0
