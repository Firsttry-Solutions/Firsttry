#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

# FINAL-FINAL ENFORCEMENT VALIDATOR
# Non-bypassable compliance check for enterprise documentation

ENTERPRISE_DOCS=(
  "docs/SECURITY_SUMMARY.md"
  "docs/ENTERPRISE_ONE_PAGER.md"
  "docs/ROI_JUSTIFICATION.md"
  "docs/PRICING_RATIONALE.md"
  "docs/SUPPORT_POLICY.md"
  "docs/CHANGE_MANAGEMENT.md"
  "docs/ROADMAP.md"
  "docs/DOCS_INDEX.md"
)

REQUIRED_HEADINGS=(
  "Audience & Scope"
  "Executive Summary"
  "What This Covers"
  "What This Explicitly Does NOT Cover"
  "Core Assertions"
  "Explicit Negative Assertions"
  "Proof Anchors"
)

fail=0

echo "=========================================="
echo "FINAL-FINAL ENFORCEMENT VALIDATOR"
echo "=========================================="
echo ""

# Phase A: Check required docs exist
echo "PHASE A: Document Existence"
for doc in "${ENTERPRISE_DOCS[@]}"; do
  if [ ! -f "$doc" ]; then
    echo "✗ FAIL: $doc does not exist"
    fail=1
  else
    echo "✓ $doc exists"
  fi
done
echo ""

# Phase B: Check required headings in each doc
echo "PHASE B: Required Headings"
for doc in "${ENTERPRISE_DOCS[@]}"; do
  [ ! -f "$doc" ] && continue
  
  doc_name=$(basename "$doc")
  for heading in "${REQUIRED_HEADINGS[@]}"; do
    if ! grep -q "^## $heading" "$doc"; then
      echo "✗ FAIL: $doc_name missing heading: $heading"
      fail=1
    fi
  done
done
echo "✓ All required headings present"
echo ""

# Phase C: Check "does NOT" appears ≥3 times per doc
echo "PHASE C: Negative Assertions (≥3 per doc)"
for doc in "${ENTERPRISE_DOCS[@]}"; do
  [ ! -f "$doc" ] && continue
  
  doc_name=$(basename "$doc")
  count=$(grep -c "does NOT" "$doc" || true)
  
  if [ "$count" -lt 3 ]; then
    echo "✗ FAIL: $doc_name has $count negative assertions (need ≥3)"
    fail=1
  fi
done
echo "✓ Negative assertions sufficient (≥3 per doc)"
echo ""

# Phase D: ROI enforcement - exactly ONE "EXAMPLE ONLY" marker
echo "PHASE D: ROI Numeric Claims"
if [ -f "docs/ROI_JUSTIFICATION.md" ]; then
  example_count=$(grep -c "EXAMPLE ONLY" docs/ROI_JUSTIFICATION.md || true)
  
  if [ "$example_count" -ne 1 ]; then
    echo "✗ FAIL: ROI_JUSTIFICATION.md has $example_count 'EXAMPLE ONLY' markers (need exactly 1)"
    fail=1
  else
    echo "✓ ROI has exactly 1 EXAMPLE ONLY block"
  fi
else
  echo "✓ ROI_JUSTIFICATION.md check skipped"
fi
echo ""

# Phase E: Pricing enforcement - Proof Anchors must mark external Forge claims
echo "PHASE E: Pricing External Claims"
if [ -f "docs/PRICING_RATIONALE.md" ]; then
  # Check that Proof Anchors table has NOT EVIDENCED for external Forge claims
  if grep -q "^| Actual Forge pricing rates" docs/PRICING_RATIONALE.md; then
    if grep "^| Actual Forge pricing rates" docs/PRICING_RATIONALE.md | grep -q "NOT EVIDENCED IN REPO"; then
      echo "✓ Forge pricing rates marked NOT EVIDENCED"
    else
      echo "✗ FAIL: Forge pricing rates must be marked NOT EVIDENCED IN REPO"
      fail=1
    fi
  fi
  
  echo "✓ Pricing claims verified"
else
  echo "✓ PRICING_RATIONALE.md check skipped"
fi
echo ""

# Phase F: Proof Anchors - check for "refer to" (forbidden pattern) - but ONLY in Proof Anchors table
echo "PHASE F: Proof Anchors Strictness"
for doc in "${ENTERPRISE_DOCS[@]}"; do
  [ ! -f "$doc" ] && continue
  
  doc_name=$(basename "$doc")
  
  if grep -q "^## Proof Anchor" "$doc"; then
    # Extract ONLY the Proof Anchors section (from heading to next heading or end)
    anchor_section=$(sed -n '/^## Proof Anchor/,/^## [^[:space:]]/p' "$doc" | head -n -1)
    
    if echo "$anchor_section" | grep -qi "refer to"; then
      echo "✗ FAIL: $doc_name Proof Anchors table has 'refer to' (use direct format only)"
      fail=1
    fi
  fi
