#!/bin/bash

##############################################################################
# PHASE 3 v3.2.4 - Production Logs Proof (Truth Fix)
# TRUTH FIX: No SKIPPED_OK. In dev: exit 2 with explicit marker.
# In prod: fail if markers missing.
##############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib_proof.sh"

log_marker "[FT_PROOF_PROD_LOGS_START]"
log_info ""
log_info "==================================================================="
log_info "PRODUCTION LOGS VERIFICATION (TRUTH FIX - NO SKIPPED_OK)"
log_info "==================================================================="

# =========================================================================
# Check if in production mode
# =========================================================================
if [[ -z "${FORGE_ENV:-}" ]]; then
  log_info ""
  log_info "FORGE_ENV not set - NOT in production mode"
  log_info "Production logs verification SKIPPED (dev environment only)"
  log_marker "[FT_PROOF_PROD_LOGS_NOT_APPLICABLE_DEV]"
  log_pass "✓ Dev environment - production gate not applicable"
  log_info ""
  exit 2
fi

if [[ "$FORGE_ENV" != "production" ]]; then
  log_info ""
  log_info "FORGE_ENV=$FORGE_ENV (not production) - NOT in production mode"
  log_info "Production logs verification SKIPPED (not production)"
  log_marker "[FT_PROOF_PROD_LOGS_NOT_APPLICABLE_DEV]"
  log_pass "✓ Dev environment - production gate not applicable"
  log_info ""
  exit 2
fi

# =========================================================================
# IN PRODUCTION MODE: Enforce strict checks
# =========================================================================
log_info ""
log_info "FORGE_ENV=production detected - enforcing strict production checks"

# Step 1: Verify Forge CLI
log_info ""
log_info "Verifying Forge CLI installation..."
if ! command -v forge &> /dev/null; then
  log_fail "PROD_FORGE_CLI_NOT_FOUND - Forge CLI required in production"
  exit 1
fi
log_pass "Forge CLI available"

# Step 2: Verify Forge authentication
log_info ""
log_info "Checking Forge authentication..."
if ! forge whoami > /dev/null 2>&1; then
  log_fail "PROD_FORGE_AUTH_FAILED - Not authenticated with Forge"
  exit 1
fi
log_pass "Forge authenticated"

# Step 3: Fetch production logs
log_info ""
log_info "Fetching production logs..."
prod_logs_file="${MASTER_EVIDENCE_DIR:-/tmp/ft_prod_logs}/prod-logs-full.txt"
mkdir -p "$(dirname "$prod_logs_file")"

if ! forge logs -e production --tail 400 > "$prod_logs_file" 2>&1; then
  log_fail "PROD_LOGS_FETCH_FAILED - could not retrieve production logs"
  exit 1
fi

if [[ ! -s "$prod_logs_file" ]]; then
  log_fail "PROD_LOGS_EMPTY - no production logs returned"
  exit 1
fi

log_pass "Production logs fetched ($(wc -l < "$prod_logs_file") lines)"

# Step 4: Verify required markers
log_info ""
log_info "Verifying required markers in production logs..."

local required_markers=(
  "FT_PROOF_PHASE32_BORING_RELIABILITY_PASS"
  "FT_REVIEW_EXPORT_COMPLETE"
)

local missing_markers=0
for marker in "${required_markers[@]}"; do
  if grep -q "$marker" "$prod_logs_file" 2>/dev/null; then
    log_pass "Marker found: $marker"
  else
    log_fail "MARKER_MISSING: $marker"
    missing_markers=$((missing_markers + 1))
  fi
done

if [[ $missing_markers -gt 0 ]]; then
  log_fail "PROD_MARKERS_INCOMPLETE - $missing_markers markers missing"
  exit 1
fi

log_marker "[FT_PROOF_PROD_LOGS_OK]"
log_pass "✓ Production logs verification complete (all markers present)"
log_info ""

exit 0



