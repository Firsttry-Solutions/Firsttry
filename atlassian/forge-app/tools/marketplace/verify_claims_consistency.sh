#!/usr/bin/env bash
# verify_claims_consistency.sh
# Compare product_facts.json vs trust_doc_claims.json (fail-closed)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Evidence directory
E="${1:-/tmp/ft_marketplace_gap_closure_latest}"
if [[ ! -d "$E" ]]; then
  E="/tmp/ft_marketplace_gap_closure_latest"
fi
E=$(readlink -f "$E" 2>/dev/null || echo "$E")

FACTS="$E/02_claims/product_facts.json"
CLAIMS="$E/02_claims/trust_doc_claims.json"
REPORT="$E/02_claims/consistency_report.md"
REPORT_JSON="$E/02_claims/consistency_report.json"
VERDICT="$E/02_claims/VERDICT.txt"

echo "[CLAIMS CONSISTENCY] Verifying documentation vs implementation..."

if [[ ! -f "$FACTS" ]]; then
  echo "ERROR: Product facts not found at $FACTS"
  exit 1
fi

if [[ ! -f "$CLAIMS" ]]; then
  echo "ERROR: Trust doc claims not found at $CLAIMS"
  exit 1
fi

# Initialize counters
PASS_COUNT=0
FAIL_COUNT=0
WARNINGS=()
FAILURES=()

# Load data
EXTERNAL_URL_COUNT=$(jq -r '.external_url_count' "$FACTS")
SCOPES=$(jq -r '.scopes | join(",")' "$FACTS")
HAS_WEBTRIGGER=$(jq -r '.has_webtrigger' "$FACTS")
HAS_SCHEDULED=$(jq -r '.has_scheduled' "$FACTS")
STORAGE_USAGE=$(jq -r '.storage_usage_count' "$FACTS")

NO_EGRESS_SEC=$(jq -r '.no_egress_security_md' "$CLAIMS")
NO_EGRESS_PERM=$(jq -r '.no_egress_permissions_md' "$CLAIMS")
READ_ONLY_CLAIM=$(jq -r '.read_only_claim' "$CLAIMS")
RETENTION_PERIOD=$(jq -r '.retention_period' "$CLAIMS")
DELETION_TIMELINE=$(jq -r '.deletion_timeline' "$CLAIMS")
ENCRYPTION_CLAIM=$(jq -r '.encryption_claim' "$CLAIMS")
ENCRYPTION_SCOPED=$(jq -r '.encryption_properly_scoped' "$CLAIMS")
SUPPORT_EMAIL=$(jq -r '.support_email' "$CLAIMS")
SECURITY_EMAIL=$(jq -r '.security_email' "$CLAIMS")
DISCLOSURE_EMAIL=$(jq -r '.disclosure_email' "$CLAIMS")
DISCLOSURE_TIMELINE=$(jq -r '.disclosure_timeline' "$CLAIMS")

# Start report
cat > "$REPORT" <<EOF
# Claims Consistency Report

**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)

## Test Results

EOF

# Check 1: No egress claims
echo "  [1/10] Checking no-egress claims..."
if [[ "$NO_EGRESS_SEC" != "null" ]] || [[ "$NO_EGRESS_PERM" != "null" ]]; then
  if [[ "$EXTERNAL_URL_COUNT" -gt 0 ]]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILURES+=("FAIL: Docs claim no external egress, but code contains $EXTERNAL_URL_COUNT external URLs")
    echo "    ❌ FAIL: Documentation claims no egress but code has external URLs"
  else
    PASS_COUNT=$((PASS_COUNT + 1))
    echo "    ✅ PASS: No-egress claim consistent with code"
  fi
else
  WARNINGS+=("No explicit no-egress claim found (acceptable if egress exists)")
  echo "    ⚠️  WARN: No explicit no-egress claim"
fi

# Check 2: Read-only claims
echo "  [2/10] Checking read-only claims..."
if [[ "$READ_ONLY_CLAIM" != "null" ]]; then
  WRITE_SCOPES=$(echo "$SCOPES" | grep -i "write\|delete\|manage" || echo "")
  if [[ -n "$WRITE_SCOPES" ]]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILURES+=("FAIL: Docs claim read-only but manifest has write scopes: $WRITE_SCOPES")
    echo "    ❌ FAIL: Read-only claim inconsistent with scopes"
  elif [[ "$HAS_WEBTRIGGER" == "true" ]] || [[ "$HAS_SCHEDULED" == "true" ]]; then
    WARNINGS+=("WARN: Read-only claim but has webtrigger/scheduled (could write via storage)")
    echo "    ⚠️  WARN: Read-only claim but has write-capable modules"
  else
    PASS_COUNT=$((PASS_COUNT + 1))
    echo "    ✅ PASS: Read-only claim consistent"
  fi
else
  echo "    ⚠️  No read-only claim (acceptable)"
fi

# Check 3: Retention period stated
echo "  [3/10] Checking retention period..."
if [[ "$STORAGE_USAGE" -gt 0 ]] && [[ "$RETENTION_PERIOD" == "null" ]]; then
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILURES+=("FAIL: App uses storage ($STORAGE_USAGE calls) but no retention period documented")
  echo "    ❌ FAIL: Storage usage without documented retention"
elif [[ "$RETENTION_PERIOD" != "null" ]]; then
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "    ✅ PASS: Retention period documented"
else
  echo "    ⚠️  No storage usage, retention period not required"
fi

