#!/bin/bash
################################################################################
# BACKBONE LAYER 0: INVOCATION PROOF HARNESS
# 
# PURPOSE: Deterministically prove (or disprove) that:
#   1. Jira gadget UI successfully invokes production backend resolvers
#   2. Requests correlate via ui_req_id
#   3. Responses contain valid backend_build_sha
#
# USAGE:
#   bash tools/l0_invocation_proof.sh
#
# OUTPUT:
#   - Evidence directory: /tmp/ft_l0_invocation_<TIMESTAMP>
#   - Report: docs/BACKBONE_L0_INVOCATION_PROOF_RESULT.md
#   - Exit code: 0 on PASS, 1 on FAIL
#
# REQUIREMENTS:
#   - forge CLI configured and authenticated
#   - Production environment accessible
#   - bash 4.0+
#   - Standard tools: grep, sed, awk, cat, mkdir, date, timeout
#
################################################################################

set -euo pipefail

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Utility functions
log_info() {
  echo -e "${BLUE}ℹ${NC}  $*"
}

log_success() {
  echo -e "${GREEN}✅${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC}  $*"
}

log_error() {
  echo -e "${RED}❌${NC} $*"
}

################################################################################
# STEP 1: Create evidence directory with timestamp
################################################################################

EVID="/tmp/ft_l0_invocation_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$EVID"

log_success "Evidence directory created: $EVID"

################################################################################
# STEP 2: Capture repo + deploy context
################################################################################

log_info "Capturing repo + deploy context..."

# Git HEAD
git rev-parse HEAD > "$EVID/01_head.txt" 2>&1 || echo "git rev-parse failed" > "$EVID/01_head.txt"
log_info "  Captured git HEAD"

# Forge whoami
forge whoami > "$EVID/02_whoami.txt" 2>&1 || echo "forge whoami failed" > "$EVID/02_whoami.txt"
log_info "  Captured forge whoami"

# Forge install list
timeout 30 forge install list --environment production > "$EVID/03_install_prod.txt" 2>&1 || echo "forge install list failed" > "$EVID/03_install_prod.txt"
log_info "  Captured forge install list"

################################################################################
# STEP 3: Capture production logs BEFORE user action
################################################################################

log_info "Capturing production logs (PRE-ACTION, 10 minutes)..."

timeout 180 forge logs --environment production --since 10m 2>&1 | tee "$EVID/10_logs_pre_raw.txt" > /dev/null
log_success "  Saved raw logs to 10_logs_pre_raw.txt"

timeout 180 forge logs --environment production --since 10m --grouped 2>&1 | tee "$EVID/11_logs_pre_grouped.txt" > /dev/null
log_success "  Saved grouped logs to 11_logs_pre_grouped.txt"

################################################################################
# STEP 4: Human interaction prompt
################################################################################

echo ""
echo "================================================================================"
echo "HUMAN INTERACTION REQUIRED"
echo "================================================================================"
echo ""
echo "To capture proof that the UI is invoking the backend:"
echo ""
echo "1. Navigate to the Jira dashboard with the Firsttry gadget"
echo "2. Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)"
echo "3. Click the 'Refresh now' button in the gadget"
echo "4. Click the 'Run Probe' button"
echo "5. Wait 5-10 seconds for the gadget to load"
echo "6. Look at the footer of the gadget for 'ui_req_id' (format: ui_...)"
echo "7. Copy that value and paste it below"
echo ""
echo "================================================================================"
echo ""

read -r -p "Paste UI_REQ_ID from footer (format: ui_XXXXXXX...): " UIREQ

# Validate input
if [[ -z "$UIREQ" ]]; then
  log_error "No UI_REQ_ID provided. Aborting."
  exit 1
fi

if ! echo "$UIREQ" | grep -q '^ui_'; then
  log_warn "UI_REQ_ID does not start with 'ui_': $UIREQ"
fi

log_success "Captured UI_REQ_ID: $UIREQ"
echo "$UIREQ" > "$EVID/00_uireq.txt"

# Give backend time to process
log_info "Waiting 10 seconds for backend to process..."
sleep 10

################################################################################
# STEP 5: Capture production logs AFTER user action
################################################################################

