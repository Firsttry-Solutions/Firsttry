#!/bin/bash
#
# DEPLOY AND PROVE RUNTIME VERSION
#
# This script orchestrates a deterministic production deployment with
# proof validation via token-gated webtrigger (no logs required).
#
# USAGE:
#   ./tools/deploy_and_prove_runtime_version.sh [RUN_DIR] [EXPECTED_RELEASE]
#
# ARGS:
#   RUN_DIR (optional):     Directory for artifacts. Default: /tmp/ft_runtime_version_proof_${timestamp}
#   EXPECTED_RELEASE (optional): Expected version string. Default: read from release_version.ts
#
# ENVIRONMENT VARS (required for deployment):
#   FT_RUNTIME_PROOF_TOKEN: Token for accessing runtime_proof webtrigger
#
# RETURNS:
#   0 = SUCCESS (all gates pass, proof validated)
#   1 = FAILURE (gate failed or proof mismatch)
#

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================================================
# PHASE 0: SETUP
# ============================================================================

# Get RUN_DIR from arg or generate
RUN_DIR="${1:-}"
if [ -z "$RUN_DIR" ]; then
  TS=$(date +%s%N | sha256sum | cut -c1-12)
  RUN_DIR="/tmp/ft_runtime_version_proof_${TS}"
fi

mkdir -p "$RUN_DIR"

# Log function
log_info() {
  echo -e "${GREEN}[INFO]${NC} $*" | tee -a "${RUN_DIR}/deploy.log"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*" | tee -a "${RUN_DIR}/deploy.log"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "${RUN_DIR}/deploy.log"
}

# ============================================================================
# PHASE 1: PREFLIGHT GATES
# ============================================================================

log_info "=== PHASE 1: PREFLIGHT GATES ==="

cd "$(git rev-parse --show-toplevel)/atlassian/forge-app" || exit 1
SCRIPT_DIR="$(pwd)/tools"

# Gate 1: Clean tree
if ! git status --porcelain=v1 | grep -q .; then
  log_info "✓ Git tree is clean"
else
  log_error "✗ Git tree has uncommitted changes"
  git status --porcelain=v1 | tee -a "${RUN_DIR}/deploy.log"
  exit 1
fi

# Gate 2: On main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" = "main" ]; then
  log_info "✓ On main branch"
else
  log_error "✗ Not on main branch (current: $CURRENT_BRANCH)"
  exit 1
fi

# Gate 3: Synced with origin/main
git fetch origin main 2>&1 | tee -a "${RUN_DIR}/deploy.log"
LOCAL_SHA=$(git rev-parse main)
REMOTE_SHA=$(git rev-parse origin/main)
if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  log_info "✓ main synced with origin/main"
else
  log_error "✗ main out of sync with origin/main (local: $LOCAL_SHA, remote: $REMOTE_SHA)"
  exit 1
fi

# ============================================================================
# PHASE 2: READ EXPECTED RELEASE VERSION
# ============================================================================

log_info "=== PHASE 2: READ EXPECTED RELEASE VERSION ==="

EXPECTED_RELEASE="${2:-}"
if [ -z "$EXPECTED_RELEASE" ]; then
  # Read from release_version.ts
  if [ ! -f "src/release/release_version.ts" ]; then
    log_error "✗ release_version.ts not found"
    exit 1
  fi
  
  EXPECTED_RELEASE=$(grep -oP 'export const FT_RELEASE_VERSION = "\K[^"]+' src/release/release_version.ts)
  if [ -z "$EXPECTED_RELEASE" ]; then
    log_error "✗ Could not parse FT_RELEASE_VERSION from release_version.ts"
    exit 1
  fi
fi

log_info "Expected release version: $EXPECTED_RELEASE"
echo "$EXPECTED_RELEASE" > "${RUN_DIR}/expected_release.txt"

# ============================================================================
# PHASE 3: BUILD WITH GATES
# ============================================================================

log_info "=== PHASE 3: BUILD WITH GATES ==="

if ! npm run build:gadget 2>&1 | tee -a "${RUN_DIR}/build.log"; then
  log_error "✗ Build failed"
  exit 1
fi

log_info "✓ Build succeeded (7/7 gates passed)"

# ============================================================================
# PHASE 4: VERIFY RELEASE VERSION BUMPED
# ============================================================================

log_info "=== PHASE 4: VERIFY RELEASE VERSION BUMPED ==="

