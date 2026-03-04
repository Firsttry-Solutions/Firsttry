#!/bin/bash
# Phase 11: CI Integrity Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_11_ci"

PHASE_DIR="$EVIDENCE_DIR/PHASE_11_ci"
mkdir -p "$PHASE_DIR"

info "Phase 11: CI Integrity"

WORKFLOWS_DIR="$REPO_ROOT/.github/workflows"
require_dir "$WORKFLOWS_DIR"

# List workflows
ls -la "$WORKFLOWS_DIR" > "$PHASE_DIR/workflows_list.txt" 2>&1

# Check for marketplace-readiness workflow
MARKETPLACE_WORKFLOW="$WORKFLOWS_DIR/marketplace-readiness.yml"
require_file "$MARKETPLACE_WORKFLOW"

cp "$MARKETPLACE_WORKFLOW" "$PHASE_DIR/marketplace_readiness_workflow.yml"
ok "Marketplace readiness workflow exists"

# Check for risky CI settings
echo "# CI Risky Settings Check" > "$PHASE_DIR/ci_risky_settings.txt"

find "$WORKFLOWS_DIR" -name "*.yml" -o -name "*.yaml" 2>/dev/null | while read -r workflow; do
  # Check for continue-on-error
  if grep -qE "continue-on-error:.*true" "$workflow"; then
    echo "WARNING: $workflow uses continue-on-error" >> "$PHASE_DIR/ci_risky_settings.txt"
  fi
  
  # Check for skip patterns on main
  if grep -qiE "(skip.*ci|ci.*skip)" "$workflow"; then
    echo "WARNING: $workflow may have CI skip patterns" >> "$PHASE_DIR/ci_risky_settings.txt"
  fi
done

if grep -q "WARNING" "$PHASE_DIR/ci_risky_settings.txt"; then
  warn "Found potential CI configuration issues (review required)"
else
  echo "No risky settings detected" >> "$PHASE_DIR/ci_risky_settings.txt"
  ok "No risky CI settings"
fi

# Verify marketplace workflow includes tests
if ! grep -qE "(npm.*test|npm.*build)" "$MARKETPLACE_WORKFLOW"; then
  die "Marketplace readiness workflow must include build/test steps"
fi
ok "Marketplace workflow includes build/test"

write_section "$REPORT_PATH" "Phase 11: CI Integrity - PASS"
echo "- Marketplace workflow: present" >> "$REPORT_PATH"
echo "- Build/test integration: verified" >> "$REPORT_PATH"
echo "- Risky settings: reviewed" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 11: CI Integrity - PASS"
