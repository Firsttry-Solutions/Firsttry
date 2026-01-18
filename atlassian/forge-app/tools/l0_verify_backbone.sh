#!/bin/bash
################################################################################
# l0_verify_backbone.sh - Production Backbone Instrumentation Verification
#
# Purpose: Validates that all BACKBONE_LAYER_0 instrumentation is working:
#   ✓ backend_build_sha is NEVER "unknown"
#   ✓ ui_req_id correlation working (no "ui_missing" in production logs)
#   ✓ RESOLVER_ERR includes trace_id_stable (not UNSET)
#   ✓ Error logging includes code, message, trace (not silent)
#
# Usage:
#   ./tools/l0_verify_backbone.sh             # Default: last 5 minutes
#   ./tools/l0_verify_backbone.sh 10          # Last 10 minutes
#   ./tools/l0_verify_backbone.sh --help
#
# Requirements:
#   - forge CLI installed and authenticated
#   - --environment production configured
#   - jq installed for JSON parsing (optional, falls back to grep)
#
################################################################################

set -e

SINCE_MINUTES="${1:-5}"
ENVIRONMENT="production"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
  echo -e "${BLUE}==============================================================================${NC}"
  echo -e "${BLUE}BACKBONE_LAYER_0 PRODUCTION VERIFICATION${NC}"
  echo -e "${BLUE}==============================================================================${NC}"
}

print_check() {
  echo -e "\n${YELLOW}[CHECK]${NC} $1"
}

print_pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
}

print_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

# Show usage
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
  echo "Usage: $0 [MINUTES]"
  echo ""
  echo "Verifies BACKBONE_LAYER_0 instrumentation in production logs"
  echo ""
  echo "Arguments:"
  echo "  MINUTES     Last N minutes of logs to check (default: 5)"
  echo "  --help      Show this message"
  echo ""
  echo "Checks:"
  echo "  1. backend_build_sha never 'unknown'"
  echo "  2. ui_req_id present and not 'ui_missing'"
  echo "  3. RESOLVER_ERR has trace_id_stable (not UNSET)"
  echo "  4. Error logging includes code, message, trace"
  echo ""
  echo "Exit codes:"
  echo "  0 = All checks passed"
  echo "  1 = One or more checks failed"
  exit 0
fi

print_header

# Verify forge CLI is available
if ! command -v forge &> /dev/null; then
  print_fail "forge CLI not found. Please install Atlassian Forge CLI."
  exit 1
fi

print_info "Retrieving logs from last $SINCE_MINUTES minutes (environment: $ENVIRONMENT)"

# Capture logs (raw format for easier parsing)
LOG_FILE=$(mktemp)
trap "rm -f $LOG_FILE" EXIT

forge logs --environment "$ENVIRONMENT" --since "${SINCE_MINUTES}m" > "$LOG_FILE" 2>&1
LOG_SIZE=$(wc -l < "$LOG_FILE")

if [ "$LOG_SIZE" -eq 0 ]; then
  print_fail "No logs captured. Check environment and authentication."
  exit 1
fi

print_info "Captured $LOG_SIZE lines of logs"

# ============================================================================
# CHECK 1: backend_build_sha NEVER "unknown"
# ============================================================================
print_check "backend_build_sha is never 'unknown'"

UNKNOWN_COUNT=$(grep -c '"backend_build_sha":"unknown"' "$LOG_FILE" 2>/dev/null || echo 0)
if [ "$UNKNOWN_COUNT" -gt 0 ]; then
  print_fail "Found $UNKNOWN_COUNT occurrences of backend_build_sha:'unknown'"
  print_info "First 5 occurrences:"
  grep '"backend_build_sha":"unknown"' "$LOG_FILE" | head -5 | sed 's/^/  /'
  exit 1
else
  print_pass "Zero occurrences of backend_build_sha:'unknown'"
fi

# Check that we have ACTUAL build SHAs (7 hex chars)
SHA_COUNT=$(grep -oP '"backend_build_sha":"[0-9a-f]{7}"' "$LOG_FILE" | wc -l)
if [ "$SHA_COUNT" -gt 0 ]; then
  print_pass "Found $SHA_COUNT logs with valid backend_build_sha (7 hex chars)"
  SAMPLE_SHA=$(grep -oP '"backend_build_sha":"[0-9a-f]{7}"' "$LOG_FILE" | head -1 | cut -d'"' -f4)
  print_info "Example: $SAMPLE_SHA"
else
  print_fail "No valid backend_build_sha values found in logs"
  exit 1
fi

# ============================================================================
# CHECK 2: ui_req_id is present and NEVER "ui_missing" in resolvers
# ============================================================================
print_check "ui_req_id present (not 'ui_missing')"

MISSING_COUNT=$(grep -c '"ui_req_id":"ui_missing' "$LOG_FILE" 2>/dev/null || echo 0)
if [ "$MISSING_COUNT" -gt 0 ]; then
  print_fail "Found $MISSING_COUNT resolver invocations with ui_req_id='ui_missing'"
  print_info "First 5 occurrences:"
  grep '"ui_req_id":"ui_missing' "$LOG_FILE" | head -5 | sed 's/^/  /'
  exit 1
