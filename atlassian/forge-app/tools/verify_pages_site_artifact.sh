#!/usr/bin/env bash
# verify_pages_site_artifact.sh — Fail-closed site artifact shape + content policy
#
# Usage (from repo root):
#   bash atlassian/forge-app/tools/verify_pages_site_artifact.sh [SITE_DIR]
#
# Usage (from atlassian/forge-app/):
#   bash tools/verify_pages_site_artifact.sh [SITE_DIR]
#
# SITE_DIR defaults to "site/" (relative to cwd).
#
# Checks (all must pass):
#   a) Required files exist  — list loaded from pages_pack_manifest.json
#   b) Forbidden directories absent (production/, dist/, node_modules/)
#   c) No placeholder tokens: example.com, example.org, @firsttry.app,
#      [Your Jurisdiction], whole-word TBD, whole-word TODO
#   d) Every email address is on the 5-address approved allowlist
#
# Exits 0 if all pass; exits 1 on any failure (printing sorted error list).
#
set -euo pipefail

SITE="${1:-site}"

# ── locate manifest (works from repo root or from atlassian/forge-app/) ───────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$SCRIPT_DIR/pages_pack_manifest.json"

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: pages_pack_manifest.json not found at $MANIFEST" >&2
  exit 1
fi

# ── load required_files from manifest (node ≥18 always available in CI) ──────
MANIFEST_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$MANIFEST','utf8')).version)")
REQUIRED_FILES_RAW=$(node -e "
const m = JSON.parse(require('fs').readFileSync('$MANIFEST','utf8'));
const site = process.argv[1];
m.required_files.forEach(f => { console.log(f.replace(/^site\\b/, site)); });
" "$SITE")

mapfile -t REQUIRED_FILES <<< "$REQUIRED_FILES_RAW"

# ── allowlist ─────────────────────────────────────────────────────────────────
ALLOWLIST=(
  "contact@firsttry.run"
  "support@firsttry.run"
  "security.contact@firsttry.run"
  "privacy@firsttry.run"
  "emergency@firsttry.run"
)

# ── forbidden directories ─────────────────────────────────────────────────────
FORBIDDEN_DIRS=(
  "$SITE/production"
  "$SITE/dist"
  "$SITE/node_modules"
)

# ── placeholder patterns (literal) ───────────────────────────────────────────
PLACEHOLDER_LITERALS=(
  "example.com"
  "example.org"
  "@firsttry.app"
  "[Your Jurisdiction]"
)

# ── helpers ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=()

add_error() {
  ERRORS+=("$1")
}

in_allowlist() {
  local email="$1"
  for a in "${ALLOWLIST[@]}"; do
    [[ "$a" == "$email" ]] && return 0
  done
  return 1
}

echo "======================================================="
echo "verify_pages_site_artifact.sh"
echo "Site directory: $(realpath "$SITE" 2>/dev/null || echo "$SITE")"
echo "Manifest version: $MANIFEST_VERSION  (pages_pack_manifest.json)"
echo "Required files:   ${#REQUIRED_FILES[@]} (manifest-driven)"
echo "======================================================="
echo ""

# ── (a) Required files — manifest-driven ─────────────────────────────────────
echo "=== (a) Required files (manifest-driven) ==="
for f in "${REQUIRED_FILES[@]}"; do
  if [ -f "$f" ]; then
    echo -e "  ${GREEN}OK${NC}: $f"
  else
    echo -e "  ${RED}MISSING${NC}: $f" >&2
    add_error "MISSING_FILE: $f"
  fi
done
echo ""

# ── (b) Forbidden directories ─────────────────────────────────────────────────
echo "=== (b) Forbidden directories (must be absent) ==="
for d in "${FORBIDDEN_DIRS[@]}"; do
  if [ ! -d "$d" ]; then
    echo -e "  ${GREEN}OK (absent)${NC}: $d"
  else
    echo -e "  ${RED}FORBIDDEN_DIR_PRESENT${NC}: $d" >&2
    add_error "FORBIDDEN_DIR: $d"
  fi
done
echo ""

# ── (c) Placeholder scan ──────────────────────────────────────────────────────
echo "=== (c) Placeholder scan ==="
PLACEHOLDER_OK=true

for pat in "${PLACEHOLDER_LITERALS[@]}"; do
  matches=$(grep -RFIn --include="*.md" --include="*.html" --include="*.txt" \
    "$pat" "$SITE" 2>/dev/null | sort || true)
  if [ -n "$matches" ]; then
    echo -e "  ${RED}PLACEHOLDER '$pat' found${NC}:" >&2
    while IFS= read -r line; do
      echo "    $line" >&2
      add_error "PLACEHOLDER:$pat: $line"
    done <<< "$matches"
    PLACEHOLDER_OK=false
  fi
done

# Whole-word TBD / TODO (exclude index.html from TBD/TODO check to avoid
# false positives in HTML metadata)
for tok in '\bTBD\b' '\bTODO\b'; do
  matches=$(grep -RIn -E --include="*.md" --include="*.txt" \
    "$tok" "$SITE" 2>/dev/null | sort || true)
  if [ -n "$matches" ]; then
    echo -e "  ${RED}PLACEHOLDER token '$tok' found${NC}:" >&2
    while IFS= read -r line; do
      echo "    $line" >&2
      add_error "PLACEHOLDER:$tok: $line"
    done <<< "$matches"
    PLACEHOLDER_OK=false
  fi
done

if $PLACEHOLDER_OK; then
  echo -e "  ${GREEN}OK${NC}: No placeholder patterns found"
fi
echo ""

# ── (d) Email allowlist ───────────────────────────────────────────────────────
echo "=== (d) Email allowlist ==="
ALL_EMAILS=$(grep -RnoE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' \
  "$SITE" 2>/dev/null \
  | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' \
  | sort -u || true)

EMAIL_OK=true
while IFS= read -r email; do
  [ -z "$email" ] && continue
  if in_allowlist "$email"; then
    echo -e "  ${GREEN}OK${NC}: $email"
  else
    echo -e "  ${RED}DISALLOWED_EMAIL${NC}: $email" >&2
    add_error "DISALLOWED_EMAIL: $email"
    EMAIL_OK=false
  fi
done <<< "$ALL_EMAILS"

if [ -z "$ALL_EMAILS" ]; then
  echo -e "  ${YELLOW}WARN${NC}: No email addresses found in site/ (expected at least 5)"
fi

if $EMAIL_OK && [ -n "$ALL_EMAILS" ]; then
  echo -e "  ${GREEN}OK${NC}: All emails on approved allowlist"
fi
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
echo "======================================================="
if [ ${#ERRORS[@]} -ne 0 ]; then
  echo -e "${RED}FAIL: ${#ERRORS[@]} error(s) detected:${NC}" >&2
  # Print sorted deterministic error list
  printf '%s\n' "${ERRORS[@]}" | sort | while IFS= read -r err; do
    echo "  $err" >&2
  done
  echo "======================================================="
  exit 1
fi

echo -e "${GREEN}PASS: All site artifact checks passed${NC}"
echo "  (a) All required files present (manifest-driven: $MANIFEST_VERSION)"
echo "  (b) No forbidden directories"
echo "  (c) No placeholder tokens"
echo "  (d) All emails on approved allowlist"
echo "======================================================="
exit 0
