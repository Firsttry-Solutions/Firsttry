#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

CANON_PRODUCT="FirstTry - Audit Evidence Snapshot for Jira"
CANON_VENDOR="Firsttry solutions"
CANON_EMAIL="contact@firsttry.run"

# Old branding variants that must never appear in Pages-served docs
FORBIDDEN=(
  "FirstTry Governance – Documentation"
  "FirstTry Governance"
  "Firsttry Governance"
  "Firsttry Governance for Jira"
  "Jira Governance"
)

DOCS_ROOT="docs"

echo "=== PAGES BRANDING GATE ==="
echo "DOCS_ROOT=$DOCS_ROOT"
echo "CANON_PRODUCT=$CANON_PRODUCT"
echo

# Build tracked file list (ONLY what ships in docs/)
mapfile -t FILES < <(git ls-files -- 'docs/*.md' 'docs/*.html' 'docs/*.yml' 'docs/*.yaml' 2>/dev/null)
if [ "${#FILES[@]}" -eq 0 ]; then
  echo "❌ FAIL: no tracked docs files found under $DOCS_ROOT"
  exit 2
fi
echo "Tracked docs files: ${#FILES[@]}"

fail=0

echo
echo "--- Check 1: Forbidden old branding variants ---"
for pat in "${FORBIDDEN[@]}"; do
  if rg -n -F "$pat" -- "${FILES[@]}" >/tmp/pages_brand_forbidden_hits.txt 2>/dev/null; then
    echo "❌ FAIL: forbidden string found: $pat"
    head -50 /tmp/pages_brand_forbidden_hits.txt || true
    fail=1
  else
    echo "✅ OK: not found: $pat"
  fi
done

echo
echo "--- Check 2: Canonical product present where it matters ---"
# Require canonical in at least one index entrypoint, and strongly in title/H1 if HTML.
idx_ok=0

if [ -f "$DOCS_ROOT/index.html" ]; then
  if rg -q -F "$CANON_PRODUCT" "$DOCS_ROOT/index.html"; then
    idx_ok=1
  else
    echo "❌ FAIL: canonical product missing in docs/index.html"
    fail=1
  fi

  # Stronger: require canonical in <title> and <h1> if present.
  if rg -q "<title>[^<]*$(printf '%s' "$CANON_PRODUCT" | sed 's/[]\/$*.^|[]/\\&/g')[^<]*</title>" "$DOCS_ROOT/index.html"; then
    echo "✅ OK: canonical appears in <title>"
  else
    echo "❌ FAIL: canonical not found inside <title> in docs/index.html"
    fail=1
  fi

  if rg -q "<h1[^>]*>[^<]*$(printf '%s' "$CANON_PRODUCT" | sed 's/[]\/$*.^|[]/\\&/g')[^<]*</h1>" "$DOCS_ROOT/index.html"; then
    echo "✅ OK: canonical appears in <h1>"
  else
    echo "❌ FAIL: canonical not found inside <h1> in docs/index.html"
    fail=1
  fi
fi

if [ -f "$DOCS_ROOT/index.md" ]; then
  if rg -q -F "$CANON_PRODUCT" "$DOCS_ROOT/index.md"; then
    idx_ok=1
  else
    echo "❌ FAIL: canonical product missing in docs/index.md"
    fail=1
  fi
fi

if [ "$idx_ok" -ne 1 ]; then
  echo "❌ FAIL: canonical product not confirmed in docs/index.(html|md)"
  fail=1
fi

echo
echo "--- Check 3: Vendor facts present ---"
if rg -q -F "$CANON_VENDOR" -- "${FILES[@]}"; then
  echo "✅ OK: vendor name found somewhere in docs"
else
  echo "❌ FAIL: vendor name not found in docs: $CANON_VENDOR"
  fail=1
fi

if rg -q -F "$CANON_EMAIL" -- "${FILES[@]}"; then
  echo "✅ OK: contact email found somewhere in docs"
else
  echo "❌ FAIL: contact email not found in docs: $CANON_EMAIL"
  fail=1
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "✅ PAGES BRANDING GATE: PASS"
  exit 0
else
  echo "❌ PAGES BRANDING GATE: FAIL"
  exit 1
fi
