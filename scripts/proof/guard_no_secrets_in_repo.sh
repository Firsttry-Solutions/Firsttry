#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Add patterns as needed. Keep conservative to avoid false positives.
PATTERNS=(
  'sk_[A-Za-z0-9]{10,}'
)

cd "$REPO_ROOT"

echo "[INFO] guard_no_secrets_in_repo: scanning TRACKED files only"
TRACKED_FILES="$(git ls-files)"

FOUND=0
for p in "${PATTERNS[@]}"; do
  # xargs may return non-zero if no files; suppress but fail on actual matches
  MATCHES="$(echo "$TRACKED_FILES" | xargs -r grep -nE "$p" 2>/dev/null || true)"
  if [[ -n "$MATCHES" ]]; then
    echo "[FAIL] Secret-like pattern detected: $p"
    # Redact obvious token bodies in output
    echo "$MATCHES" | sed -E 's/(sk_[A-Za-z0-9]{10,})/[REDACTED_SK_TOKEN]/g' | head -50
    FOUND=1
  fi
done

if [[ "$FOUND" -ne 0 ]]; then
  echo "[FAIL] guard_no_secrets_in_repo FAILED"
  exit 1
fi

echo "[PASS] guard_no_secrets_in_repo PASSED"
