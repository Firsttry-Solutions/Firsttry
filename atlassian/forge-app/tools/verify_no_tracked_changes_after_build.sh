#!/bin/bash
#
# verify_no_tracked_changes_after_build.sh
# 
# REGRESSION GATE: Verify that build does NOT modify any tracked source files.
# 
# FAIL CONDITIONS:
#   - git status --porcelain shows any modified tracked files (not untracked, not ignored)
#   - exit code 1 if violations found
#
# SUCCESS:
#   - All changes are either untracked or explicitly gitignored
#   - exit code 0

set -euo pipefail

echo "[GATE] Checking for tracked file modifications after build..."

# Check if git tree has any modified tracked files
# Format: git status --porcelain shows lines like " M file.ts"
# We want to FAIL if we see modifications to tracked files.

TRACKED_CHANGES=$(git status --porcelain | grep -E '^ M ' || true)

if [ -n "$TRACKED_CHANGES" ]; then
  echo "❌ FAIL: Build modified tracked source files:"
  echo "$TRACKED_CHANGES" | sed 's/^/  /'
  echo ""
  echo "These files MUST be in .gitignore or their changes must be deterministic."
  exit 1
fi

# STRICT CHECK: BACKBONE_SNAPSHOT_FIX_COMPLETE.md must never appear untracked
UNTRACKED=$(git status --porcelain | grep -E '^\?\? ' || true)

if echo "$UNTRACKED" | grep -q "BACKBONE_SNAPSHOT_FIX_COMPLETE.md"; then
  echo "❌ FAIL: Untracked artifact BACKBONE_SNAPSHOT_FIX_COMPLETE.md detected after build"
  echo "This file must be in .gitignore and removed from working directory"
  exit 1
fi

# HARD FILE EXISTENCE CHECK: Forbidden artifact must not exist on disk at all
if [ -e "BACKBONE_SNAPSHOT_FIX_COMPLETE.md" ]; then
  echo "❌ FAIL: Forbidden artifact exists in workspace: BACKBONE_SNAPSHOT_FIX_COMPLETE.md"
  echo "This file must be removed immediately and added to .gitignore"
  exit 1
fi

# Check untracked files - these are OK as long as they're gitignored or expected
if [ -n "$UNTRACKED" ]; then
  echo "ℹ️  Untracked files detected (these are OK if gitignored):"
  echo "$UNTRACKED" | sed 's/^/  /'
fi

echo "✅ PASS: No tracked file modifications detected after build"
exit 0
