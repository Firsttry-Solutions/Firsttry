#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

PATTERNS=(
  'sk_[A-Za-z0-9]{10,}'
)

cd "$REPO_ROOT"

echo "[INFO] guard_no_secrets_in_repo: scanning tracked files only"

TRACKED_FILES=$(git ls-files 2>/dev/null || true)

FOUND=0
for p in "${PATTERNS[@]}"; do
  if echo "$TRACKED_FILES" | xargs -r grep -nE "$p" 2>/dev/null || true; then
    if echo "$TRACKED_FILES" | xargs -r grep -nE "$p" 2>/dev/null | grep -q .; then
      echo "[FAIL] Secret-like pattern detected: $p"
      FOUND=1
    fi
  fi
done

if [[ "$FOUND" -ne 0 ]]; then
  echo "[FAIL] guard_no_secrets_in_repo FAILED"
  exit 1
fi

echo "[PASS] guard_no_secrets_in_repo PASSED"
