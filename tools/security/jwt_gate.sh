#!/usr/bin/env bash
# jwt_gate.sh - Local simulation of CI JWT pattern gate
# Usage: bash tools/security/jwt_gate.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "============================================================"
echo "  JWT Pattern Gate (Local Simulation)"
echo "============================================================"
echo ""
echo "Repo: $REPO_ROOT"
echo ""

cd "$REPO_ROOT"

FAIL=0

# Pattern 1: Exact JWT header
echo "[1/4] Scanning for JWT header pattern..."
if rg -n "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" . \
  --glob '!tools/security/**' \
  --glob '!**/tests/security/**' \
  --glob '!.github/workflows/jwt-pattern-gate.yml' \
  2>/dev/null; then
  echo "  ❌ FAIL: JWT header pattern found"
  FAIL=1
else
  echo "  ✅ PASS"
fi

# Pattern 2: Bearer JWT
echo "[2/4] Scanning for Bearer JWT patterns..."
if rg -n "\bBearer\s+[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}" . \
  --glob '!tools/security/**' \
  --glob '!**/tests/security/**' \
  --glob '!.github/workflows/jwt-pattern-gate.yml' \
  2>/dev/null; then
  echo "  ❌ FAIL: Bearer JWT pattern found"
  FAIL=1
else
  echo "  ✅ PASS"
fi

# Pattern 3: Standalone JWT-like tokens (informational)
echo "[3/4] Scanning for standalone JWT-like patterns..."
MATCHES=$(rg -c "\b[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}\b" . 2>/dev/null | wc -l || echo 0)
if [[ "$MATCHES" -gt 0 ]]; then
  echo "  ⚠️  WARNING: Found $MATCHES potential JWT-like patterns (manual review recommended)"
else
  echo "  ✅ No JWT-like patterns found"
fi

# Pattern 4: Verify sanitizer exists and works
echo "[4/4] Verifying JWT sanitizer..."
SANITIZER="$REPO_ROOT/tools/security/sanitize_text.mjs"
if [[ ! -f "$SANITIZER" ]]; then
  echo "  ❌ FAIL: Sanitizer not found at $SANITIZER"
  FAIL=1
elif [[ ! -x "$SANITIZER" ]]; then
  echo "  ❌ FAIL: Sanitizer not executable"
  FAIL=1
else
  # Test sanitizer
  TEST_OUTPUT=$(echo "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.data" | node "$SANITIZER" 2>/dev/null || true)
  if echo "$TEST_OUTPUT" | grep -q "REDACTED"; then
    echo "  ✅ PASS: Sanitizer functional"
  else
    echo "  ❌ FAIL: Sanitizer not working correctly"
    FAIL=1
  fi
fi

echo ""
echo "============================================================"
if [[ $FAIL -eq 0 ]]; then
  echo "  ✅ JWT GATE: PASSED"
  echo "============================================================"
  exit 0
else
  echo "  ❌ JWT GATE: FAILED"
  echo "============================================================"
  exit 1
fi