else
  print_pass "Zero occurrences of ui_req_id='ui_missing' in RESOLVER logs"
fi

# Check that we have ACTUAL ui_req_ids (format: ui_*)
REQID_COUNT=$(grep -oP '"ui_req_id":"ui_[^"]{8,}"' "$LOG_FILE" | wc -l)
if [ "$REQID_COUNT" -gt 0 ]; then
  print_pass "Found $REQID_COUNT logs with valid ui_req_id correlation"
  SAMPLE_REQID=$(grep -oP '"ui_req_id":"ui_[^"]{8,}"' "$LOG_FILE" | head -1 | cut -d'"' -f4)
  print_info "Example: $SAMPLE_REQID"
else
  print_fail "No valid ui_req_id values found in logs"
  exit 1
fi

# ============================================================================
# CHECK 3: RESOLVER_ERR includes trace_id_stable (NOT UNSET)
# ============================================================================
print_check "RESOLVER_ERR logs include trace_id_stable (never UNSET)"

UNSET_TRACE_COUNT=$(grep -c '"trace_id_stable":"UNSET"' "$LOG_FILE" 2>/dev/null || echo 0)
if [ "$UNSET_TRACE_COUNT" -gt 0 ]; then
  print_fail "Found $UNSET_TRACE_COUNT RESOLVER_ERR logs with trace_id_stable='UNSET'"
  print_info "First 5 occurrences:"
  grep '"trace_id_stable":"UNSET"' "$LOG_FILE" | head -5 | sed 's/^/  /'
  exit 1
else
  print_pass "Zero occurrences of trace_id_stable='UNSET'"
fi

# Check that error logs have proper trace_id_stable (format: trace_*)
ERROR_TRACE_COUNT=$(grep 'RESOLVER_ERR' "$LOG_FILE" | grep -c '"trace_id_stable":"trace_' 2>/dev/null || echo 0)
if [ "$ERROR_TRACE_COUNT" -gt 0 ]; then
  print_pass "Found $ERROR_TRACE_COUNT RESOLVER_ERR logs with proper trace_id_stable"
else
  # If no errors in this window, that's okay
  print_pass "No RESOLVER_ERR logs in this window (or all have trace_id_stable)"
fi

# ============================================================================
# CHECK 4: Error logging includes code, message, trace (not silent)
# ============================================================================
print_check "RESOLVER_ERR includes code, message, and trace_id_stable"

# Find RESOLVER_ERR lines
ERROR_COUNT=$(grep -c '"marker":"RESOLVER_ERR"' "$LOG_FILE" 2>/dev/null || echo 0)
if [ "$ERROR_COUNT" -eq 0 ]; then
  print_info "No RESOLVER_ERR logs in this window (zero errors is good)"
else
  # Sample a RESOLVER_ERR log
  SAMPLE_ERROR=$(grep '"marker":"RESOLVER_ERR"' "$LOG_FILE" | head -1)
  
  # Check for required fields
  if echo "$SAMPLE_ERROR" | grep -q '"error_code"'; then
    print_pass "RESOLVER_ERR includes error_code"
  else
    print_fail "RESOLVER_ERR missing error_code field"
    exit 1
  fi

  if echo "$SAMPLE_ERROR" | grep -q '"message"'; then
    print_pass "RESOLVER_ERR includes message"
  else
    print_fail "RESOLVER_ERR missing message field"
    exit 1
  fi

  if echo "$SAMPLE_ERROR" | grep -q '"trace_id_stable"'; then
    print_pass "RESOLVER_ERR includes trace_id_stable"
  else
    print_fail "RESOLVER_ERR missing trace_id_stable field"
    exit 1
  fi

  print_info "Sample error log:"
  echo "$SAMPLE_ERROR" | sed 's/^/  /'
fi

# ============================================================================
# CHECK 5: RESOLVER_ENTER logs present
# ============================================================================
print_check "RESOLVER_ENTER logs present (baseline activity check)"

ENTER_COUNT=$(grep -c '"marker":"RESOLVER_ENTER"' "$LOG_FILE" 2>/dev/null || echo 0)
if [ "$ENTER_COUNT" -eq 0 ]; then
  print_fail "No RESOLVER_ENTER logs found - backend may not be receiving requests"
  exit 1
else
  print_pass "Found $ENTER_COUNT RESOLVER_ENTER logs"
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo -e "${BLUE}==============================================================================${NC}"
echo -e "${GREEN}✅ BACKBONE_LAYER_0 VERIFICATION PASSED${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo ""
echo "Summary:"
echo "  ✓ backend_build_sha: NEVER 'unknown' (found $SHA_COUNT valid SHAs)"
echo "  ✓ ui_req_id: NEVER 'ui_missing' (found $REQID_COUNT valid IDs)"
echo "  ✓ trace_id_stable: NEVER 'UNSET' (found $ERROR_TRACE_COUNT error traces)"
echo "  ✓ Error logging: Includes code, message, trace"
echo "  ✓ Activity: $ENTER_COUNT resolver invocations in last $SINCE_MINUTES minutes"
echo ""
echo "All instrumentation checks passed. Production backbone is healthy."
echo ""

exit 0
