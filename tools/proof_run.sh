#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

RUN_DIR="/tmp/ft_proof_run_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN_DIR"

log="$RUN_DIR/00_proof_run.log"
exec > >(tee -a "$log") 2>&1

echo "=== FirstTry Proof Run ==="
echo "RUN_DIR=$RUN_DIR"
echo "PWD=$(pwd)"
echo "HEAD=$(git rev-parse HEAD 2>/dev/null || true)"

step() { echo; echo "=== STEP: $1 ==="; }
must() { step "$1"; shift; "$@"; }

# Scripts are required; placeholders must exit 2 (not success).
must "validate_docs" bash tools/validate_docs.sh
must "validate_docs_email_identity" bash tools/validate_docs_email_identity.sh
[ -f tools/style_scan.sh ] && must "style_scan" bash tools/style_scan.sh || echo "SKIP: tools/style_scan.sh missing"
[ -f tools/brand_scan.sh ] && must "brand_scan" bash tools/brand_scan.sh || echo "SKIP: tools/brand_scan.sh missing"
must "validate_manifest_scopes" bash tools/validate_manifest_scopes.sh
must "validate_no_egress" bash tools/validate_no_egress.sh
must "validate_readonly_guard" bash tools/validate_readonly_guard.sh
must "validate_tenant_isolation" bash tools/validate_tenant_isolation.sh

# Run forge-app tests if present
if [ -d atlassian/forge-app ]; then
  step "forge-app tests"
  (cd atlassian/forge-app && npm ci && npm test) | tee "$RUN_DIR/50_forge_tests.log"
fi

# Freeze lock determinism checks (optional but preferred)
if [ -f atlassian/forge-app/audit/freeze_generate.sh ] && [ -f atlassian/forge-app/audit/verify_freeze_lock.sh ]; then
  step "freeze lock generate+verify"
  (cd atlassian/forge-app && bash audit/freeze_generate.sh && bash audit/verify_freeze_lock.sh && bash audit/verify_freeze_lock.sh) \
    | tee "$RUN_DIR/60_freeze_lock.log"
fi

echo
echo "PASS: All proof steps completed."