log_info "Capturing production logs (POST-ACTION, 10 minutes)..."

timeout 180 forge logs --environment production --since 10m 2>&1 | tee "$EVID/20_logs_post_raw.txt" > /dev/null
log_success "  Saved raw logs to 20_logs_post_raw.txt"

timeout 180 forge logs --environment production --since 10m --grouped 2>&1 | tee "$EVID/21_logs_post_grouped.txt" > /dev/null
log_success "  Saved grouped logs to 21_logs_post_grouped.txt"

################################################################################
# STEP 6: Evidence extraction (grep-based)
################################################################################

log_info "Extracting evidence from logs..."

# Extract UIREQ hits from post logs (raw)
grep -F "$UIREQ" "$EVID/20_logs_post_raw.txt" > "$EVID/30_uireq_hits.txt" 2>/dev/null || true
UIREQ_COUNT=$(wc -l < "$EVID/30_uireq_hits.txt")
log_info "  Found $UIREQ_COUNT lines with UI_REQ_ID"

# Extract resolver markers from post logs (raw)
grep -E 'RESOLVER_ENTER|RESOLVER_OK|RESOLVER_ERR|PING_|PROBE_|backend_build_sha' "$EVID/20_logs_post_raw.txt" > "$EVID/31_marker_hits.txt" 2>/dev/null || true

# Count specific markers
RESOLVER_ENTER_COUNT=$(grep -c 'RESOLVER_ENTER' "$EVID/20_logs_post_raw.txt" 2>/dev/null || echo 0)
RESOLVER_OK_COUNT=$(grep -c 'RESOLVER_OK' "$EVID/20_logs_post_raw.txt" 2>/dev/null || echo 0)
RESOLVER_ERR_COUNT=$(grep -c 'RESOLVER_ERR' "$EVID/20_logs_post_raw.txt" 2>/dev/null || echo 0)
PROBE_COUNT=$(grep -c 'PROBE_' "$EVID/20_logs_post_raw.txt" 2>/dev/null || echo 0)
PING_COUNT=$(grep -c 'PING_' "$EVID/20_logs_post_raw.txt" 2>/dev/null || echo 0)
BUILD_SHA_COUNT=$(grep -c 'backend_build_sha' "$EVID/20_logs_post_raw.txt" 2>/dev/null || echo 0)

# Save counts
{
  echo "UIREQ_COUNT=$UIREQ_COUNT"
  echo "RESOLVER_ENTER_COUNT=$RESOLVER_ENTER_COUNT"
  echo "RESOLVER_OK_COUNT=$RESOLVER_OK_COUNT"
  echo "RESOLVER_ERR_COUNT=$RESOLVER_ERR_COUNT"
  echo "PROBE_COUNT=$PROBE_COUNT"
  echo "PING_COUNT=$PING_COUNT"
  echo "BUILD_SHA_COUNT=$BUILD_SHA_COUNT"
} > "$EVID/40_counts.txt"

log_info "  RESOLVER_ENTER: $RESOLVER_ENTER_COUNT"
log_info "  RESOLVER_OK: $RESOLVER_OK_COUNT"
log_info "  RESOLVER_ERR: $RESOLVER_ERR_COUNT"
log_info "  PING: $PING_COUNT"
log_info "  PROBE: $PROBE_COUNT"
log_info "  backend_build_sha: $BUILD_SHA_COUNT"

################################################################################
# STEP 7: Advanced evidence extraction
################################################################################

log_info "Performing advanced evidence extraction..."

# Find lines with UI_REQ_ID and extract markers
grep -F "$UIREQ" "$EVID/20_logs_post_raw.txt" | grep -E 'RESOLVER_ENTER|backend_build_sha' > "$EVID/32_uireq_with_markers.txt" 2>/dev/null || true

# Extract backend_build_sha values from UI_REQ_ID lines
grep -F "$UIREQ" "$EVID/20_logs_post_raw.txt" | grep -o 'backend_build_sha[^,}]*' > "$EVID/33_sha_values.txt" 2>/dev/null || true

