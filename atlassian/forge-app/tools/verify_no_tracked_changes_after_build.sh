#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "[POSTBUILD] Verifying repo cleanliness (fail-closed: only build-introduced tracked changes fail gate)..."

# HARD BAN (existing policy requirement retained)
if [ -e "BACKBONE_SNAPSHOT_FIX_COMPLETE.md" ]; then
  echo "[POSTBUILD] ❌ FAIL: Forbidden artifact detected: BACKBONE_SNAPSHOT_FIX_COMPLETE.md"
  exit 1
fi

# Capture postbuild tracked status
POSTBUILD_STATUS="$(git status --porcelain=v1 -uno | sort)"

# Write diagnostics to RUN_DIR if available
if [ -n "${RUN_DIR:-}" ]; then
  echo "$POSTBUILD_STATUS" > "$RUN_DIR/19_postbuild_tracked_status.txt"
  git diff > "$RUN_DIR/19_postbuild_tracked_diff.txt" 2>&1 || true
fi

# If prebuild snapshot exists, compare to detect build-introduced changes only
if [ -n "${FT_PREBUILD_TRACKED_STATUS_FILE:-}" ] && [ -f "$FT_PREBUILD_TRACKED_STATUS_FILE" ]; then
  echo "[POSTBUILD] Using prebuild snapshot: $FT_PREBUILD_TRACKED_STATUS_FILE"
  PREBUILD_STATUS="$(cat "$FT_PREBUILD_TRACKED_STATUS_FILE" | sort)"
  
  # Compute set difference: lines in postbuild not in prebuild
  BUILD_INTRODUCED_CHANGES="$(comm -13 <(echo "$PREBUILD_STATUS") <(echo "$POSTBUILD_STATUS"))"
  
  if [ -n "$BUILD_INTRODUCED_CHANGES" ]; then
    echo "[POSTBUILD] ❌ FAIL: Build introduced new tracked changes:"
    echo "$BUILD_INTRODUCED_CHANGES"
    exit 1
  else
    echo "[POSTBUILD] ✅ PASS: No build-introduced tracked changes detected."
    echo "[POSTBUILD] (Pre-existing changes: $(echo "$PREBUILD_STATUS" | grep -c . || echo 0) lines, unchanged by build)"
    exit 0
  fi
else
  # No prebuild snapshot - conservative behavior: fail if ANY tracked changes exist
  echo "[POSTBUILD] No prebuild snapshot available (conservative mode: fail on any tracked changes)"
  
  if [ -n "$POSTBUILD_STATUS" ]; then
    echo "[POSTBUILD] ❌ FAIL: Working tree has uncommitted/staged changes after build."
    echo "[POSTBUILD] git status --porcelain=v1 -uno (tracked/staged only):"
    echo "$POSTBUILD_STATUS"
    echo "[POSTBUILD] Hint: Set FT_PREBUILD_TRACKED_STATUS_FILE to enable smart change detection."
    exit 1
  fi
  
  # Redundant hard checks (defense-in-depth)
  git diff --exit-code -- . >/dev/null
  git diff --cached --exit-code -- . >/dev/null
  
  echo "[POSTBUILD] ✅ PASS: Repo clean after build (no uncommitted/staged changes)."
  exit 0
fi
