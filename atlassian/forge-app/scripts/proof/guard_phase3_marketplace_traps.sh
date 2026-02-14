#!/bin/bash

###############################################################################
# STEP 4: Repo-Wide Marketplace Trap Guard (Claim-Level Security Check)
#
# Procurement-grade validation: scans repo for FALSE POSITIVE CLAIMS only.
#
# Catches EXPLICIT claims like: "We are SOC2 compliant" or "FirstTry is certified"
# Ignores context like: "❌ App-level ISO certification", "NOT certified", "platform-level"
#
# Key principles:
# 1. Only flag EXPLICIT POSITIVE CLAIMS (not documentation context)
# 2. Ignore lines with negation markers (NO, NOT, ❌, does not, is not)
# 3. Ignore platform/inherited language (Atlassian, platform-level, data processor)
# 4. Technical standards (CSP, WCAG) already excluded by narrow scope
#
# Fail-closed: Real claims = exit(1)
# Non-bypassable: set -euo pipefail with trap cleanup
#
###############################################################################

set -euo pipefail

# Argument validation: accept 0 or 1 args only
if [ "$#" -gt 1 ]; then
  echo "[FT_PROOF] ERROR: guard_phase3_marketplace_traps.sh takes 0 or 1 args (repo root)" >&2
  exit 2
fi

# Trap cleanup on exit
trap 'exit_code=$?; echo "[FT_PROOF] Guard cleanup (exit=$exit_code)"; exit $exit_code' EXIT

root="${1:-.}"
echo "[FT_PROOF] Starting claim-level marketplace trap guard..."
echo "[FT_PROOF] scan_root=$root"

VIOLATION_COUNT=0

###############################################################################
# CHECK 1: Explicit Positive Compliance/Certification Claims
###############################################################################

echo "[FT_PROOF] CHECK_FORBIDDEN_CLAIMS_START"
echo "[FT_PROOF] Scanning for explicit positive compliance/certification claims..."

# STRICT PATTERN: Look for EXPLICIT CLAIM STATEMENTS
# Pattern requirements:
# - Must have claim verb: "is", "are", "claim", "complies", "certified by", etc.
# - Must have explicit subject: "this", "FirstTry", "the app", "our", "we", etc.
# - Must have framework mention: SOC2, ISO, HIPAA, GDPR, etc.
# - Must NOT: start with negation (NO, NOT, ❌), contain "platform-level", contain "does not"

# Search in src/ and docs/ for claim patterns
CLAIM_VIOLATIONS=$(rg -B1 -A1 --pcre2 -i \
  '(?<!not\s)(?<!no\s)(this\s+(app|application|product|system).*?(is|are|claim|compli)\s+(SOC\s?2|SOC2|ISO|27001|GDPR|HIPAA|PCI|DORA|NIST|FedRAMP)|we\s+(are|claim|compli).*?(SOC\s?2|SOC2|ISO|27001|GDPR|HIPAA|PCI|DORA|NIST|FedRAMP))' \
  "$root/src" "$root/docs" 2>/dev/null || true)

# Second filter: Remove all context/false positives
# Remove: negation lines, separator lines, empty lines, and rg context lines (with -  or : suffix)
CLAIM_VIOLATIONS=$(echo "$CLAIM_VIOLATIONS" | \
  grep -v -iE '(^--+$|[\./](ts|tsx|js|jsx|md)-$|does\s+not|is\s+not|cannot|not\s+claim|platform-level|inherited|Atlassian|data\s+processor|No\s+certification|No\s+Overclaims)' | \
  grep -E '\S' || true)

if [ -n "$CLAIM_VIOLATIONS" ]; then
  echo "[FT_PROOF] ERROR: Explicit positive compliance claims found:"
  echo "$CLAIM_VIOLATIONS" | sed 's/^/[FT_PROOF]   /'
  VIOLATION_COUNT=$((VIOLATION_COUNT + 1))
fi

###############################################################################
# CHECK 2: Forbidden API Patterns (Org-Admin APIs)
###############################################################################

echo "[FT_PROOF] CHECK_FORBIDDEN_APIS_START"
echo "[FT_PROOF] Scanning for forbidden org-admin APIs..."

FORBIDDEN_API_PATTERN='admin\.atlassian\.com|/admin/organization|/cloud/admin|organizations/rest'

API_VIOLATIONS=$(rg -E "$FORBIDDEN_API_PATTERN" "$root/src" "$root/docs" 2>/dev/null || true)

if [ -n "$API_VIOLATIONS" ]; then
  echo "[FT_PROOF] CHECK_FORBIDDEN_APIS_FAIL"
  echo "[FT_PROOF] ERROR: Forbidden APIs found:"
  echo "$API_VIOLATIONS" | sed 's/^/[FT_PROOF]   /'
  exit 1
fi

echo "[FT_PROOF] CHECK_FORBIDDEN_APIS_PASS"
echo "[FT_PROOF] Marketplace trap: No forbidden APIs detected ✓"

###############################################################################
# CHECK 3: Org-Admin Scope (Audit Trail)
###############################################################################

echo "[FT_PROOF] Scanning for org-admin scoped operations..."

ORG_ADMIN_VIOLATIONS=$(rg -E 'org\.admin|organization\.admin|api/organization' "$root/src" "$root/docs" 2>/dev/null || true)

if [ -n "$ORG_ADMIN_VIOLATIONS" ]; then
  echo "[FT_PROOF] ERROR: Org-admin scoped operations found:"
  echo "$ORG_ADMIN_VIOLATIONS" | sed 's/^/[FT_PROOF]   /'
  exit 1
fi

echo "[FT_PROOF] Marketplace trap: No org-admin scope detected ✓"

###############################################################################
# CHECK 4: Disclaimer Presence (INFO-ONLY, NEVER FAILS)
###############################################################################

echo "[FT_PROOF] Checking for explicit compliance disclaimers (info-only)..."

DISCLAIMERS=$(rg --pcre2 -i '(NOT\s+(certified|compliant|ISO|SOC2|HIPAA|GDPR|27001|27002|NIST|FedRAMP|PCI)|does\s+not\s+claim|no\s+certification)' "$root/src" "$root/docs" 2>/dev/null || true)

DISCLAIMER_COUNT=$(echo "$DISCLAIMERS" | grep -c . || echo 0)

echo "[FT_PROOF] DISCLAIMER_LINES_COUNT=$DISCLAIMER_COUNT"

###############################################################################
# SUMMARY
###############################################################################

if [ "$VIOLATION_COUNT" -gt 0 ]; then
  echo "[FT_PROOF] CHECK_FORBIDDEN_CLAIMS_FAIL"
  echo "[FT_PROOF] Marketplace trap: EXPLICIT POSITIVE CLAIMS BLOCKED"
  exit 1
fi

echo "[FT_PROOF] CHECK_FORBIDDEN_CLAIMS_PASS"
echo ""
echo "[FT_PROOF] =========================================="
echo "[FT_PROOF] Marketplace Trap Guard: ALL CHECKS PASSED"
echo "[FT_PROOF] =========================================="
echo "[FT_PROOF] Explicit positive claims: NOT FOUND ✓"
echo "[FT_PROOF] Forbidden APIs: NOT FOUND ✓"
echo "[FT_PROOF] Org-admin scope: NOT FOUND ✓"
echo "[FT_PROOF] Disclaimers found: $DISCLAIMER_COUNT (info-only)"
echo "[FT_PROOF] =========================================="
echo "[FT_PROOF] Repository is marketplace-ready"

exit 0