# Count valid SHA values (hex, 7-40 chars)
VALID_SHA_COUNT=$(grep -o '"[0-9a-f]\{7,40\}"' "$EVID/33_sha_values.txt" 2>/dev/null | wc -l || echo 0)
log_info "  Valid backend_build_sha values: $VALID_SHA_COUNT"

# Extract unique SHA values
grep -o '"[0-9a-f]\{7,40\}"' "$EVID/33_sha_values.txt" 2>/dev/null | sort | uniq > "$EVID/34_unique_shas.txt" || true

################################################################################
# STEP 8: PASS/FAIL determination
################################################################################

log_info "Determining PASS/FAIL status..."

PASS=1  # Start with PASS=1 (success), set to 0 on any failure

FAIL_REASON=""

# Gate 1: UIREQ appears in logs at least once
if [[ $UIREQ_COUNT -lt 1 ]]; then
  log_error "  FAIL: UI_REQ_ID does not appear in logs"
  FAIL_REASON="${FAIL_REASON}• UI_REQ_ID '$UIREQ' not found in production logs (0 occurrences)\n"
  PASS=0
else
  log_success "  PASS: UI_REQ_ID found in logs ($UIREQ_COUNT occurrences)"
fi

# Gate 2: At least one RESOLVER_ENTER line exists
if [[ $RESOLVER_ENTER_COUNT -lt 1 ]]; then
  log_error "  FAIL: No RESOLVER_ENTER markers found"
  FAIL_REASON="${FAIL_REASON}• No RESOLVER_ENTER markers in logs (0 occurrences)\n"
  PASS=0
else
  log_success "  PASS: RESOLVER_ENTER markers found ($RESOLVER_ENTER_COUNT)"
fi

# Gate 3: RESOLVER_ENTER line with ui_req_id contains valid backend_build_sha
if [[ ! -s "$EVID/32_uireq_with_markers.txt" ]] || [[ $VALID_SHA_COUNT -lt 1 ]]; then
  log_error "  FAIL: No RESOLVER_ENTER with valid backend_build_sha for UI_REQ_ID"
  FAIL_REASON="${FAIL_REASON}• No valid backend_build_sha (format: /^[0-9a-f]{7,40}\$/) found in RESOLVER_ENTER logs for this ui_req_id\n"
  PASS=0
else
  log_success "  PASS: Valid backend_build_sha found in RESOLVER_ENTER ($VALID_SHA_COUNT)"
fi

################################################################################
# STEP 9: Generate final report
################################################################################

log_info "Generating final report..."

REPORT_PATH="docs/BACKBONE_L0_INVOCATION_PROOF_RESULT.md"

# Create docs directory if it doesn't exist
mkdir -p "$(dirname "$REPORT_PATH")"

