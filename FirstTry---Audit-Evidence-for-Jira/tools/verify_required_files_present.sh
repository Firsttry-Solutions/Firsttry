#!/bin/bash
# PHASE 3: verify_required_files_present.sh
# Prevents critical files from silently disappearing (e.g., trace_helpers.ts)
# FAILS if any required file is missing from source tree

REPO_ROOT="${1:-.}"

echo "[GATE_REQUIRED_FILES] Checking required files..."

REQUIRED_FILES=(
    "src/trace/trace_helpers.ts"
    "src/trace/trace_types.ts"
    "src/gadget-ui/src/ui_identity.ts"
    "src/gadget-ui/src/legacy_flow_detector.ts"
    "tools/verify_dist_invoke_allowlist.sh"
    "tools/verify_dist_identity_labels.sh"
)

MISSING=0
FOUND=0

for file in "${REQUIRED_FILES[@]}"; do
    FULL_PATH="$REPO_ROOT/$file"
    if [ -f "$FULL_PATH" ]; then
        echo "  ✓ $(basename "$file")"
        FOUND=$((FOUND + 1))
    else
        echo "  ✗ MISSING: $file"
        MISSING=$((MISSING + 1))
    fi
done

echo "[GATE_REQUIRED_FILES] Found: $FOUND, Missing: $MISSING"

if [ $MISSING -eq 0 ]; then
    echo "[GATE_REQUIRED_FILES] PASS"
    exit 0
else
    echo "[GATE_REQUIRED_FILES] FAIL"
    exit 1
fi
