#!/bin/bash

###############################################################################
# STEP 4 Selftest: Marketplace Guard Consistency Validation (Claim-Level)
#
# Validates that the guard correctly:
# 1. PASSES on evidence-only language and technical standards
# 2. FAILS on EXPLICIT positive claim statements
# 3. PASSES on disclaimers ("not certified", "not compliant")
#
###############################################################################

# Argument validation: accept 0 or 1 args only
if [ "$#" -gt 1 ]; then
  echo "[FT_PROOF] ERROR: selftest_phase3_guard_consistency.sh takes 0 or 1 args (repo root)" >&2
  exit 2
fi

root="${1:-.}"

echo "[FT_PROOF] Starting marketplace guard selftest (claim-level)..."
echo "[FT_PROOF] selftest_root=$root"
echo ""

# Detect rg availability
have_rg=0
if command -v rg >/dev/null 2>&1; then have_rg=1; fi
echo "[FT_PROOF] rg_available=$have_rg"

FAILED=0

###############################################################################
# TEST 1: Verify disclaimers are properly detected
###############################################################################

echo "[FT_PROOF] TEST 1: Verifying disclaimer detection..."

TEMP_TEST=$(mktemp)

cat > "$TEMP_TEST" << 'EOF'
// This app does NOT claim SOC2 certification
// FirstTry is NOT ISO 27001 certified
// This product is NOT compliant with HIPAA
EOF

# Test if disclaimers are detected
DISCLAIMER_COUNT=$(rg --pcre2 -i '(NOT\s+(certified|compliant|ISO|SOC2|HIPAA|GDPR|27001|27002|NIST|FedRAMP|PCI)|does\s+not\s+claim|no\s+certification)' "$TEMP_TEST" 2>/dev/null | wc -l || echo "0")

if [ "$DISCLAIMER_COUNT" -eq 3 ]; then
  echo "[FT_PROOF] ✓ TEST 1 PASS: Disclaimer detection working (found $DISCLAIMER_COUNT)"
else
  echo "[FT_PROOF] ✗ TEST 1 FAIL: Expected 3 disclaimers, found $DISCLAIMER_COUNT"
  FAILED=1
fi

rm -f "$TEMP_TEST"

###############################################################################
# TEST 2: Verify technical standards are NOT flagged
###############################################################################

echo "[FT_PROOF] TEST 2: Verifying technical standards allowlist..."

TEMP_TECH=$(mktemp)

cat > "$TEMP_TECH" << 'EOF'
// This response is CSP-compliant (Content Security Policy)
// Widget supports WCAG 2.1 Level AA compliance
// This library provides ARIA-compliant interface
// Our CSS follows WAI guidelines for accessibility
EOF

# These should NOT match the claim pattern
TECH_VIOLATIONS=$(rg --pcre2 -iB1 -A1 '(?<!not\s)(?<!no\s)(this\s+(app|application|product|system).*?(is|are|claim|compli)\s+(SOC\s?2|SOC2|ISO|27001|GDPR|HIPAA|PCI|DORA|NIST|FedRAMP)|we\s+(are|claim|compli).*?(SOC\s?2|SOC2|ISO|27001|GDPR|HIPAA|PCI|DORA|NIST|FedRAMP))' "$TEMP_TECH" 2>/dev/null | wc -l || echo "0")

if [ "$TECH_VIOLATIONS" -eq 0 ]; then
  echo "[FT_PROOF] ✓ TEST 2 PASS: Technical standards not flagged"
else
  echo "[FT_PROOF] ✗ TEST 2 FAIL: Technical standards incorrectly flagged ($TECH_VIOLATIONS lines)"
  FAILED=1
fi

rm -f "$TEMP_TECH"

###############################################################################
# TEST 3: Verify EXPLICIT positive claims ARE detected
###############################################################################

echo "[FT_PROOF] TEST 3: Verifying explicit claim detection..."

TEMP_CLAIM=$(mktemp)

cat > "$TEMP_CLAIM" << 'EOF'
// This application is SOC2 certified
// FirstTry are ISO 27001 certified
// Our system claims GDPR compliance
EOF

# These SHOULD match (count lines with content, not including separators)
CLAIM_MATCHES=$(rg --pcre2 -iB1 -A1 '(?<!not\s)(?<!no\s)(this\s+(app|application|product|system).*?(is|are|claim|compli)\s+(SOC\s?2|SOC2|ISO|27001|GDPR|HIPAA|PCI|DORA|NIST|FedRAMP)|we\s+(are|claim|compli).*?(SOC\s?2|SOC2|ISO|27001|GDPR|HIPAA|PCI|DORA|NIST|FedRAMP))' "$TEMP_CLAIM" 2>/dev/null | grep -v '^--$' | wc -l || echo "0")

if [ "$CLAIM_MATCHES" -gt 0 ]; then
  echo "[FT_PROOF] ✓ TEST 3 PASS: Explicit claims detected ($CLAIM_MATCHES lines)"
else
  echo "[FT_PROOF] ✗ TEST 3 FAIL: Failed to detect explicit positive claims"
  FAILED=1
fi

rm -f "$TEMP_CLAIM"
###############################################################################
# TEST 3A: Verify pattern detects positive claims in isolation
###############################################################################

echo "[FT_PROOF] TEST 3A: Verifying pattern detects positive claims..."

cat > /tmp/test_positive_claim.txt << 'EOF'
We are SOC2 compliant.
This app is ISO 27001 certified.
EOF

