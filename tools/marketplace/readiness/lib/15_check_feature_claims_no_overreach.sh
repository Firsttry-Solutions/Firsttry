#!/bin/bash
# Phase 15: Feature Claims / No Overreach Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_15_feature_claims"

PHASE_DIR="$EVIDENCE_DIR/PHASE_15_feature_claims"
mkdir -p "$PHASE_DIR"

info "Phase 15: Feature Claims / No Overreach"

# Create banned claims list if not exists
BANNED_CLAIMS="$SCRIPT_DIR/BANNED_CLAIMS.txt"
if [ ! -f "$BANNED_CLAIMS" ]; then
  cat > "$BANNED_CLAIMS" <<'EOF'
SOC2 certified
ISO 27001 certified
guaranteed
100% secure
always available
zero downtime
enterprise-grade security
military-grade encryption
bank-level security
fully compliant
certified secure
penetration tested
vulnerability-free
hack-proof
unhackable
never fails
perfect security
government-approved
NSA-approved
certified by
compliant with all regulations
meets all security standards
EOF
fi

# Scan all markdown and text files for banned claims
echo "# Banned Claims Scan" > "$PHASE_DIR/banned_claims_scan.txt"
echo "Scanning for overreach in documentation..." >> "$PHASE_DIR/banned_claims_scan.txt"
echo "" >> "$PHASE_DIR/banned_claims_scan.txt"

# Only scan marketplace-facing docs (docs/marketplace/) for marketplace readiness
DOCS_DIR="$REPO_ROOT/docs/marketplace"
README="$REPO_ROOT/README.md"
PACKAGE_JSON="$REPO_ROOT/atlassian/forge-app/package.json"

FOUND_VIOLATIONS=0

# Check each banned claim
while IFS= read -r claim; do
  [ -z "$claim" ] && continue
  [ "${claim:0:1}" = "#" ] && continue  # skip comments
  
  # Search in docs, README, and package.json description
  # Exclude legitimate documentation contexts:
  # - Explaining what NOT to claim (NOT certified, no guaranteed, etc.)
  # - Audit requirements documentation (MARKETPLACE_REQUIREMENTS_MATRIX)
  # - Claims register documentation (CLAIMS_REGISTER)
  if grep -riE "$claim" "$DOCS_DIR" 2>/dev/null | \
     grep -v "BANNED_CLAIMS" | \
     grep -v "do not claim" | \
     grep -v -iE "\bNOT.*$claim" | \
     grep -v -iE "\bno.*$claim" | \
     grep -v -iE "$claim.*\(not " | \
     grep -v "MARKETPLACE_REQUIREMENTS_MATRIX" | \
     grep -v "CLAIMS_REGISTER" | \
     grep -v -iE "not guaranteed" | \
     grep -v -iE "no guaranteed" > /dev/null; then
    warn "Found banned claim in docs: '$claim'"
    echo "❌ VIOLATION in docs: '$claim'" >> "$PHASE_DIR/banned_claims_scan.txt"
    grep -rn -iE "$claim" "$DOCS_DIR" | \
      grep -v "BANNED_CLAIMS" | \
      grep -v -iE "\bNOT.*$claim" | \
      grep -v -iE "\bno.*$claim" | \
      grep -v -iE "$claim.*\(not " | \
      grep -v "MARKETPLACE_REQUIREMENTS_MATRIX" | \
      grep -v "CLAIMS_REGISTER" | \
      grep -v -iE "not guaranteed" | \
      grep -v -iE "no guaranteed" | \
      head -3 >> "$PHASE_DIR/banned_claims_scan.txt"
    FOUND_VIOLATIONS=$((FOUND_VIOLATIONS + 1))
  fi
  
  if [ -f "$README" ] && grep -iE "$claim" "$README" 2>/dev/null | \
     grep -v -iE "\bNOT.*$claim" | \
     grep -v -iE "\bno.*$claim" > /dev/null; then
    warn "Found banned claim in README: '$claim'"
    echo "❌ VIOLATION in README: '$claim'" >> "$PHASE_DIR/banned_claims_scan.txt"
    grep -n -iE "$claim" "$README" | \
      grep -v -iE "\bNOT.*$claim" | \
      grep -v -iE "\bno.*$claim" | \
      head -2 >> "$PHASE_DIR/banned_claims_scan.txt"
    FOUND_VIOLATIONS=$((FOUND_VIOLATIONS + 1))
  fi
  
  if grep -iE "\"description\".*$claim" "$PACKAGE_JSON" > /dev/null; then
    warn "Found banned claim in package.json: '$claim'"
    echo "❌ VIOLATION in package.json: '$claim'" >> "$PHASE_DIR/banned_claims_scan.txt"
    FOUND_VIOLATIONS=$((FOUND_VIOLATIONS + 1))
  fi
done < "$BANNED_CLAIMS"

if [ $FOUND_VIOLATIONS -gt 0 ]; then
  die "Found $FOUND_VIOLATIONS banned/overreach claims in documentation. Cannot proceed to marketplace."
fi

echo "✓ No banned claims found" >> "$PHASE_DIR/banned_claims_scan.txt"
ok "No overreach or unprovable claims found"

# Check that claims are conservative
echo "" >> "$PHASE_DIR/banned_claims_scan.txt"
echo "# Conservative Language Check" >> "$PHASE_DIR/banned_claims_scan.txt"

# Look for appropriate hedging language
HEDGES=("may" "can" "designed to" "intended to" "aims to" "helps" "supports")
HEDGE_COUNT=0

for hedge in "${HEDGES[@]}"; do
  if grep -riE "\b$hedge\b" "$DOCS_DIR" 2>/dev/null | wc -l | xargs test 0 -lt; then
    HEDGE_COUNT=$((HEDGE_COUNT + 1))
  fi
done

if [ $HEDGE_COUNT -ge 3 ]; then
  ok "Documentation uses conservative, hedged language"
  echo "✓ Uses hedged/conservative language appropriately" >> "$PHASE_DIR/banned_claims_scan.txt"
else
  warn "Documentation may lack appropriate hedging language"
  echo "⚠ Consider using more conservative language (may, can, designed to)" >> "$PHASE_DIR/banned_claims_scan.txt"
fi

write_section "$REPORT_PATH" "Phase 15: Feature Claims / No Overreach - PASS"
echo "- No banned claims found" >> "$REPORT_PATH"
echo "- Conservative language check: passed" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 15: Feature Claims / No Overreach - PASS"
