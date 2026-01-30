#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "[POSTBUILD] Verifying repo cleanliness (unstaged + staged + untracked)..."

# HARD BAN (existing policy requirement retained)
if [ -e "BACKBONE_SNAPSHOT_FIX_COMPLETE.md" ]; then
  echo "[POSTBUILD] ❌ FAIL: Forbidden artifact detected: BACKBONE_SNAPSHOT_FIX_COMPLETE.md"
  exit 1
fi

PORCELAIN="$(git status --porcelain=v1)"
if [ -n "$PORCELAIN" ]; then
  echo "[POSTBUILD] ❌ FAIL: Working tree is not clean after build."
  echo "[POSTBUILD] git status --porcelain=v1:"
  echo "$PORCELAIN"
  echo "[POSTBUILD] Hint: staging changes must NOT be used to bypass this gate."
  exit 1
fi

# Redundant hard checks (defense-in-depth)
git diff --exit-code -- . >/dev/null
git diff --cached --exit-code -- . >/dev/null

echo "[POSTBUILD] ✅ PASS: Repo clean after build (no unstaged, no staged, no untracked)."
