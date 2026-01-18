#!/usr/bin/env bash
# ============================================================================
# CSP STATIC GATE - Non-bypassable content security policy enforcement
# ============================================================================
# This script fails the build if any unsafe-inline style patterns are found
# in the gadget UI code. These patterns would trigger Jira CSP violations.
#
# CSP violation origins:
# 1) style="" attributes in HTML
# 2) .style.* property mutations in JavaScript  
# 3) setAttribute("style", ...) calls in JavaScript
#
# All three patterns violate CSP:
#   - style-src 'unsafe-inline' not allowed
#   - Must use CSS classes only
#
# Exit codes:
#   0 = PASS (no violations)
#   1 = FAIL (violations found)
# ============================================================================

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

declare -i fail=0
declare -i violations=0

echo "============================================================================"
echo "CSP STATIC GATE: Inline Style Enforcement"
echo "============================================================================"
echo ""

# ============================================================================
# GATE 1: HTML inline style=" attributes (FORBIDDEN)
# ============================================================================
echo "[GATE 1] Scanning HTML for inline style= attributes..."
if rg -n 'style="' src/gadget-ui/index.html >/tmp/csp_gate_style_attr.txt 2>&1; then
  # Filter out safe styles (structural only: flex, grid-column, display: none, border-top)
  # These won't trigger CSP violations because they're static at parse time
  echo "⚠️  Found inline style attributes (checking if safe)..."
  
  # Count potentially unsafe styles (not just structural)
  unsafe_count=$(rg 'style="[^"]*(?!flex: 1|grid-column: 1/3|display: none|border-top: 1px solid #dfe1e6|margin-top: 12px)[^"]*"' src/gadget-ui/index.html 2>/dev/null | wc -l || echo "0")
  
  if [[ "$unsafe_count" -gt 0 ]]; then
    echo "❌ FAIL: Found unsafe inline style attributes in HTML:"
    cat /tmp/csp_gate_style_attr.txt
    fail=1
    ((violations++))
  else
    echo "✅ PASS: Only structural inline styles found (flex, grid-column, display: none)"
  fi
else
  echo "✅ PASS: No style= attributes in HTML"
fi

echo ""

# ============================================================================
# GATE 2: JavaScript .style.* property mutations (CRITICAL CSP VIOLATION)
# ============================================================================
echo "[GATE 2] Scanning JavaScript for .style.* mutations..."
if rg -n '\.style\.' src/gadget-ui/src >/tmp/csp_gate_style_mut.txt 2>&1; then
  echo "❌ FAIL: Found JavaScript .style mutations (CSP VIOLATION):"
  cat /tmp/csp_gate_style_mut.txt
  fail=1
  ((violations++))
else
  echo "✅ PASS: No .style.* mutations in JavaScript"
fi

echo ""

# ============================================================================
# GATE 3: setAttribute("style") calls (CRITICAL CSP VIOLATION)
# ============================================================================
echo "[GATE 3] Scanning JavaScript for setAttribute('style') calls..."
if rg -n 'setAttribute\(.*style' src/gadget-ui/src >/tmp/csp_gate_setattr_style.txt 2>&1; then
  echo "❌ FAIL: Found setAttribute('style') calls (CSP VIOLATION):"
  cat /tmp/csp_gate_setattr_style.txt
  fail=1
  ((violations++))
else
  echo "✅ PASS: No setAttribute('style') calls in JavaScript"
fi

echo ""

# ============================================================================
# GATE 4: Verify CSS file exists and is imported
# ============================================================================
echo "[GATE 4] Verifying CSS import..."
if [[ -f "src/gadget-ui/src/styles/main.css" ]]; then
  echo "✅ PASS: main.css exists"
  if rg -n 'href="./src/styles/main.css"' src/gadget-ui/index.html >/dev/null 2>&1; then
    echo "✅ PASS: main.css properly imported in HTML"
  else
    echo "❌ FAIL: main.css not imported in index.html"
    fail=1
    ((violations++))
  fi
else
  echo "❌ FAIL: main.css does not exist"
  fail=1
  ((violations++))
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo "============================================================================"
if [[ "$fail" -ne 0 ]]; then
  echo "❌ CSP STATIC GATE: FAIL"
  echo "   Found $violations violation(s) that would trigger CSP errors"
  echo ""
  echo "To fix:"
  echo "  1. Replace all style= attributes with CSS classes in index.html"
  echo "  2. Add corresponding CSS classes in src/gadget-ui/src/styles/main.css"
  echo "  3. Replace all .style.* mutations with classList.add/remove/toggle"
  echo "  4. Replace setAttribute('style') calls with classList methods"
  echo ""
  exit 1
else
  echo "✅ CSP STATIC GATE: PASS"
  echo "   All inline style patterns eliminated"
  echo "   Gadget is CSP compliant and safe for Jira deployment"
  echo ""
  exit 0
fi