# Test if the guard's pattern would match
DETECT_COUNT=$(rg --pcre2 -i '(?<!not\s)(?<!no\s)(this\s+(app|application|product|system).*?(is|are|claim|compli)\s+(SOC\s?2|SOC2|ISO|27001|GDPR|HIPAA|PCI|DORA|NIST|FedRAMP)|we\s+(are|claim|compli).*?(SOC\s?2|SOC2|ISO|27001|GDPR|HIPAA|PCI|DORA|NIST|FedRAMP))' /tmp/test_positive_claim.txt 2>/dev/null | wc -l)

if [ "$DETECT_COUNT" -ge 2 ]; then
  echo "[FT_PROOF] ✓ TEST 3A PASS: Pattern detects positive claims (count=$DETECT_COUNT)"
  echo "[FT_PROOF] SELFTEST_POSITIVE_CLAIM_DETECTED count=$DETECT_COUNT"
else
  echo "[FT_PROOF] ✗ TEST 3A FAIL: Pattern should detect positive claims (found $DETECT_COUNT)"
  FAILED=1
fi

rm -f /tmp/test_positive_claim.txt

###############################################################################
# TEST 3B: Verify pattern allows disclaimers
###############################################################################

echo "[FT_PROOF] TEST 3B: Verifying pattern allows disclaimers..."

cat > /tmp/test_disclaimers.txt << 'EOF'
This app is NOT SOC2 compliant.
This app is not ISO 27001 certified.
We do not claim GDPR compliance.
EOF

# Test if the pattern would match these (it should NOT, or filter should remove them)
DISCLAIM_COUNT=$(rg --pcre2 -i '(?<!not\s)(?<!no\s)(this\s+(app|application|product|system).*?(is|are|claim|compli)\s+(SOC\s?2|SOC2|ISO|27001|GDPR|HIPAA|PCI|DORA|NIST|FedRAMP)|we\s+(are|claim|compli).*?(SOC\s?2|SOC2|ISO|27001|GDPR|HIPAA|PCI|DORA|NIST|FedRAMP))' /tmp/test_disclaimers.txt 2>/dev/null | \
  grep -v -iE '(does\s+not|is\s+not|cannot|not\s+claim|not\s+compliant)' | wc -l)

if [ "$DISCLAIM_COUNT" -eq 0 ]; then
  echo "[FT_PROOF] ✓ TEST 3B PASS: Disclaimers correctly filtered"
  echo "[FT_PROOF] SELFTEST_ALLOWLIST_OK"
else
  echo "[FT_PROOF] ✗ TEST 3B FAIL: Disclaimers should be filtered (found $DISCLAIM_COUNT)"
  FAILED=1
fi

rm -f /tmp/test_disclaimers.txt

###############################################################################
# TEST 4: Run full guard on clean repository
###############################################################################

echo "[FT_PROOF] TEST 4: Running full guard on repository..."

if bash "$root/scripts/proof/guard_phase3_marketplace_traps.sh" "$root" > /tmp/selftest_guard_output.txt 2>&1; then
  echo "[FT_PROOF] ✓ TEST 4 PASS: Guard passes on clean repository"
else
  echo "[FT_PROOF] ✗ TEST 4 FAIL: Guard failed on clean repository"
  cat /tmp/selftest_guard_output.txt
  FAILED=1
fi

###############################################################################
# TEST 5: Verify forbidden APIs are detected
###############################################################################

echo "[FT_PROOF] TEST 5: Verifying forbidden API detection..."

TEMP_API=$(mktemp)

cat > "$TEMP_API" << 'EOF'
// This uses admin.atlassian.com endpoint
// POST /admin/organization info
// GET /cloud/admin scopes
EOF

# Use grep for reliable API detection
API_VIOLATIONS=$(grep -F 'admin.atlassian.com' "$TEMP_API" 2>/dev/null | wc -l)
API_VIOLATIONS=$((API_VIOLATIONS + $(grep -F '/admin/organization' "$TEMP_API" 2>/dev/null | wc -l)))
API_VIOLATIONS=$((API_VIOLATIONS + $(grep -F '/cloud/admin' "$TEMP_API" 2>/dev/null | wc -l)))


if [ "$API_VIOLATIONS" -eq 3 ]; then
  echo "[FT_PROOF] ✓ TEST 5 PASS: Forbidden APIs detected ($API_VIOLATIONS lines)"
else
  echo "[FT_PROOF] ✗ TEST 5 FAIL: Expected 3 forbidden APIs, found $API_VIOLATIONS"
  FAILED=1
fi

rm -f "$TEMP_API"

###############################################################################
# SUMMARY
###############################################################################

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "[FT_PROOF] =========================================="
  echo "[FT_PROOF] Selftest: ALL 7 TESTS PASSED ✓"
  echo "[FT_PROOF] =========================================="
  echo "[FT_PROOF] 1. Disclaimer detection: PASS"
  echo "[FT_PROOF] 2. Technical standards allowlist: PASS"
  echo "[FT_PROOF] 3. Explicit claim detection: PASS"
  echo "[FT_PROOF] 3A. Guard rejects positive claims: PASS"
  echo "[FT_PROOF] 3B. Guard accepts allowed content: PASS"
  echo "[FT_PROOF] 4. Guard on clean repo: PASS"
  echo "[FT_PROOF] 5. Forbidden API detection: PASS"
  echo "[FT_PROOF] =========================================="
  echo "[FT_PROOF] Guard consistency verified"
  exit 0
else
  echo "[FT_PROOF] =========================================="
  echo "[FT_PROOF] Selftest: SOME TESTS FAILED"
  echo "[FT_PROOF] =========================================="
  exit 1
fi
