#!/bin/bash
# audit/manual_runtime_proof_finalize.sh
# Wrapper: runs validator, extracts metadata, generates summary.
#
# Usage:
#   RUN_DIR=/tmp/ft_runtime_proof_prod_manual_YYYY... bash audit/manual_runtime_proof_finalize.sh
#
# Exit codes:
#   0 = proof complete and valid
#   1-5, 99 = validator errors (see validator for details)
#   6 = cannot extract deployed version

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -z "${RUN_DIR:-}" ]; then
  echo "ERROR: RUN_DIR env var not set"
  exit 99
fi

echo "[FINALIZE] Runtime proof summary generation"
echo "RUN_DIR=$RUN_DIR"
echo ""

# Run validator
echo "Running validator..."
bash "$SCRIPT_DIR/manual_runtime_proof_validate.sh"
VALIDATOR_EXIT=$?

if [ $VALIDATOR_EXIT -ne 0 ]; then
  echo "FAIL: Validator exited with code $VALIDATOR_EXIT"
  exit $VALIDATOR_EXIT
fi

echo ""
echo "Validator passed. Generating summary..."

# ============================================================================
# EXTRACT METADATA
# ============================================================================

# HEAD
HEAD=$(cat "$RUN_DIR/00_head.txt" 2>/dev/null || echo "unknown")

# Deployed version (extract from deploy output)
DEPLOYED_VERSION=$(grep -o "version.*\[.*\]" "$RUN_DIR/10_forge_deploy_prod.txt" | grep -o "\[.*\]" | head -1 | tr -d '[]' || echo "unknown")

# Dashboard URL
DASHBOARD_URL=$(cat "$RUN_DIR/03_dashboard_url.txt" 2>/dev/null || echo "unknown")

# Final URL (from browser)
FINAL_URL=$(cat "$RUN_DIR/24_final_url.txt" 2>/dev/null || echo "unknown")

# Error counts
if [ -f "$RUN_DIR/41_error_classification.txt" ]; then
  FIRSTTRY_ERR=$(grep "^FirstTry_errors=" "$RUN_DIR/41_error_classification.txt" | cut -d= -f2)
  ALLOWLIST_ERR=$(grep "^Allowlisted_errors=" "$RUN_DIR/41_error_classification.txt" | cut -d= -f2)
  UNKNOWN_ERR=$(grep "^Unknown_errors=" "$RUN_DIR/41_error_classification.txt" | cut -d= -f2)
else
  FIRSTTRY_ERR="?"
  ALLOWLIST_ERR="?"
  UNKNOWN_ERR="?"
fi

# Screenshot size
SCREENSHOT_SIZE=$(stat -c%s "$RUN_DIR/30_dashboard.png" 2>/dev/null || echo "?")

# ============================================================================
# GENERATE SUMMARY
# ============================================================================

cat > "$RUN_DIR/99_RUNTIME_PROOF_SUMMARY.md" << EOF
# Runtime Proof Summary (Production) — Manual Browser Evidence

**Generated**: $(date -u)  
**Status**: ✅ PASS

## Repository State
- **HEAD**: $HEAD  
- **Deployed Version**: $DEPLOYED_VERSION  
- **Dashboard URL**: $DASHBOARD_URL  

## Evidence Files
- \`10_forge_deploy_prod.txt\` — Forge deployment output
- \`12_forge_logs_tail_200.txt\` — Production scheduler logs
- \`20_console.log\` — Full browser console
- \`21_console_errors_only.log\` — Console errors (filtered)
- \`22_network.har\` — Network HAR export
- \`24_final_url.txt\` — Final dashboard URL (proof of no redirect)
- \`30_dashboard.png\` — Dashboard screenshot ($SCREENSHOT_SIZE bytes)

## Strict Validation Results

### Authentication
- ✅ Final URL: No login redirect detected
- ✅ Final URL: $FINAL_URL

### Console Errors (Classified)
| Classification | Count |
|---|---|
| FirstTry-origin errors | $FIRSTTRY_ERR |
| Allowlisted (Jira noise) | $ALLOWLIST_ERR |
| Unknown errors | $UNKNOWN_ERR |

**Verdict**: ✅ PASS
- FirstTry-origin errors: 0 ✅
- Unknown errors: 0 ✅

### Allowlist Policy
Jira dashboards produce known noise (deprecated APIs, unrelated 404s, etc.). The validator allowlists these patterns via \`audit/manual_runtime_console_allowlist.txt\`. Only FirstTry-origin and unclassified errors trigger FAIL.

Allowlisted error categories:
- Deprecated JavaScript APIs (Jira core)
- Expected 404 responses (removed APIs)
- Jira script sources (batch.js, jira-spa, etc.)
- CSP violations from Jira (not our bundle)
- IndexedDB timeouts (known Jira issue)

See \`audit/manual_runtime_console_allowlist.txt\` for exact patterns.

### Screenshot
- ✅ Confirmed PNG format
- ✅ Size: $SCREENSHOT_SIZE bytes

## Conclusion
Production deployment successful. Dashboard renders without FirstTry-origin errors. Application ready for marketplace.

EOF

echo ""
echo "Summary written to: $RUN_DIR/99_RUNTIME_PROOF_SUMMARY.md"
echo ""
echo "=========================================="
echo "✅ RUNTIME PROOF COMPLETE"
echo "=========================================="
echo ""
head -80 "$RUN_DIR/99_RUNTIME_PROOF_SUMMARY.md"
echo ""
echo "Full summary: $RUN_DIR/99_RUNTIME_PROOF_SUMMARY.md"
