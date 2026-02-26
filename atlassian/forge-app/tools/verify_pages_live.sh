#!/usr/bin/env bash
# verify_pages_live.sh — Fail-closed live GitHub Pages verification
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

REQUIRED_PATHS=(
  "/"
  "/trust/SECURITY_OVERVIEW.md"
  "/trust/RESOLVER_INVENTORY.md"
  "/trust/SUBPROCESSORS.md"
  "/operations/SLA.md"
  "/operations/INCIDENT_RESPONSE_PLAN.md"
  "/procurement/ENTERPRISE_SECURITY_PACK_INDEX.md"
  "/procurement/SECURITY_QUESTIONNAIRE_MASTER.md"
  "/procurement/CONTROL_MAPPING_MATRIX.md"
  "/evidence/RETENTION_POLICY.md"
)

FORBIDDEN_PATHS=(
  "/production/"
  "/dist/"
  "/node_modules/"
)

ERRORS=0

echo "============================================"
echo "Live GitHub Pages Verification"
echo "BASE: $BASE"
echo "============================================"
echo ""

# ─── helper: in_allowlist ───────────────────────────────────────────────────
in_allowlist() {
  local email="$1"
  for a in "${ALLOWLIST[@]}"; do
    [[ "$a" == "$email" ]] && return 0
  done
  return 1
}

# ─── SECTION 1: Required paths must return HTTP 200 ─────────────────────────
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

# ─── SECTION 2: Forbidden paths must NOT return 200 ─────────────────────────
echo "=== Section 2: Forbidden paths (must NOT return 200) ==="
for path in "${FORBIDDEN_PATHS[@]}"; do
  url="${BASE}${path}"
  http_code=$(curl -o /dev/null -s -w "%{http_code}" --max-time 15 "$url" || echo "000")
  if [[ "$http_code" != "200" ]]; then
    echo "  PASS: $url [got $http_code, not 200 — correct]"
  else
    echo "  FAIL: $url [got 200 — forbidden path is live!]" >&2
    ERRORS=1
  fi
done
echo ""

# ─── SECTION 3: Content checks (placeholders + email allowlist) ──────────────
echo "=== Section 3: Content checks (placeholders + email allowlist) ==="
for path in "${REQUIRED_PATHS[@]}"; do
  url="${BASE}${path}"
  content=$(curl -fsSL --max-time 15 "$url" 2>/dev/null || true)
  if [[ -z "$content" ]]; then
    echo "  SKIP (empty/error fetch): $url"
    continue
  fi

  page_errors=0

  # Check forbidden placeholder literals
  for pat in "${FORBIDDEN_PLACEHOLDERS[@]}"; do
    if echo "$content" | grep -qF "$pat"; then
      echo "  FAIL: $url — contains placeholder '$pat'" >&2
      page_errors=1
      ERRORS=1
    fi
  done

  # Check whole-word TBD / TODO (case-insensitive), skip index.html for these
  if [[ "$path" != "/" ]]; then
    for tok in '\bTBD\b' '\bTODO\b'; do
      if echo "$content" | grep -qiE "$tok"; then
        echo "  FAIL: $url — contains whole-word token '$tok'" >&2
        page_errors=1
        ERRORS=1
      fi
    done
  fi

  # Extract all emails and check allowlist
  extracted=$(echo "$content" \
    | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' \
    | sort -u || true)
  while IFS= read -r email; do
    [[ -z "$email" ]] && continue
    if ! in_allowlist "$email"; then
      echo "  FAIL: $url — disallowed email '$email'" >&2
      page_errors=1
      ERRORS=1
    fi
  done <<< "$extracted"

  if [[ $page_errors -eq 0 ]]; then
    echo "  PASS: $url — content clean (no placeholders, emails OK)"
  fi
done
echo ""

# ─── SUMMARY ─────────────────────────────────────────────────────────────────
echo "============================================"
if [[ $ERRORS -ne 0 ]]; then
  echo "RESULT: FAIL — one or more checks failed (see errors above)"
  exit 1
fi
echo "RESULT: PASS — all live GitHub Pages checks passed"
echo "  • All required paths returned 200"
echo "  • All forbidden paths returned non-200"
echo "  • No placeholder patterns found in content"
echo "  • All emails are on the approved allowlist"
echo "============================================"
exit 0