# Check 4: Deletion timeline
echo "  [4/10] Checking deletion timeline..."
if [[ "$STORAGE_USAGE" -gt 0 ]] && [[ "$DELETION_TIMELINE" == "null" ]]; then
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILURES+=("FAIL: App uses storage but no deletion timeline documented")
  echo "    ❌ FAIL: Storage usage without deletion timeline"
elif [[ "$DELETION_TIMELINE" != "null" ]]; then
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "    ✅ PASS: Deletion timeline documented"
else
  echo "    ⚠️  No storage usage, deletion timeline not required"
fi

# Check 5: Encryption claims properly scoped
echo "  [5/10] Checking encryption claims..."
if [[ "$ENCRYPTION_CLAIM" != "null" ]] && [[ "$ENCRYPTION_SCOPED" != "true" ]]; then
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILURES+=("FAIL: Encryption claim found but not properly scoped to Forge platform")
  echo "    ❌ FAIL: Encryption overclaim (must specify Forge handles it)"
elif [[ "$ENCRYPTION_CLAIM" != "null" ]]; then
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "    ✅ PASS: Encryption claim properly scoped"
else
  WARNINGS+=("No encryption claim (should mention Forge platform encryption)")
  echo "    ⚠️  WARN: No encryption claim"
fi

# Check 6: Support email
echo "  [6/10] Checking support email..."
if [[ "$SUPPORT_EMAIL" == "null" ]]; then
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILURES+=("FAIL: No support email in support-sla.md")
  echo "    ❌ FAIL: Missing support email"
else
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "    ✅ PASS: Support email present"
fi

# Check 7: Security email
echo "  [7/10] Checking security email..."
if [[ "$SECURITY_EMAIL" == "null" ]]; then
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILURES+=("FAIL: No security email in security.md")
  echo "    ❌ FAIL: Missing security contact"
else
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "    ✅ PASS: Security email present"
fi

# Check 8: Disclosure email
echo "  [8/10] Checking disclosure email..."
if [[ "$DISCLOSURE_EMAIL" == "null" ]]; then
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILURES+=("FAIL: No disclosure email in vulnerability-disclosure.md")
  echo "    ❌ FAIL: Missing disclosure contact"
else
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "    ✅ PASS: Disclosure email present"
fi

# Check 9: Disclosure timeline
echo "  [9/10] Checking disclosure timeline..."
if [[ "$DISCLOSURE_TIMELINE" == "null" ]]; then
  WARNINGS+=("WARN: No disclosure timeline specified")
  echo "    ⚠️  WARN: Missing disclosure timeline"
else
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "    ✅ PASS: Disclosure timeline present"
fi

# Check 10: Scopes match reality
echo "  [10/10] Checking scope documentation..."
if [[ -f "$REPO_ROOT/docs/trust/access-scope-and-permissions.md" ]]; then
  SCOPE_DOC_MENTIONS=0
  while IFS= read -r scope; do
    if grep -q "$scope" "$REPO_ROOT/docs/trust/access-scope-and-permissions.md"; then
      SCOPE_DOC_MENTIONS=$((SCOPE_DOC_MENTIONS + 1))
    fi
  done < <(jq -r '.scopes[]' "$FACTS")
  
  TOTAL_SCOPES=$(jq -r '.scopes | length' "$FACTS")
  if [[ "$SCOPE_DOC_MENTIONS" -lt "$TOTAL_SCOPES" ]]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILURES+=("FAIL: Only $SCOPE_DOC_MENTIONS/$TOTAL_SCOPES scopes documented")
    echo "    ❌ FAIL: Incomplete scope documentation"
  else
    PASS_COUNT=$((PASS_COUNT + 1))
    echo "    ✅ PASS: All scopes documented"
  fi
else
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILURES+=("FAIL: access-scope-and-permissions.md missing")
  echo "    ❌ FAIL: Permissions doc missing"
fi

# Write failures to report
if [[ ${#FAILURES[@]} -gt 0 ]]; then
  echo "" >> "$REPORT"
  echo "## ❌ Failures" >> "$REPORT"
  echo "" >> "$REPORT"
  for failure in "${FAILURES[@]}"; do
    echo "- $failure" >> "$REPORT"
  done
fi

# Write warnings to report
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo "" >> "$REPORT"
  echo "## ⚠️  Warnings" >> "$REPORT"
  echo "" >> "$REPORT"
  for warning in "${WARNINGS[@]}"; do
    echo "- $warning" >> "$REPORT"
  done
fi

# Summary
echo "" >> "$REPORT"
echo "## Summary" >> "$REPORT"
echo "" >> "$REPORT"
echo "- **Passed:** $PASS_COUNT" >> "$REPORT"
echo "- **Failed:** $FAIL_COUNT" >> "$REPORT"
echo "- **Warnings:** ${#WARNINGS[@]}" >> "$REPORT"

# JSON report
jq -n \
  --argjson passed "$PASS_COUNT" \
  --argjson failed "$FAIL_COUNT" \
  --argjson warnings "${#WARNINGS[@]}" \
  '{
    passed: $passed,
    failed: $failed,
    warnings: $warnings,
    overall: (if $failed == 0 then "PASS" else "FAIL" end)
  }' > "$REPORT_JSON"

# Verdict
if [[ "$FAIL_COUNT" -eq 0 ]]; then
  echo "PASS" > "$VERDICT"
  echo ""
  echo "✅ VERDICT: PASS ($PASS_COUNT checks passed, ${#WARNINGS[@]} warnings)"
  echo "  Report: $REPORT"
  exit 0
else
  echo "FAIL" > "$VERDICT"
  echo ""
  echo "❌ VERDICT: FAIL ($FAIL_COUNT failures, $PASS_COUNT passed)"
  echo "  Report: $REPORT"
  exit 1
fi
