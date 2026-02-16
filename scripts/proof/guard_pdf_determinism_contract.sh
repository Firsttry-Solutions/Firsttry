#!/bin/bash
set -euo pipefail

# PDF Determinism Contract Guard
# Verifies that documentation completeness criteria are met

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ ! -f "$REPO_ROOT/docs/security-whitepaper.md" ]]; then
  echo "[FAIL] docs/security-whitepaper.md missing"
  exit 1
fi

if [[ ! -f "$REPO_ROOT/docs/reproducible-build.md" ]]; then
  echo "[FAIL] docs/reproducible-build.md missing"
  exit 1
fi

# Check for required sentences in whitepaper
if ! grep -q "Deterministic guarantees assume consistent runtime and build environment as defined in reproducible build documentation." "$REPO_ROOT/docs/security-whitepaper.md"; then
  echo "[FAIL] Determinism limitation sentence missing from security whitepaper"
  exit 1
fi

if ! grep -q "Timestamps are excluded from deterministic hash inputs where required; exported timestamps remain visible for audit trails." "$REPO_ROOT/docs/security-whitepaper.md"; then
  echo "[FAIL] Time model sentence missing from security whitepaper"
  exit 1
fi

if ! grep -q "This scoring model is heuristic and intended for governance prioritization, not actuarial or financial risk quantification." "$REPO_ROOT/docs/security-whitepaper.md"; then
  echo "[FAIL] Heuristic scoring sentence missing from security whitepaper"
  exit 1
fi

echo "[PASS] PDF determinism contract verified"
echo "[FT_PDF_DETERMINISM_DOC_GUARD_PASS]"