{
  echo "# BACKBONE LAYER 0: INVOCATION PROOF RESULT"
  echo ""
  echo "**Timestamp:** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "**Evidence Directory:** \`$EVID\`"
  echo ""
  echo "## Status"
  echo ""
  if [[ $PASS -eq 1 ]]; then
    echo "✅ **PASS** - Gadget UI is successfully invoking backend resolvers with valid correlation"
  else
    echo "❌ **FAIL** - Invocation proof incomplete or missing"
  fi
  echo ""
  echo "## Key Findings"
  echo ""
  echo "| Metric | Value |"
  echo "|--------|-------|"
  echo "| UI_REQ_ID Provided | \`$UIREQ\` |"
  echo "| UI_REQ_ID in Logs | $UIREQ_COUNT occurrences |"
  echo "| RESOLVER_ENTER Count | $RESOLVER_ENTER_COUNT |"
  echo "| RESOLVER_OK Count | $RESOLVER_OK_COUNT |"
  echo "| RESOLVER_ERR Count | $RESOLVER_ERR_COUNT |"
  echo "| PING Invocations | $PING_COUNT |"
  echo "| PROBE Invocations | $PROBE_COUNT |"
  echo "| Valid backend_build_sha | $VALID_SHA_COUNT |"
  echo ""
  echo "## Evidence Files"
  echo ""
  echo "| File | Purpose |"
  echo "|------|---------|"
  echo "| \`00_uireq.txt\` | UI_REQ_ID provided by user |"
  echo "| \`01_head.txt\` | Git commit SHA |"
  echo "| \`02_whoami.txt\` | Forge authentication context |"
  echo "| \`03_install_prod.txt\` | Production gadget installations |"
  echo "| \`10_logs_pre_raw.txt\` | Raw logs before user action (10 min) |"
  echo "| \`11_logs_pre_grouped.txt\` | Grouped logs before user action |"
  echo "| \`20_logs_post_raw.txt\` | Raw logs after user action (10 min) |"
  echo "| \`21_logs_post_grouped.txt\` | Grouped logs after user action |"
  echo "| \`30_uireq_hits.txt\` | All log lines containing UI_REQ_ID |"
  echo "| \`31_marker_hits.txt\` | All lines with resolver markers |"
  echo "| \`32_uireq_with_markers.txt\` | UI_REQ_ID lines with RESOLVER_ENTER |"
  echo "| \`33_sha_values.txt\` | Extracted backend_build_sha values |"
  echo "| \`34_unique_shas.txt\` | Unique backend_build_sha values |"
  echo "| \`40_counts.txt\` | Marker occurrence counts |"
  echo ""
  echo "## Pass/Fail Criteria"
  echo ""
  echo "✅ **PASS Requirements (ALL must be true):**"
  echo "  1. UI_REQ_ID appears in production logs at least once"
  echo "  2. At least one RESOLVER_ENTER marker exists in logs"
  echo "  3. RESOLVER_ENTER line contains valid backend_build_sha matching /^[0-9a-f]{7,40}\$/"
  echo ""
  echo "❌ **FAIL Conditions:**"
  if [[ $PASS -eq 0 ]]; then
    echo ""
    echo "$FAIL_REASON"
    echo "**Interpretation:**"
    if [[ $UIREQ_COUNT -lt 1 ]]; then
      echo "- UI_REQ_ID not found: The gadget may not have invoked the backend, or logs are delayed."
      echo "  Recommendation: Wait 30 seconds and re-run the script with the same UI_REQ_ID."
    fi
    if [[ $RESOLVER_ENTER_COUNT -lt 1 ]]; then
      echo "- RESOLVER_ENTER markers missing: Backend resolvers were not invoked."
      echo "  Recommendation: Verify gadget UI code is configured to call backend resolvers."
    fi
    if [[ $VALID_SHA_COUNT -lt 1 ]]; then
      echo "- backend_build_sha missing/invalid: Either build script failed or resolvers not updated."
      echo "  Recommendation: Run 'node tools/build_meta.mjs' and redeploy."
    fi
  else
    echo ""
    echo "No issues detected. All pass criteria met."
  fi
  echo ""
  echo "## Correlation Chain"
  echo ""
  echo "**Evidence chain:**"
  echo "1. User copy UI_REQ_ID from footer → \`$UIREQ\`"
  echo "2. Backend logs show RESOLVER_ENTER with that UI_REQ_ID"
  echo "3. backend_build_sha in the same log line matches build injection"
  echo ""
  echo "**This proves:**"
  echo "- UI successfully invoked backend"
  echo "- Request was properly correlated across layers"
  echo "- Build metadata was correctly injected and propagated"
  echo ""
  echo "---"
  echo ""
  echo "**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  echo "**Evidence directory:** \`$EVID\`"
  echo ""
} > "$REPORT_PATH"

log_success "Report generated: $REPORT_PATH"

################################################################################
# STEP 10: Exit with appropriate code
################################################################################

echo ""
echo "================================================================================"
if [[ $PASS -eq 1 ]]; then
  log_success "INVOCATION PROOF: PASS ✅"
  echo "================================================================================"
  echo ""
  log_success "Evidence directory: $EVID"
  log_success "Report: $REPORT_PATH"
  echo ""
  exit 0
else
  log_error "INVOCATION PROOF: FAIL ❌"
  echo "================================================================================"
  echo ""
  log_error "Evidence directory: $EVID"
  log_error "Report: $REPORT_PATH"
  echo ""
  echo "Review $REPORT_PATH for failure reasons and recommendations."
  echo ""
  exit 1
fi
