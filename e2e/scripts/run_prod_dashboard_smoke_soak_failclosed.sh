#!/usr/bin/env bash

set -euo pipefail

# ============================================================================
# Production Dashboard Smoke Test — Soak Runner (Fail-Closed)
# ============================================================================
# Purpose:
#   Repeatedly run the smoke test to prove stability under repeated executions.
#   Each iteration captures child run metadata and fails-closed on first failure.
#
# Environment variables:
#   FT_SOAK_RUNS           Number of iterations (default 10)
#   FT_SOAK_SLEEP_SECONDS  Delay between iterations (default 60)
#   FT_REQUIRE_CLEAN_TREE  Forwarded to underlying runner (optional)

# Defaults
FT_SOAK_RUNS="${FT_SOAK_RUNS:-10}"
FT_SOAK_SLEEP_SECONDS="${FT_SOAK_SLEEP_SECONDS:-60}"

cd /workspaces/Firsttry

# ============================================================================
# Create soak evidence directory
# ============================================================================

SOAK_RUN_DIR="/tmp/ft_prod_dashboard_smoke_soak_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$SOAK_RUN_DIR"
mkdir -p "$SOAK_RUN_DIR/runs"

# ============================================================================
# Write top-level metadata
# ============================================================================

echo "$SOAK_RUN_DIR" > "$SOAK_RUN_DIR/RUN_DIR.txt"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$SOAK_RUN_DIR/START_UTC.txt"
git rev-parse HEAD > "$SOAK_RUN_DIR/GIT_HEAD.txt"

DIRTY="$(git status --porcelain || true)"
printf "%s\n" "$DIRTY" > "$SOAK_RUN_DIR/GIT_STATUS.txt"

if [ -n "$DIRTY" ]; then
    echo "1" > "$SOAK_RUN_DIR/GIT_DIRTY.txt"
else
    echo "0" > "$SOAK_RUN_DIR/GIT_DIRTY.txt"
fi

# ============================================================================
# Soak loop
# ============================================================================

PASS_COUNT=0
FAIL_COUNT=0
COMPLETED_RUNS=0

echo "=== Soak Test (Fail-Closed) ==="
echo "Expecting $FT_SOAK_RUNS iterations (sleep ${FT_SOAK_SLEEP_SECONDS}s between)"
echo ""

