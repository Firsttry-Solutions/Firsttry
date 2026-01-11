#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

# Enterprise Documentation Validator (Hardened)
FILES=(
  docs/SECURITY_SUMMARY.md
  docs/ENTERPRISE_ONE_PAGER.md
  docs/ROI_JUSTIFICATION.md
  docs/PRICING_RATIONALE.md
  docs/SUPPORT_POLICY.md
  docs/CHANGE_MANAGEMENT.md
  docs/ROADMAP.md
  docs/DOCS_INDEX.md
)

SECTIONS=(
  "Audience & Scope"
  "Executive Summary"
  "What This Covers"
  "What This Explicitly Does NOT Cover"
  "Core Assertions"
  "Explicit Negative Assertions"
  "Proof Anchors"
)

fail=0

echo "=================================================="
echo "HARDENED ENTERPRISE DOCUMENTATION VALIDATOR"
echo "=================================================="
echo ""

for f in "${FILES[@]}"; do
  file_fail=0
  echo "Checking: $f"
  
  [ -f "$f" ] || { echo "  ❌ MISSING_FILE"; fail=1; continue; }

  for s in "${SECTIONS[@]}"; do
    grep -q "$s" "$f" || { echo "  ❌ MISSING_SECTION [$s]"; file_fail=1; }
  done

  neg=$(grep -cE "(This|FirstTry|This product) does NOT|^- \*\*.*does NOT" "$f" || true)
  [ "$neg" -lt 3 ] && { echo "  ❌ INSUFFICIENT_NEGATIVE_ASSERTIONS ($neg<3)"; file_fail=1; }

  grep -q "Proof Anchor" "$f" || { echo "  ❌ MISSING_PROOF_ANCHORS"; file_fail=1; }

  if [[ "$f" == *"ROI_JUSTIFICATION.md" ]]; then
    examples=$(grep -c "EXAMPLE ONLY" "$f" || true)
    [ "$examples" -gt 1 ] && { echo "  ❌ ROI_MULTIPLE_EXAMPLES ($examples>1)"; file_fail=1; }
  fi

  [ "$file_fail" -eq 1 ] && fail=1 || echo "  ✅ PASS"
  echo ""
done

echo "=================================================="
if [ "$fail" -eq 0 ]; then
  echo "✅ HARDENED_VALIDATION_OK"
  exit 0
else
  echo "❌ HARDENED_VALIDATION_FAILED"
  exit 1
fi
