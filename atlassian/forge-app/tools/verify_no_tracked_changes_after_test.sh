#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "[POSTTEST] Verifying repo cleanliness (unstaged + staged + untracked)..."

PORCELAIN="$(git status --porcelain=v1)"
if [ -n "$PORCELAIN" ]; then
  echo "[POSTTEST] ❌ FAIL: Working tree is not clean after tests."
  echo "[POSTTEST] git status --porcelain=v1:"
  echo "$PORCELAIN"
  echo "[POSTTEST] Hint: staging changes must NOT be used to bypass this gate."
  exit 1
fi

# Redundant hard checks (defense-in-depth)
git diff --exit-code -- . >/dev/null
git diff --cached --exit-code -- . >/dev/null

echo "[POSTTEST] ✅ PASS: Repo clean after tests (no unstaged, no staged, no untracked)."
