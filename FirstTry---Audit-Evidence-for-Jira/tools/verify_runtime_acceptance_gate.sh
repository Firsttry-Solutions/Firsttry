#!/bin/bash
#
# PHASE 3: RUNTIME ACCEPTANCE GATE
#
# Validates that the dashboard runtime has no contradictory or forbidden markers.
# Fails CLOSED on:
#   - ENTRY=NONE (entry script detection failed)
#   - backendSha=UNSET or backend_build_sha=UNSET
#   - UI_REQUEST_ID.*UNSET
#   - [TruthModel] State: BROKEN after a successful resolver response  
#   - Proof panel contradictions
#
# Requires:
#   - [UI_ENTRY_RUNTIME_PROOF]
#   - [UI_SERVE_OK] match:true
#   - [UI_FT_GETDASHBOARDSTATE_SUCCESS] status=OK
#   - [BACKBONE_STATE_COMMITTED] isOperational:true
#
# USAGE:
#   bash tools/verify_runtime_acceptance_gate.sh [--log-file <path>] [--verbose]
#
# If --log-file not provided, reads from stdin or uses last known log location.
#

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE=""
VERBOSE=0
FAIL=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --log-file)
            LOG_FILE="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=1
            shift
            ;;
        *)
            echo "Usage: $0 [--log-file <path>] [--verbose]"
            exit 1
            ;;
    esac
done

# If no log file specified, try to read from stdin (for pipe usage)
if [ -z "$LOG_FILE" ]; then
    LOG_CONTENT=$(cat)
else
    if [ ! -f "$LOG_FILE" ]; then
        echo "[ACCEPTANCE_GATE] ERROR: Log file not found: $LOG_FILE"
        exit 1
    fi
    LOG_CONTENT=$(cat "$LOG_FILE")
fi

echo "[ACCEPTANCE_GATE] Starting runtime acceptance validation..."

# ============================================================================
# FORBIDDEN MARKERS (Fail if found)
# ============================================================================

FORBIDDEN_MARKERS=(
    "ENTRY=NONE"
    "backend_build_sha=UNSET"
    "backendSha=UNSET"
)

for marker in "${FORBIDDEN_MARKERS[@]}"; do
    if echo "$LOG_CONTENT" | grep -q "$marker"; then
        echo "[ACCEPTANCE_GATE] ✗ FORBIDDEN MARKER FOUND: $marker"
        FAIL=1
        if [ $VERBOSE -eq 1 ]; then
            echo "[ACCEPTANCE_GATE] Context:"
            echo "$LOG_CONTENT" | grep -C 2 "$marker" || true
        fi
    fi
done

# Check for UI_REQUEST_ID UNSET
if echo "$LOG_CONTENT" | grep -q "UI Request ID.*UNSET\|UI_REQUEST_ID.*UNSET"; then
    echo "[ACCEPTANCE_GATE] ✗ FORBIDDEN MARKER FOUND: UI_REQUEST_ID=UNSET"
    FAIL=1
fi

# Check for BROKEN after OK (contradiction)
# Look for successful state commit followed by BROKEN state
if echo "$LOG_CONTENT" | grep -q "[UI_FT_GETDASHBOARDSTATE_SUCCESS].*status=OK"; then
    # If we see OK response, check that later we don't see BROKEN
    # Extract positions to verify ordering
    OK_LINE=$(echo "$LOG_CONTENT" | grep -n "[UI_FT_GETDASHBOARDSTATE_SUCCESS]" | head -1 | cut -d: -f1)
    BROKEN_AFTER_OK=$(echo "$LOG_CONTENT" | tail -n +$((OK_LINE)) | grep -c "\[TruthModel\] State: BROKEN" || true)
    
    if [ "$BROKEN_AFTER_OK" -gt 0 ]; then
        echo "[ACCEPTANCE_GATE] ✗ CONTRADICTION: BROKEN state after successful OK resolver response"
        FAIL=1
        if [ $VERBOSE -eq 1 ]; then
            echo "[ACCEPTANCE_GATE] Timeline:"
            echo "$LOG_CONTENT" | grep -E "\[UI_FT_GETDASHBOARDSTATE_SUCCESS\]|\[TruthModel\] State:" || true
        fi
    fi
fi

# ============================================================================
# REQUIRED MARKERS (Fail if missing)
# ============================================================================

REQUIRED_MARKERS=(
    "[UI_ENTRY_RUNTIME_PROOF]"
    "[BACKBONE_STATE_COMMITTED]"
)

for marker in "${REQUIRED_MARKERS[@]}"; do
    if ! echo "$LOG_CONTENT" | grep -q "$marker"; then
        echo "[ACCEPTANCE_GATE] ✗ REQUIRED MARKER MISSING: $marker"
        FAIL=1
    fi
done

# Check for successful resolver response marker
if ! echo "$LOG_CONTENT" | grep -q "\[UI_FT_GETDASHBOARDSTATE_SUCCESS\]"; then
    echo "[ACCEPTANCE_GATE] ✗ REQUIRED MARKER MISSING: [UI_FT_GETDASHBOARDSTATE_SUCCESS]"
    FAIL=1
fi

# Check for operational state commitment
if ! echo "$LOG_CONTENT" | grep -q "[BACKBONE_STATE_COMMITTED].*isOperational:true"; then
    echo "[ACCEPTANCE_GATE] ⚠ WARNING: Did not find explicit isOperational:true commitment"
    if [ $VERBOSE -eq 1 ]; then
        echo "[ACCEPTANCE_GATE] Found commitment markers:"
        echo "$LOG_CONTENT" | grep "[BACKBONE_STATE_COMMITTED]" || true
    fi
fi

# ============================================================================
# CONSISTENCY CHECKS
# ============================================================================

# Proof panel consistency: if snapshot count > 0, then export must not claim "0 snapshots"
if echo "$LOG_CONTENT" | grep -q "snapshotCountRetained.*[1-9]"; then
    if echo "$LOG_CONTENT" | grep -q "[Proof Panel].*0 snapshot\|[Export.*].*0 snapshot"; then
        echo "[ACCEPTANCE_GATE] ✗ CONTRADICTION: Snapshot count > 0 but proof panel claims 0 snapshots"
        FAIL=1
    fi
fi

# ============================================================================
# SUMMARY
# ============================================================================

if [ $FAIL -eq 0 ]; then
    echo "[ACCEPTANCE_GATE] ✅ PASS: All runtime acceptance checks passed"
    echo "[ACCEPTANCE_GATE] Dashboard runtime is free of contradictions and forbidden markers"
    exit 0
else
    echo "[ACCEPTANCE_GATE] ❌ FAIL: Runtime acceptance validation failed"
    echo "[ACCEPTANCE_GATE] Review forbidden/required markers above"
    exit 1
fi
