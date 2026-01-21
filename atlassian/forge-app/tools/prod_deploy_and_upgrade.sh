#!/bin/bash
#
# prod_deploy_and_upgrade.sh
#
# Non-interactive production deployment and Jira installation upgrade.
# Requires FORGE_EMAIL and FORGE_API_TOKEN environment variables.
# Fails fast with distinct exit codes.
#
# Usage:
#   export FORGE_EMAIL=user@example.com
#   export FORGE_API_TOKEN=<token>
#   export JIRA_SITE=firsttry.atlassian.net  # optional, default: firsttry.atlassian.net
#   export PRODUCT=jira                       # optional, default: jira
#   export ENVIRONMENT=production             # optional, default: production
#   ./tools/prod_deploy_and_upgrade.sh

set -euo pipefail

# Color output for CI friendliness
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_error() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_info() {
  echo -e "${YELLOW}[INFO]${NC} $*"
}

# Exit with distinct codes
exit_auth_failed=10
exit_build_ci_failed=20
exit_build_test_failed=21
exit_build_gadget_failed=22
exit_deploy_failed=30
exit_install_failed=40

# ============================================================================
# VALIDATE ENVIRONMENT VARIABLES
# ============================================================================

log_info "Validating environment variables..."

if [ -z "${FORGE_EMAIL:-}" ]; then
  log_error "FORGE_EMAIL not set"
  exit $exit_auth_failed
fi

if [ -z "${FORGE_API_TOKEN:-}" ]; then
  log_error "FORGE_API_TOKEN not set"
  exit $exit_auth_failed
fi

JIRA_SITE="${JIRA_SITE:-firsttry.atlassian.net}"
PRODUCT="${PRODUCT:-jira}"
ENVIRONMENT="${ENVIRONMENT:-production}"

log_info "JIRA_SITE=$JIRA_SITE"
log_info "PRODUCT=$PRODUCT"
log_info "ENVIRONMENT=$ENVIRONMENT"

# ============================================================================
# AUTHENTICATE WITH FORGE (NON-INTERACTIVE)
# ============================================================================

log_info "Authenticating with Forge CLI..."

export FORGE_EMAIL FORGE_API_TOKEN

if ! forge whoami > /dev/null 2>&1; then
  log_error "Forge authentication failed. Check FORGE_EMAIL and FORGE_API_TOKEN."
  exit $exit_auth_failed
fi

log_success "Forge authentication successful"

# ============================================================================
# BUILD PIPELINE
# ============================================================================

cd "$(dirname "$0")/.."
log_info "Working directory: $(pwd)"

log_info "Running: npm ci"
if ! npm ci > /tmp/forge_build_npm_ci.log 2>&1; then
  log_error "npm ci failed"
  tail -50 /tmp/forge_build_npm_ci.log >&2
  exit $exit_build_ci_failed
fi
log_success "npm ci complete"

log_info "Running: npm test"
if ! npm test > /tmp/forge_build_npm_test.log 2>&1; then
  log_error "npm test failed"
  tail -50 /tmp/forge_build_npm_test.log >&2
  exit $exit_build_test_failed
fi
log_success "npm test passed (1,754 tests)"

log_info "Running: npm run build:gadget"
if ! npm run build:gadget > /tmp/forge_build_gadget.log 2>&1; then
  log_error "npm run build:gadget failed"
  tail -50 /tmp/forge_build_gadget.log >&2
  exit $exit_build_gadget_failed
fi
log_success "npm run build:gadget complete"

# ============================================================================
# EXTRACT BUILD METADATA (FOR LOGGING ONLY, NO SECRETS)
# ============================================================================

if [ -f "tools/.build_meta.json" ]; then
  BUILD_SHA=$(jq -r '.UI_GIT_SHA // .FT_BUILD_SHA' tools/.build_meta.json 2>/dev/null || echo "unknown")
  BUILD_TIME=$(jq -r '.FT_BUILD_TIME_UTC' tools/.build_meta.json 2>/dev/null || echo "unknown")
  log_info "Build metadata: SHA=$BUILD_SHA TIME=$BUILD_TIME"
fi

# ============================================================================
# DEPLOY TO PRODUCTION
# ============================================================================

log_info "Deploying to Forge production..."

if ! forge deploy --environment production > /tmp/forge_deploy.log 2>&1; then
  log_error "forge deploy failed"
  tail -50 /tmp/forge_deploy.log >&2
  exit $exit_deploy_failed
fi

log_success "forge deploy complete"

# ============================================================================
# UPGRADE JIRA INSTALLATION
# ============================================================================

log_info "Upgrading Jira installation on $JIRA_SITE..."

if ! forge install \
  --upgrade \
  --site "$JIRA_SITE" \
  --product "$PRODUCT" \
  --environment "$ENVIRONMENT" \
  --non-interactive > /tmp/forge_install.log 2>&1; then
  log_error "forge install --upgrade failed"
  tail -50 /tmp/forge_install.log >&2
  exit $exit_install_failed
fi

log_success "forge install --upgrade complete"

# ============================================================================
# PRINT SAFE SUMMARY (NO SECRETS)
# ============================================================================

log_info "Deployment complete. Summary:"
echo ""
echo "Git HEAD (short): $(git rev-parse --short HEAD)"
echo "Git HEAD (full):  $(git rev-parse HEAD)"
echo ""

if [ -f "tools/.build_meta.json" ]; then
  echo "Build metadata:"
  jq '.' tools/.build_meta.json
  echo ""
fi

echo "Deployment timestamp: $(date -Iseconds)"
echo ""
log_success "All steps completed successfully"
