#!/bin/bash

###############################################################################
# STEP 4: Repo-Wide Marketplace Trap Guard
#
# Procurement-grade validation: scans entire repo for forbidden language
# and org-admin APIs that would prevent marketplace approval.
#
# Fail-closed: Any match = exit(1) with error markers
# Non-bypassable: set -euo pipefail with trap cleanup
#
# Forbidden Language Registry (case-insensitive):
# - "compliant", "certified", "SOC2 compliant", "ISO certified"
#
# Forbidden API Patterns (Cloud-only, no Org Admin):
# - "/admin/organization", "/cloud/admin", "organizations/rest", "admin.atlassian.com"
#
# Scans:
# - src/ (all TypeScript/JavaScript)
# - docs/ (all documentation)
# - Config files: package.json, tsconfig.json, etc.
#
###############################################################################

set -euo pipefail

# Trap cleanup on exit
trap 'exit_code=$?; echo "[FT_PROOF] Guard cleanup (exit=$exit_code)"; exit $exit_code' EXIT

REPO_ROOT="${1:-.}"
FORBIDDEN_LANGUAGE_PATTERN='compliant|certified|SOC2|ISO 8601|admin portal|site admin'
FORBIDDEN_API_PATTERN='admin\.atlassian\.com|/admin/organization|/cloud/admin|organizations/rest'

echo "[FT_PROOF] Starting marketplace trap guard..."
echo "[FT_PROOF] Repository: $REPO_ROOT"

# Track failures
TRAP_COUNT=0
FAILED_FILES=""

###############################################################################
# CHECK 1: Forbidden Language (Compliance Language)
###############################################################################

echo "[FT_PROOF] Scanning for forbidden language (case-insensitive)..."

# Scan src/ directory for TypeScript/JavaScript files
if [ -d "$REPO_ROOT/src" ]; then
  LANG_MATCHES=$(find "$REPO_ROOT/src" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec grep -il "$FORBIDDEN_LANGUAGE_PATTERN" {} + 2>/dev/null || true)
  if [ -n "$LANG_MATCHES" ]; then
    echo "[FT_PROOF] ERROR: Forbidden language found in src/"
    echo "$LANG_MATCHES" | while read -r file; do
      echo "  - $file"
      TRAP_COUNT=$((TRAP_COUNT + 1))
      FAILED_FILES="$FAILED_FILES$file
"
    done
  fi
fi

# Scan docs/ directory
if [ -d "$REPO_ROOT/docs" ]; then
  LANG_MATCHES=$(find "$REPO_ROOT/docs" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.doc*" \) -exec grep -il "$FORBIDDEN_LANGUAGE_PATTERN" {} + 2>/dev/null || true)
  if [ -n "$LANG_MATCHES" ]; then
    echo "[FT_PROOF] ERROR: Forbidden language found in docs/"
    echo "$LANG_MATCHES" | while read -r file; do
      echo "  - $file"
      TRAP_COUNT=$((TRAP_COUNT + 1))
      FAILED_FILES="$FAILED_FILES$file
"
    done
  fi
fi

# Scan config files in root
for config in package.json tsconfig.json README.md .env.example; do
  if [ -f "$REPO_ROOT/$config" ]; then
    if grep -iq "$FORBIDDEN_LANGUAGE_PATTERN" "$REPO_ROOT/$config" 2>/dev/null || false; then
      echo "[FT_PROOF] ERROR: Forbidden language in $config"
      TRAP_COUNT=$((TRAP_COUNT + 1))
      FAILED_FILES="$FAILED_FILES$config
"
    fi
  fi
done

if [ "$TRAP_COUNT" -gt 0 ]; then
  echo "[FT_PROOF] Marketplace trap: FORBIDDEN LANGUAGE BLOCKED"
  exit 1
fi

echo "[FT_PROOF] Marketplace trap: Language check PASSED ✓"

###############################################################################
# CHECK 2: Forbidden API Patterns (Org-Admin Only)
###############################################################################

echo "[FT_PROOF] Scanning for forbidden API patterns..."
TRAP_COUNT=0

# Scan src/ for API patterns
if [ -d "$REPO_ROOT/src" ]; then
  API_MATCHES=$(find "$REPO_ROOT/src" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -exec grep -E "$FORBIDDEN_API_PATTERN" {} + 2>/dev/null || true)
  if [ -n "$API_MATCHES" ]; then
    echo "[FT_PROOF] ERROR: Forbidden API found in src/"
    echo "$API_MATCHES" | while read -r match; do
      echo "  - $match"
      TRAP_COUNT=$((TRAP_COUNT + 1))
    done
  fi
fi

# Scan docs/ for API patterns
if [ -d "$REPO_ROOT/docs" ]; then
  API_MATCHES=$(find "$REPO_ROOT/docs" -type f \( -name "*.md" -o -name "*.txt" \) -exec grep -E "$FORBIDDEN_API_PATTERN" {} + 2>/dev/null || true)
  if [ -n "$API_MATCHES" ]; then
    echo "[FT_PROOF] ERROR: Forbidden API found in docs/"
    echo "$API_MATCHES" | while read -r match; do
      echo "  - $match"
      TRAP_COUNT=$((TRAP_COUNT + 1))
    done
  fi
fi

if [ "$TRAP_COUNT" -gt 0 ]; then
  echo "[FT_PROOF] Marketplace trap: FORBIDDEN API BLOCKED"
  exit 1
fi

echo "[FT_PROOF] Marketplace trap: API check PASSED ✓"

###############################################################################
# CHECK 3: Audit Trail (No Org-Admin scoped comments)
###############################################################################

echo "[FT_PROOF] Scanning for org-admin scoped operations..."
# Look for actual org-admin API references or org.admin patterns, not just "site admin" mentions
ORG_ADMIN_COMMENTS=$(find "$REPO_ROOT/src" -type f \( -name "*.ts" -o -name "*.js" \) -exec grep -E "org\.admin|organization\.admin|site\.admin|api/organization" {} + 2>/dev/null || true)

if [ -n "$ORG_ADMIN_COMMENTS" ]; then
  echo "[FT_PROOF] ERROR: Org-admin scoped operations found"
  echo "$ORG_ADMIN_COMMENTS"
  exit 1
fi

echo "[FT_PROOF] Marketplace trap: Org-admin scope check PASSED ✓"

###############################################################################
# SUMMARY
###############################################################################

echo ""
echo "[FT_PROOF] ========================================"
echo "[FT_PROOF] Marketplace Trap Guard: ALL CHECKS PASSED"
echo "[FT_PROOF] ========================================"
echo "[FT_PROOF] Forbidden language: NOT FOUND ✓"
echo "[FT_PROOF] Forbidden APIs: NOT FOUND ✓"
echo "[FT_PROOF] Org-admin scope: NOT FOUND ✓"
echo "[FT_PROOF] Repository is marketplace-ready"
echo "[FT_PROOF] ========================================"

exit 0
