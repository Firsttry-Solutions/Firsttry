#!/usr/bin/env bash
# ============================================================================
# CSP STATIC GATE - Strict Zero-Inline-Styles Enforcement
# ============================================================================
# This script enforces ZERO inline style="" attributes anywhere in the gadget UI.
# No allowlists. No exceptions. No "safe structural styles."
#
# CSP violation sources:
# 1) style="" attributes in HTML source
# 2) style="" attributes in compiled dist
# 3) .style.* property mutations in JavaScript
# 4) setAttribute("style", ...) calls in JavaScript
#
# Jira CSP Policy: style-src 'self' (no unsafe-inline)
#
# Exit codes:
#   0 = PASS (zero inline styles found)
#   1 = FAIL (violations detected)
# ============================================================================

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

declare -i fail=0

echo "============================================================================"
echo "CSP STATIC GATE: Strict Zero-Inline-Styles Enforcement"
echo "============================================================================"
echo ""

# ============================================================================
# GATE 1: Check SOURCE for ANY substring 'style="' (TRULY STRICT - NO EXCEPTIONS)
# CSS files excluded: CSS cannot contain inline style attributes; comments are not violations
# ============================================================================
echo "[GATE 1] Scanning SOURCE for any 'style=\"' substring (excluding .css files)..."
out="/tmp/csp_gate_1_source.txt"
if rg -n --type-add 'noncss:*.{ts,tsx,js,jsx,html,svg}' --type noncss 'style="' "src/gadget-ui" >"$out" 2>&1; then
  echo "❌ FAIL: Found 'style=\"' substring in src/gadget-ui (including comments)"
  cat "$out"
  fail=1
else
  echo "✅ PASS: No 'style=\"' substring anywhere in src/gadget-ui"
fi
echo ""

# ============================================================================
# GATE 2: Check DIST for ANY substring 'style="' (TRULY STRICT - NO EXCEPTIONS)
# ============================================================================
echo "[GATE 2] Scanning DIST for any 'style=\"' substring..."
if [[ -d "src/gadget-ui/dist" ]]; then
  out="/tmp/csp_gate_2_dist.txt"
  if rg -n 'style="' "src/gadget-ui/dist" >"$out" 2>&1; then
    echo "❌ FAIL: Found 'style=\"' substring in src/gadget-ui/dist"
    cat "$out"
    fail=1
  else
    echo "✅ PASS: No 'style=\"' substring in src/gadget-ui/dist"
  fi
else
  echo "⚠️  SKIP: src/gadget-ui/dist does not exist (not built yet)"
fi
echo ""

# ============================================================================
# GATE 3: JavaScript .style.* property mutations
# CSS files excluded: CSS cannot perform JS mutations; .style.* in CSS is valid CSS
# ============================================================================
echo "[GATE 3] Scanning JavaScript for .style.* mutations (excluding .css files)..."
out="/tmp/csp_gate_3_js_style.txt"
if rg -n --type ts --type js '\.style\.' "src/gadget-ui/src" >"$out" 2>&1; then
  echo "❌ FAIL: Found .style.* mutations in JavaScript"
  cat "$out"
  fail=1
else
  echo "✅ PASS: No .style.* mutations in JavaScript"
fi
echo ""

# ============================================================================
# GATE 4: JavaScript setAttribute('style') calls
# ============================================================================
echo "[GATE 4] Scanning JavaScript for setAttribute('style') calls..."
out="/tmp/csp_gate_4_js_setattr.txt"
if rg -n 'setAttribute\([^)]*style' "src/gadget-ui/src" >"$out" 2>&1; then
  echo "❌ FAIL: Found setAttribute('style') calls in JavaScript"
  cat "$out"
  fail=1
else
  echo "✅ PASS: No setAttribute('style') calls in JavaScript"
fi
echo ""

# ============================================================================
# GATE 5: Inline Event Handlers in HTML SOURCE (PHASE 2)
# ============================================================================
echo "[GATE 5] Scanning SOURCE HTML for inline event handlers (on*=)..."
out="/tmp/csp_gate_5_html_handlers.txt"
if rg -n 'on[a-zA-Z]+\s*=' "src/gadget-ui/index.html" >"$out" 2>&1; then
  # Filter out false positives (e.g., viewport="viewport")
  if rg -n 'on[a-zA-Z]+\s*=' "src/gadget-ui/index.html" 2>/dev/null | grep -v 'viewport' >"$out" 2>&1; then
    echo "❌ FAIL: Found inline event handlers in src/gadget-ui/index.html"
    cat "$out"
    fail=1
  else
    echo "✅ PASS: No inline event handlers in src/gadget-ui/index.html"
  fi
else
  echo "✅ PASS: No inline event handlers in src/gadget-ui/index.html"
fi
echo ""

# ============================================================================
# GATE 6: Inline Event Handlers in DIST HTML (PHASE 2)
# ============================================================================
echo "[GATE 6] Scanning DIST HTML for inline event handlers (on*=)..."
if [[ -d "src/gadget-ui/dist" ]]; then
  out="/tmp/csp_gate_6_dist_handlers.txt"
  if rg -n 'on[a-zA-Z]+\s*=' "src/gadget-ui/dist/index.html" >"$out" 2>&1; then
    # Filter out false positives
    if rg -n 'on[a-zA-Z]+\s*=' "src/gadget-ui/dist/index.html" 2>/dev/null | grep -v 'viewport' >"$out" 2>&1; then
      echo "❌ FAIL: Found inline event handlers in src/gadget-ui/dist/index.html"
      cat "$out"
      fail=1
    else
      echo "✅ PASS: No inline event handlers in src/gadget-ui/dist/index.html"
    fi
  else
    echo "✅ PASS: No inline event handlers in src/gadget-ui/dist/index.html"
  fi
else
  echo "⚠️  SKIP: src/gadget-ui/dist does not exist (not built yet)"
fi
echo ""

# ============================================================================
# SUMMARY & EXIT
# ============================================================================
echo "============================================================================"
if [[ "$fail" -ne 0 ]]; then
  echo "❌ CSP STATIC GATE: FAIL"
  echo ""
  echo "Violations found. To fix:"
  echo "  1. Remove all style=\"...\" attributes from src/gadget-ui/index.html"
  echo "  2. Replace with CSS classes in src/gadget-ui/src/styles/main.css"
  echo "  3. Remove all .style.* property mutations from src/gadget-ui/src/main.ts"
  echo "  4. Remove all setAttribute('style', ...) calls from src/gadget-ui/src/main.ts"
  echo "  5. Remove all on[a-zA-Z]+= event handlers from src/gadget-ui/index.html"
  echo "  6. Wire event handlers via addEventListener in src/gadget-ui/src/main.ts"
  echo ""
  exit 1
else
  echo "✅ CSP STATIC GATE: PASS"
  echo ""
  echo "All CSP inline style and event handler checks passed:"
  echo "  ✅ Zero inline styles in source"
  echo "  ✅ Zero inline styles in dist (if built)"
  echo "  ✅ Zero .style.* mutations in JavaScript"
  echo "  ✅ Zero setAttribute('style') calls in JavaScript"
  echo "  ✅ Zero inline event handlers in source HTML"
  echo "  ✅ Zero inline event handlers in dist HTML"
  echo ""
  echo "Gadget is CSP-safe and ready for Jira deployment."
  echo "============================================================================"
  exit 0
fi
