#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

# Document Validator
# Validates that all enterprise documentation meets mandatory schema requirements

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
echo "ENTERPRISE DOCUMENTATION VALIDATOR"
echo "=================================================="
echo ""

for f in "${FILES[@]}"; do
  echo "Checking: $f"
  
  [ -f "$f" ] || { echo "  ❌ MISSING_FILE"; fail=1; continue; }

  # Check mandatory sections
  for s in "${SECTIONS[@]}"; do
    if ! grep -q "$s" "$f"; then
      echo "  ❌ MISSING_SECTION [$s]"
      fail=1
    fi
  done

  # Check negative assertions (≥3) - supports multiple formats
  neg=$(grep -cE "(This|FirstTry|This product|This system|This document|This policy|This roadmap|This model) does NOT|^- \*\*.*does NOT" "$f" || true)
  if [ "$neg" -lt 3 ]; then
    echo "  ❌ INSUFFICIENT_NEGATIVE_ASSERTIONS (found $neg, need ≥3)"
    fail=1
  fi

  # Forbidden: pricing/tier logic in docs
  if grep -q "license\|tier\|entitlement\|paid feature" "$f" 2>/dev/null | grep -v "feature-tier\|entitlement-based\|entitlement logic"; then
    echo "  ⚠ WARNING: Contains pricing/licensing terminology (check for forbidden logic)"
  fi

  # Check proof anchors section exists
  if ! grep -q "Proof Anchor" "$f"; then
    echo "  ❌ MISSING_PROOF_ANCHORS_SECTION"
    fail=1
  fi

  if [ $fail -eq 0 ]; then
    echo "  ✅ PASS"
  fi
  echo ""
done

echo "=================================================="
if [ "$fail" -eq 0 ]; then
  echo "✅ DOCS_VALIDATION_OK"
  exit 0
else
  echo "❌ DOCS_VALIDATION_FAILED"
  exit 1
fi
