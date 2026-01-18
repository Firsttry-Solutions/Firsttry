#!/usr/bin/env bash
# tools/csp_audit.sh — CSP violation detection for gadget UI

set -e

CSP_AUDIT_DIR="audit/csp_fix"
GADGET_SRC="src/gadget-ui/src"

echo "=========================================================================="
echo "CSP AUDIT: Inline Styles + Runtime Style Injection Detection"
echo "=========================================================================="
echo ""

# 1. Inline style string attributes
echo "[1] Scanning for inline style=\"...\" attributes"
echo ""
rg -n --hidden --glob '!*node_modules/*' --glob '!dist/*' \
  'style\s*=\s*["\x27]' "${GADGET_SRC}" 2>/dev/null | tee "${CSP_AUDIT_DIR}/10_inline_style_string_hits.txt" || echo "✅ None found"

echo ""
echo "[2] Scanning for inline style={{...}} in JSX"
echo ""
rg -n --hidden --glob '!*node_modules/*' --glob '!dist/*' \
  'style\s*=\s*\{\{' "${GADGET_SRC}" 2>/dev/null | tee "${CSP_AUDIT_DIR}/10_inline_style_object_hits.txt" || echo "✅ None found"

echo ""
echo "[3] Scanning for .style.* DOM mutations"
echo ""
rg -n --hidden --glob '!*node_modules/*' --glob '!dist/*' \
  '\.style\.' "${GADGET_SRC}" 2>/dev/null | tee "${CSP_AUDIT_DIR}/11_dom_style_mutations.txt" || echo "✅ None found"

echo ""
echo "[4] Scanning for setAttribute style calls"
echo ""
rg -n --hidden --glob '!*node_modules/*' --glob '!dist/*' \
  'setAttribute.*style' "${GADGET_SRC}" 2>/dev/null | tee "${CSP_AUDIT_DIR}/11_setAttribute_style.txt" || echo "✅ None found"

echo ""
echo "[5] Scanning for createElement(\"style\") and insertRule"
echo ""
rg -n --hidden --glob '!*node_modules/*' --glob '!dist/*' \
  'createElement.*style|insertRule|innerHTML' "${GADGET_SRC}" 2>/dev/null | tee "${CSP_AUDIT_DIR}/12_style_injection.txt" || echo "✅ None found"

echo ""
echo "[6] Checking CSS-in-JS libraries in package.json"
echo ""
if grep -q 'emotion\|styled-components\|@mui\|chakra\|antd' src/gadget-ui/package.json 2>/dev/null; then
  echo "⚠️  CSS-in-JS detected:" && grep 'emotion\|styled-components\|@mui\|chakra\|antd' src/gadget-ui/package.json | tee "${CSP_AUDIT_DIR}/13_css_in_js_deps.txt"
else
  echo "✅ No CSS-in-JS libraries" | tee "${CSP_AUDIT_DIR}/13_css_in_js_deps.txt"
fi

echo ""
echo "[7] Checking for external CSS links in HTML"
echo ""
rg -n --hidden --glob '!*node_modules/*' --glob '!dist/*' \
  '<link.*stylesheet' "${GADGET_SRC}" 2>/dev/null | tee "${CSP_AUDIT_DIR}/14_css_link_tags.txt" || echo "✅ None found (CSS via build tool)"

echo ""
echo "[8] Checking dist/index.html for injected <style> tags"
echo ""
if [ -f "src/gadget-ui/dist/index.html" ]; then
  if grep -q '<style' src/gadget-ui/dist/index.html; then
    echo "⚠️  Found <style> tags in dist (CSS-in-JS injection):" && grep '<style' src/gadget-ui/dist/index.html | head -5 | tee "${CSP_AUDIT_DIR}/15_dist_style_tags.txt"
  else
    echo "✅ No injected <style> tags in dist/index.html" | tee "${CSP_AUDIT_DIR}/15_dist_style_tags.txt"
  fi
else
  echo "⚠️  dist/index.html not found (run build first)" | tee "${CSP_AUDIT_DIR}/15_dist_style_tags.txt"
fi

echo ""
echo "=========================================================================="
echo "✅ Audit complete. Results saved to: ${CSP_AUDIT_DIR}/"
echo "=========================================================================="
