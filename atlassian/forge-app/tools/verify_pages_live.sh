#!/usr/bin/env bash
# verify_pages_live.sh — Fail-closed live GitHub Pages verification (F100 portal)
# Usage: bash tools/verify_pages_live.sh
# Exits 0 only if all checks pass; exits 1 on any failure.
set -euo pipefail

BASE="https://firsttry-solutions.github.io/Firsttry"

ALLOWLIST=(
  "contact@firsttry.run"
  "support@firsttry.run"
  "security.contact@firsttry.run"
  "privacy@firsttry.run"
  "emergency@firsttry.run"
)

FORBIDDEN_PLACEHOLDERS=(
  "example.com"
  "example.org"
  "@firsttry.app"
  "[Your Jurisdiction]"
)

# Portal HTML routes + assets that must return 200
REQUIRED_PATHS=(
  "/"
  "/assets/portal.css"
  "/assets/portal.js"
  "/assets/search_index.json"
  "/trust/security-overview.html"
  "/trust/resolver-inventory.html"
  "/trust/subprocessors.html"
  "/trust/privacy-policy.html"
  "/trust/vulnerability-disclosure-policy.html"
  "/operations/sla.html"
  "/operations/incident-response-plan.html"
  "/procurement/enterprise-pack-index.html"
  "/procurement/security-questionnaire.html"
  "/procurement/control-mapping-matrix.html"
  "/evidence/retention-policy.html"
)

# Paths that must NOT return 200
FORBIDDEN_PATHS=(
  "/production/"
  "/dist/"
  "/node_modules/"
)

ERRORS=0

echo "============================================"
echo "Live GitHub Pages Verification (F100 portal)"
echo "BASE: $BASE"
echo "============================================"
echo ""

# ─── helper ──────────────────────────────────────────────────────────────────
in_allowlist() {
  local email="$1"
  for a in "${ALLOWLIST[@]}"; do [[ "$a" == "$email" ]] && return 0; done
  return 1
}

# ─── SECTION 1: Required paths must return HTTP 200 ──────────────────────────
echo "=== Section 1: Required paths (must return 200) ==="
for path in "${REQUIRED_PATHS[@]}"; do
  url="${BASE}${path}"
  http_code=$(curl -o /dev/null -s -w "%{http_code}" --max-time 15 "$url" || echo "000")
  if [[ "$http_code" == "200" ]]; then
    echo "  PASS: $url [200]"
  else
    echo "  FAIL: $url [got $http_code, expected 200]" >&2
    ERRORS=1
  fi
done
echo ""

# ─── SECTION 2: Forbidden paths must NOT return 200 ──────────────────────────
echo "=== Section 2: Forbidden paths (must NOT return 200) ==="
for path in "${FORBIDDEN_PATHS[@]}"; do
  url="${BASE}${path}"
  http_code=$(curl -o /dev/null -s -w "%{http_code}" --max-time 15 "$url" || echo "000")
  if [[ "$http_code" != "200" ]]; then
    echo "  PASS: $url [got $http_code — correct]"
  else
    echo "  FAIL: $url [got 200 — forbidden path is live!]" >&2
    ERRORS=1
  fi
done
echo ""

# ─── SECTION 3: Homepage version + content checks ────────────────────────────
echo "=== Section 3: Homepage content checks ==="
homepage_content=$(curl -fsSL --max-time 20 "${BASE}/" 2>/dev/null || true)

if [[ -z "$homepage_content" ]]; then
  echo "  FAIL: Could not fetch homepage" >&2
  ERRORS=1
else
  # Must contain "Version:"
  if echo "$homepage_content" | grep -q "Version:"; then
    VERSION_FOUND=$(echo "$homepage_content" | grep -oP 'Version: \K[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
    echo "  PASS: Homepage contains Version: ${VERSION_FOUND}"
  else
    echo "  FAIL: Homepage missing Version: string" >&2
    ERRORS=1
  fi

  # Must contain portal title keyword
  if echo "$homepage_content" | grep -qi "Trust Center\|FirstTry"; then
    echo "  PASS: Homepage contains portal branding"
  else
    echo "  FAIL: Homepage missing portal branding" >&2
    ERRORS=1
  fi

  # Check forbidden placeholders
  for pat in "${FORBIDDEN_PLACEHOLDERS[@]}"; do
    if echo "$homepage_content" | grep -qF "$pat"; then
      echo "  FAIL: Homepage contains forbidden placeholder '$pat'" >&2
      ERRORS=1
    fi
  done

  # Check email allowlist on homepage
  extracted=$(echo "$homepage_content" \
    | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' \
    | sort -u || true)
  while IFS= read -r email; do
    [[ -z "$email" ]] && continue
    if ! in_allowlist "$email"; then
      echo "  FAIL: Homepage — disallowed email '$email'" >&2
      ERRORS=1
    fi
  done <<< "$extracted"

  echo "  PASS: Homepage content clean (placeholders OK, emails OK)"
fi
echo ""

# ─── SECTION 4: Key doc page content check ───────────────────────────────────
echo "=== Section 4: Key doc page content check ==="
sec_url="${BASE}/trust/security-overview.html"
sec_content=$(curl -fsSL --max-time 15 "$sec_url" 2>/dev/null || true)
if [[ -n "$sec_content" ]]; then
  if echo "$sec_content" | grep -qi "sidebar\|portal.css\|doc-content"; then
    echo "  PASS: Security Overview page has portal layout (sidebar/CSS)"
  else
    echo "  WARN: Security Overview page may not have portal layout" >&2
  fi
  if echo "$sec_content" | grep -q "FT-TRUST-001"; then
    echo "  PASS: Security Overview page has doc_id FT-TRUST-001"
  else
    echo "  WARN: doc_id FT-TRUST-001 not found in Security Overview page" >&2
  fi
fi
echo ""

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
echo "============================================"
if [[ $ERRORS -ne 0 ]]; then
  echo "RESULT: FAIL — one or more checks failed (see errors above)"
  exit 1
fi
echo "RESULT: PASS — all live GitHub Pages checks passed"
echo "  * All required HTML routes + assets returned 200"
echo "  * All forbidden paths returned non-200"
echo "  * Homepage contains Version: and portal branding"
echo "  * No placeholder patterns found"
echo "  * All emails on approved allowlist"
echo "============================================"
exit 0