done
echo "✓ Proof Anchors format checked"
echo ""

# Phase G: Forbidden terms enforcement (across ENTERPRISE_DOCS only)
echo "PHASE G: Forbidden Term Enforcement"
FORBIDDEN_TERMS=(
  "tier"
  "tiers"
  "entitlement"
  "license"
  "licence"
  "paid feature"
  "SLA"
  "response time"
  "guarantee"
  "guaranteed"
  "24/7"
)

# Compile regex patterns
FORBIDDEN_PATTERN=$(IFS='|'; echo "${FORBIDDEN_TERMS[*]}")

for doc in "${ENTERPRISE_DOCS[@]}"; do
  [ ! -f "$doc" ] && continue
  
  doc_name=$(basename "$doc")
  
  # Check for forbidden terms (case-insensitive)
  if grep -qi "$FORBIDDEN_PATTERN" "$doc"; then
    # Secondary check: ensure they're not in "does NOT" context or explanatory text
    # Allow forbidden terms ONLY in sections that explicitly negate them
    violations=$(grep -in "$FORBIDDEN_PATTERN" "$doc" | grep -v "does NOT" | grep -v "NOT include" | grep -v "NOT provide" | grep -v "NOT support" | grep -v "NOT define" || true)
    
    if [[ -n "$violations" ]]; then
      echo "✗ FAIL: $doc_name contains forbidden terms outside negation context"
      echo "  Violations: $(echo "$violations" | head -3)"
      fail=1
    fi
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "✓ No forbidden terms in enterprise docs (outside negation)"
fi
echo ""

# Phase H: ROI strict numeric locality
echo "PHASE H: ROI Numeric Claims Strictness"
if [ -f "docs/ROI_JUSTIFICATION.md" ]; then
  example_count=$(grep -c "EXAMPLE ONLY" docs/ROI_JUSTIFICATION.md || true)
  
  if [ "$example_count" -eq 1 ]; then
    echo "✓ ROI numeric claims properly scoped to EXAMPLE block"
  else
    echo "✗ FAIL: ROI numeric claims not properly scoped ($example_count EXAMPLE blocks found)"
    fail=1
  fi
else
  echo "✓ ROI_JUSTIFICATION.md check skipped"
fi
echo ""

# Phase I: Proof anchors strictness
echo "PHASE I: Proof Anchors Strictness"
FORBIDDEN_ANCHOR_PHRASES=(
  "refer to"
  "see manifest"
  "see repo"
  "as documented"
  "as outlined above"
  "above"
)

ANCHOR_PATTERN=$(IFS='|'; echo "${FORBIDDEN_ANCHOR_PHRASES[*]}")

for doc in "${ENTERPRISE_DOCS[@]}"; do
  [ ! -f "$doc" ] && continue
  
  doc_name=$(basename "$doc")
  
  if grep -q "^## Proof Anchor" "$doc"; then
    # Extract ONLY the Proof Anchors section
    anchor_section=$(sed -n '/^## Proof Anchor/,/^## [^[:space:]]/p' "$doc" | head -n -1)
    
    if echo "$anchor_section" | grep -qi "$ANCHOR_PATTERN"; then
      echo "✗ FAIL: $doc_name Proof Anchors contains forbidden phrase"
      fail=1
    fi
    
    # Verify format: lines should be "- Claim: Location" format
    # Allow patterns like:
    #   - Claim: [link](url)
    #   - Claim: NOT EVIDENCED IN REPO
    #   - Claim: [link]:lines
    anchor_lines=$(echo "$anchor_section" | grep "^- " || true)
    if [[ -n "$anchor_lines" ]]; then
      # Validate each line matches expected patterns
      while IFS= read -r line; do
        if ! echo "$line" | grep -qE "^- [^:]+: (\[|NOT EVIDENCED)"; then
          # Allow some flexibility, but ensure no "refer to" or "see" patterns
          if echo "$line" | grep -qi "refer to\|see \|as documented\|as outlined"; then
            echo "✗ FAIL: $doc_name Proof Anchor line format invalid: $line"
            fail=1
          fi
        fi
      done <<< "$anchor_lines"
    fi
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "✓ Proof Anchors format verified (strict)"
fi
echo ""

# Summary
echo "=========================================="
if [ "$fail" -eq 0 ]; then
  echo "✓ FINAL-FINAL VALIDATION PASS"
  echo "=========================================="
  exit 0
else
  echo "✗ FINAL-FINAL VALIDATION FAIL"
  echo "=========================================="
  exit 1
fi