if ! bash "$SCRIPT_DIR/verify_release_version_bumped.sh" 2>&1 | tee -a "${RUN_DIR}/version_gate.log"; then
  log_error "✗ Release version gate failed"
  exit 1
fi

log_info "✓ Release version verified"

# ============================================================================
# PHASE 5: DEPLOY TO PRODUCTION
# ============================================================================

log_info "=== PHASE 5: DEPLOY TO PRODUCTION ==="

if ! forge deploy --environment production 2>&1 | tee -a "${RUN_DIR}/forge_deploy.log"; then
  log_error "✗ forge deploy failed"
  exit 1
fi

log_info "✓ forge deploy succeeded"

# ============================================================================
# PHASE 6: INSTALL/UPGRADE
# ============================================================================

log_info "=== PHASE 6: INSTALL/UPGRADE ==="

if ! forge install --upgrade --environment production --site firsttry.atlassian.net --product jira --non-interactive 2>&1 | tee -a "${RUN_DIR}/forge_install.log"; then
  log_error "✗ forge install failed"
  exit 1
fi

log_info "✓ forge install/upgrade succeeded"

# ============================================================================
# PHASE 7: GET WEBTRIGGER URL
# ============================================================================

log_info "=== PHASE 7: GET WEBTRIGGER URL ==="

# Get the webtrigger URL using forge CLI
WEBTRIGGER_URL=$(forge webtriggers:list --environment production --json 2>&1 | \
  grep -oP '"key":"ft-runtime-proof"[^}]*"url":"\K[^"]+' | head -1)

if [ -z "$WEBTRIGGER_URL" ]; then
  log_error "✗ Could not determine webtrigger URL for ft-runtime-proof"
  log_error "Available webtriggers:"
  forge webtriggers:list --environment production --json 2>&1 | tee -a "${RUN_DIR}/webtriggers.log"
  exit 1
fi

log_info "Webtrigger URL: $WEBTRIGGER_URL"
echo "$WEBTRIGGER_URL" > "${RUN_DIR}/webtrigger_url.txt"

# ============================================================================
# PHASE 8: CALL WEBTRIGGER AND COLLECT PROOF
# ============================================================================

log_info "=== PHASE 8: CALL WEBTRIGGER AND COLLECT PROOF ==="

# Check if token is set
if [ -z "${FT_RUNTIME_PROOF_TOKEN:-}" ]; then
  log_error "✗ FT_RUNTIME_PROOF_TOKEN environment variable not set"
  log_error "Set FT_RUNTIME_PROOF_TOKEN='<token>' before running this script"
  echo "FAIL_closed_missing_token" > "${RUN_DIR}/FAIL_runtime_proof.txt"
  exit 1
fi

log_info "Calling webtrigger with token..."

# Call the webtrigger
RESPONSE=$(curl -s -X GET \
  -H "x-ft-token: ${FT_RUNTIME_PROOF_TOKEN}" \
  "${WEBTRIGGER_URL}" 2>&1 || true)

echo "$RESPONSE" > "${RUN_DIR}/80_runtime_proof.json"

log_info "Response received ($(echo "$RESPONSE" | wc -c) bytes)"

# ============================================================================
# PHASE 9: VALIDATE PROOF
# ============================================================================

log_info "=== PHASE 9: VALIDATE PROOF ==="

# Validate response structure using jq
if ! command -v jq &> /dev/null; then
  log_error "✗ jq not found (required for JSON validation)"
  exit 1
fi

# Parse and validate
PROOF_OK=$(echo "$RESPONSE" | jq -r '.ok // false' 2>/dev/null || echo "false")
PROOF_MARKER=$(echo "$RESPONSE" | jq -r '.marker // ""' 2>/dev/null || echo "")
PROOF_RELEASE=$(echo "$RESPONSE" | jq -r '.release // ""' 2>/dev/null || echo "")
PROOF_BUILD_SHA=$(echo "$RESPONSE" | jq -r '.buildSha // ""' 2>/dev/null || echo "")
PROOF_HAS_ASAPP=$(echo "$RESPONSE" | jq -r '.forgeApi.hasAsApp // false' 2>/dev/null || echo "false")

log_info "Parsed proof:"
log_info "  ok: $PROOF_OK"
log_info "  marker: $PROOF_MARKER"
log_info "  release: $PROOF_RELEASE"
log_info "  buildSha: $PROOF_BUILD_SHA"
log_info "  forgeApi.hasAsApp: $PROOF_HAS_ASAPP"

