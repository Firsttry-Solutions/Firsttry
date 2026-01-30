#!/usr/bin/env bash
set -euo pipefail

# Fail-closed gate: forbid unverified/unsubstantiated claims in key marketplace documentation
# This gate prevents marketing language in LISTING KIT that cannot be proven by code or evidence.
#
# Banned patterns in marketplace documents ONLY (will fail build if found):
# - SOC 2, SOC2, ISO 27001, ISO27001 (unless explicitly marked "not certified")
# - AES-256, AES256, AES (cryptography claims)
# - SLA, response time claims (without documented SLA file)
# - Type II, Type 2 (compliance tier claims)
# - "guarantee", "guaranteed" (liability claims)

PATTERN='SOC 2|SOC2|ISO 27001|ISO27001|AES-256|AES256|AES|SLA|Type II|Type 2|guarantee|guaranteed'

# Only check marketplace-facing documentation (not historical phase docs)
CHECK_FILES=(
  "docs/DATA_HANDLING_POLICY.md"
  "docs/MARKETPLACE_LISTING_KIT.md"
  "docs/PUBLIC_URLS.md"
  "docs/CONTACTS.md"
)

FOUND_VIOLATIONS=0
for FILE in "${CHECK_FILES[@]}"; do
  if [ -f "$FILE" ]; then
    if rg -n "$PATTERN" "$FILE" >/dev/null 2>&1; then
      HITS=$(rg -n "$PATTERN" "$FILE" 2>/dev/null || true)
      echo "FAIL: Unverified claims found in $FILE:"
      echo "$HITS"
      FOUND_VIOLATIONS=$((FOUND_VIOLATIONS + 1))
    fi
  fi
done

if [ $FOUND_VIOLATIONS -gt 0 ]; then
  echo "---"
  echo "ACTION: Remove or replace with strictly factual statements only."
  echo "  - No SOC2/ISO27001 claims unless formally certified."
  echo "  - No AES/crypto claims unless backed by code evidence."
  echo "  - No SLA claims unless documented with proof."
  echo "  - No 'guarantee' language (liability risk)."
  exit 1
fi

echo "PASS: No unverified claims detected in marketplace documentation"
exit 0