for RUN_NUM in $(seq 1 "$FT_SOAK_RUNS"); do
    RUN_PAD=$(printf "%02d" "$RUN_NUM")
    RUN_DIR_ITER="$SOAK_RUN_DIR/runs/run_$RUN_PAD"
    mkdir -p "$RUN_DIR_ITER"
    
    echo -n "[Iteration $RUN_NUM/$FT_SOAK_RUNS] "
    
    # Snapshot child run dirs BEFORE
    CHILD_DIRS_BEFORE=$(find /tmp -maxdepth 1 -type d -name 'ft_prod_dashboard_smoke_run_*' 2>/dev/null | sort || true)
    
    # Run the underlying smoke runner
    RUNNER_EXIT=0
    date -u +"%Y-%m-%dT%H:%M:%SZ" > "$RUN_DIR_ITER/timestamp_utc.txt"
    
    bash e2e/scripts/run_prod_dashboard_smoke_failclosed.sh > /dev/null 2>&1 || RUNNER_EXIT=$?
    
    # Snapshot child run dirs AFTER
    CHILD_DIRS_AFTER=$(find /tmp -maxdepth 1 -type d -name 'ft_prod_dashboard_smoke_run_*' 2>/dev/null | sort || true)
    
    # Find new directory deterministically
    NEW_CHILD_DIR=""
    for dir in $CHILD_DIRS_AFTER; do
        if ! echo "$CHILD_DIRS_BEFORE" | grep -q "^$dir$"; then
            if [ -z "$NEW_CHILD_DIR" ]; then
                NEW_CHILD_DIR="$dir"
            else
                # More than one new dir found - fail closed
                echo "FAIL: Multiple new child directories detected"
                echo "$dir in $RUNNER_EXIT" > "$SOAK_RUN_DIR/ERROR.txt"
                echo "$SOAK_RUN_DIR" > "$SOAK_RUN_DIR/RUN_DIR.txt"
                exit 1
            fi
        fi
    done
    
    # Verify exactly one new dir was created
    if [ -z "$NEW_CHILD_DIR" ]; then
        # This might be ok if runner failed before creating child dir
        # But still fails this iteration
        echo "FAIL: No child directory created"
        echo "$RUNNER_EXIT" > "$RUN_DIR_ITER/exit_code.txt"
        echo "" > "$RUN_DIR_ITER/child_run_dir.txt"
        echo "0" > "$RUN_DIR_ITER/child_success.txt"
        
        # Write fail and stop
        echo "Iteration $RUN_NUM failed (exit $RUNNER_EXIT)" > "$SOAK_RUN_DIR/FAIL.txt"
        echo "RUN_DIR=$SOAK_RUN_DIR"
        echo "Run_DIR=$SOAK_RUN_DIR" >> "$SOAK_RUN_DIR/FAIL.txt"
        exit 1
    fi
    
    # Store per-iteration data
    echo "$RUNNER_EXIT" > "$RUN_DIR_ITER/exit_code.txt"
    echo "$NEW_CHILD_DIR" > "$RUN_DIR_ITER/child_run_dir.txt"
    
    # Check if child had SUCCESS.txt
    CHILD_SUCCESS=0
    if [ -f "$NEW_CHILD_DIR/SUCCESS.txt" ]; then
        CHILD_SUCCESS=1
    fi
    echo "$CHILD_SUCCESS" > "$RUN_DIR_ITER/child_success.txt"
    
    # Evaluate iteration result
    if [ "$RUNNER_EXIT" -ne 0 ] || [ "$CHILD_SUCCESS" -ne 1 ]; then
        # Failed
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo "FAIL (exit $RUNNER_EXIT, success=$CHILD_SUCCESS)"
        echo "Iteration $RUN_NUM failed" > "$SOAK_RUN_DIR/FAIL.txt"
        echo "Child dir: $NEW_CHILD_DIR" >> "$SOAK_RUN_DIR/FAIL.txt"
        echo "RUN_DIR=$SOAK_RUN_DIR"
        exit 1
    else
        # Passed
        PASS_COUNT=$((PASS_COUNT + 1))
        COMPLETED_RUNS=$((COMPLETED_RUNS + 1))
        echo "PASS"
    fi
    
    # Sleep before next iteration (unless last)
    if [ "$RUN_NUM" -lt "$FT_SOAK_RUNS" ]; then
        sleep "$FT_SOAK_SLEEP_SECONDS"
    fi
done

# ============================================================================
# All iterations passed
# ============================================================================

cat > "$SOAK_RUN_DIR/SUCCESS.txt" << SUCCESSEOF
All $COMPLETED_RUNS iterations passed at $(date -u +%Y-%m-%dT%H:%M:%SZ)
SUCCESSEOF

# ============================================================================
# Generate JSON summary
# ============================================================================

cat > "$SOAK_RUN_DIR/SUMMARY.json" << JSONEOF
{
  "start_utc": "$(cat "$SOAK_RUN_DIR/START_UTC.txt")",
  "git_head": "$(cat "$SOAK_RUN_DIR/GIT_HEAD.txt")",
  "runs_requested": $FT_SOAK_RUNS,
  "runs_completed": $COMPLETED_RUNS,
  "pass_count": $PASS_COUNT,
  "fail_count": $FAIL_COUNT,
  "sleep_seconds": $FT_SOAK_SLEEP_SECONDS,
  "child_run_dirs": [
JSONEOF

# Build child dirs array for JSON
FIRST=1
for i in $(seq 1 "$COMPLETED_RUNS"); do
    RUN_PAD=$(printf "%02d" "$i")
    CHILD_DIR=$(cat "$SOAK_RUN_DIR/runs/run_$RUN_PAD/child_run_dir.txt")
    if [ -n "$CHILD_DIR" ]; then
        if [ "$FIRST" -eq 1 ]; then
            echo "    \"$CHILD_DIR\"" >> "$SOAK_RUN_DIR/SUMMARY.json"
            FIRST=0
        else
            echo "    ,\"$CHILD_DIR\"" >> "$SOAK_RUN_DIR/SUMMARY.json"
        fi
    fi
done

echo "  ]" >> "$SOAK_RUN_DIR/SUMMARY.json"
echo "}" >> "$SOAK_RUN_DIR/SUMMARY.json"

echo ""
echo "RUN_DIR=$SOAK_RUN_DIR"
exit 0
