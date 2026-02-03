#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "[POSTBUILD] Verifying repo cleanliness (staged + unstaged ONLY, properly-ignored untracked files OK)..."

# HARD BAN (existing policy requirement retained)
if [ -e "BACKBONE_SNAPSHOT_FIX_COMPLETE.md" ]; then
  echo "[POSTBUILD] ❌ FAIL: Forbidden artifact detected: BACKBONE_SNAPSHOT_FIX_COMPLETE.md"
  exit 1
fi

# Use -uno to exclude properly-ignored untracked files (e.g., test artifacts)
# This checks for:
#   - Unstaged changes (M, D)
#   - Staged changes (M, A, D, R)
# But NOT:
#   - Untracked files that are in .gitignore (properly ignored test artifacts won't break determinism)
PORCELAIN="$(git status --porcelain=v1 -uno)"
if [ -n "$PORCELAIN" ]; then
  echo "[POSTBUILD] ❌ FAIL: Working tree has uncommitted/staged changes after build."
  echo "[POSTBUILD] git status --porcelain=v1 -uno (tracked/staged only):"
  echo "$PORCELAIN"
  echo "[POSTBUILD] Hint: staging changes must NOT be used to bypass this gate."
  exit 1
fi

# Redundant hard checks (defense-in-depth)
git diff --exit-code -- . >/dev/null
git diff --cached --exit-code -- . >/dev/null

echo "[POSTBUILD] ✅ PASS: Repo clean after build (no uncommitted/staged changes, properly-ignored artifacts OK)."