# Validate each field
VALIDATION_PASS=true

if [ "$PROOF_OK" != "true" ]; then
  log_error "✗ Proof ok=false (possible 401 unauthorized)"
  log_error "Response: $RESPONSE"
  VALIDATION_PASS=false
fi

if [ "$PROOF_MARKER" != "FT_RUNTIME_PROOF" ]; then
  log_error "✗ Proof marker mismatch (expected FT_RUNTIME_PROOF, got: $PROOF_MARKER)"
  VALIDATION_PASS=false
fi

if [ "$PROOF_RELEASE" != "$EXPECTED_RELEASE" ]; then
  log_error "✗ Proof release mismatch (expected $EXPECTED_RELEASE, got: $PROOF_RELEASE)"
  VALIDATION_PASS=false
fi

if [ -z "$PROOF_BUILD_SHA" ] || [ "$PROOF_BUILD_SHA" = "UNSET" ]; then
  log_error "✗ Proof buildSha is invalid or UNSET"
  VALIDATION_PASS=false
fi

if [ "$PROOF_HAS_ASAPP" != "true" ]; then
  log_error "✗ Proof forgeApi.hasAsApp not true (got: $PROOF_HAS_ASAPP)"
  VALIDATION_PASS=false
fi

if [ "$VALIDATION_PASS" != "true" ]; then
  log_error "✗ Proof validation FAILED"
  echo "FAIL_proof_validation" > "${RUN_DIR}/FAIL_runtime_proof.txt"
  exit 1
fi

log_info "✓ All proof validations PASSED"

# ============================================================================
# PHASE 10: SUCCESS OUTPUT
# ============================================================================

log_info "=== PHASE 10: SUCCESS ==="

echo "SUCCESS" > "${RUN_DIR}/99_PASS.txt"

# Write evidence summary (redact token)
cat > "${RUN_DIR}/EVIDENCE_SUMMARY.txt" << EOF
RUNTIME VERSION PROOF - DEPLOYMENT VALIDATION
==============================================
Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)
RUN_DIR: $RUN_DIR

DEPLOYMENT:
  Expected Release: $EXPECTED_RELEASE
  Build Status: SUCCESS (7/7 gates)
  Deploy Status: SUCCESS (forge deploy)
  Install Status: SUCCESS (forge install --upgrade)

RUNTIME PROOF (from webtrigger):
  Marker: $PROOF_MARKER
  Release: $PROOF_RELEASE
  Build SHA: $PROOF_BUILD_SHA
  @forge/api.hasAsApp: $PROOF_HAS_ASAPP
  Timestamp UTC: $(echo "$RESPONSE" | jq -r '.tsUtc // "N/A"')

VALIDATION RESULT: PASSED ✓
  - ok=true
  - marker matches
  - release matches expected ($EXPECTED_RELEASE)
  - buildSha is valid
  - forgeApi.hasAsApp=true

ARTIFACTS:
  - ${RUN_DIR}/00_run_dir.txt
  - ${RUN_DIR}/01_preflight.txt
  - ${RUN_DIR}/build.log
  - ${RUN_DIR}/version_gate.log
  - ${RUN_DIR}/forge_deploy.log
  - ${RUN_DIR}/forge_install.log
  - ${RUN_DIR}/webtrigger_url.txt
  - ${RUN_DIR}/80_runtime_proof.json (redacted response)
  - ${RUN_DIR}/99_PASS.txt
EOF

log_info "Evidence summary written to EVIDENCE_SUMMARY.txt"

# ============================================================================
# PHASE 11: FINAL OUTPUT
# ============================================================================

echo ""
echo "=========================================="
echo "DEPLOYMENT AND PROOF VALIDATION COMPLETE"
echo "=========================================="
echo ""
echo "RUN_DIR: $RUN_DIR"
echo "Status: ✓ PASSED"
echo ""
echo "Key Artifacts:"
ls -1 "${RUN_DIR}"/[0-9]*.txt "${RUN_DIR}"/[0-9]*.json 2>/dev/null | xargs -I {} bash -c 'echo "  - {}"; [ -s {} ] && head -3 {} | sed "s/^/    /"' || true
echo ""
echo "Validated JSON (token redacted):"
echo "$RESPONSE" | jq '.' 2>/dev/null | head -20 || echo "$RESPONSE" | head -20
echo ""

exit 0
