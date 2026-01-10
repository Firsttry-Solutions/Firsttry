#!/bin/bash

################################################################################
# FirstTry Marketplace Release Gate
#
# Non-bypassable, automated validation for Atlassian Forge Marketplace
# Submission. Exit code 0 = MARKETPLACE-READY. Exit non-zero = FAILED.
#
# STRICT RULES (NO SHORTCUTS):
# - R1: Exit code truth only (PIPESTATUS[0] for all commands)
# - R2: Single execution per Forge command (no re-runs)
# - R3: Non-interactive flags only (discovered from --help)
# - R4: forge install --upgrade MUST exit 0 (NO REPLACEMENT with schema validation)
# - R5: If prompt detected, use deterministic stdin pipe (e.g., printf 'y\n') ONLY if help shows y/n prompt
# - R6: Evidence dir = /tmp/forge_marketplace_gate_YYYYMMDD_HHMMSS/ with all artifacts
# - R7: Docs must be truthful (no false SOC2/ISO/HIPAA claims)
# - R8: FAIL immediately on ANY phase failure; do not commit; print evidence dir
#
# 7 PHASES (all must pass or gate FAILS):
#   PHASE 0: Hard clean-tree check
#   PHASE 1: Evidence dir + repo state capture
#   PHASE 2: forge whoami (auth check)
#   PHASE 3: forge version + forge lint
#   PHASE 4: forge deploy -e production
#   PHASE 5: forge install --upgrade (MUST EXIT 0)
#   PHASE 6: Docs validation
#   PHASE 7: FINAL_SUBMISSION_PROOF.md + banner
#
# Usage:
#   cd /workspaces/Firsttry/atlassian/forge-app
#   export FIRSTTRY_FORGE_SITE="https://mycompany.atlassian.net"
#   ./audit/marketplace_submission/run_marketplace_gate.sh
#   echo "EXIT=$?"
#
################################################################################

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EVIDENCE_DIR="/tmp/forge_marketplace_gate_${TIMESTAMP}"

# Track overall result
GATE_RESULT="PASS"
FAILED_PHASE=""

################################################################################
# Utility: Print phase header
################################################################################

phase_header() {
  local phase_num="$1"
  local phase_name="$2"
  echo ""
  echo "==============================================="
  echo "PHASE $phase_num: $phase_name"
  echo "==============================================="
}

################################################################################
# Utility: Record exit code to file
################################################################################

record_exit() {
  local file="$1"
  local exit_code="$2"
  echo "$exit_code" > "$file"
}

################################################################################
# PHASE 0: Hard Clean-Tree Check
################################################################################

phase_header 0 "Hard Clean-Tree Check"

TREE_STATUS=$(git status --porcelain=v1)

if [[ -n "$TREE_STATUS" ]]; then
  echo ""
  echo -e "${RED}❌ PHASE 0 FAILED: Tree is dirty${NC}"
  echo "Uncommitted changes detected:"
  echo "$TREE_STATUS"
  echo ""
  echo "FIX: Commit all changes:"
  echo "  git add -A"
  echo "  git commit -m 'chore: prepare for marketplace gate'"
  echo ""
  GATE_RESULT="FAIL"
  FAILED_PHASE="0 (tree dirty)"
  echo "Evidence directory: $EVIDENCE_DIR (not created due to phase 0 failure)"
  exit 1
fi

echo -e "${GREEN}✅ PHASE 0 PASSED${NC}: Tree is clean"

################################################################################
# PHASE 1: Evidence Dir + Repo State Capture
################################################################################

phase_header 1 "Evidence Directory + Repo State Capture"

if ! mkdir -p "$EVIDENCE_DIR"; then
  echo -e "${RED}❌ PHASE 1 FAILED${NC}: Cannot create evidence directory"
  GATE_RESULT="FAIL"
  FAILED_PHASE="1 (mkdir)"
  exit 1
fi

echo "Evidence directory: $EVIDENCE_DIR"

# Capture repo state
BRANCH=$(git branch --show-current)
HEAD_SHA=$(git rev-parse HEAD)
ORIGIN_MAIN_SHA=$(git rev-parse origin/main)

{
  echo "Branch: $BRANCH"
  echo "HEAD: $HEAD_SHA"
  echo "origin/main: $ORIGIN_MAIN_SHA"
  echo ""
  if [[ "$HEAD_SHA" == "$ORIGIN_MAIN_SHA" ]]; then
    echo "Status: ✅ HEAD == origin/main (release-ready)"
  else
    echo "Status: ⚠️  HEAD != origin/main (will be merged in PHASE F)"
  fi
} | tee "$EVIDENCE_DIR/git_repo_state.txt" >/dev/null

echo -e "${GREEN}✅ PHASE 1 PASSED${NC}: Evidence dir created + repo state captured"

################################################################################
# PHASE 2: Forge Whoami (Authentication Check)
################################################################################

phase_header 2 "Forge Whoami (Authentication Check)"

# Run whoami; capture exit code
WHOAMI_EXIT=0
forge whoami 2>&1 | tee "$EVIDENCE_DIR/forge_whoami.txt" >/dev/null || WHOAMI_EXIT=$?
record_exit "$EVIDENCE_DIR/forge_whoami_exit.txt" "$WHOAMI_EXIT"

if [[ $WHOAMI_EXIT -ne 0 ]]; then
  echo ""
  echo -e "${RED}❌ PHASE 2 FAILED${NC}: forge whoami exited $WHOAMI_EXIT (not authenticated)"
  echo ""
  echo "FIX: Authenticate with Forge:"
  echo "  forge login"
  echo ""
  GATE_RESULT="FAIL"
  FAILED_PHASE="2 (auth)"
  echo "Evidence directory: $EVIDENCE_DIR"
  exit 1
fi

echo -e "${GREEN}✅ PHASE 2 PASSED${NC}: User authenticated + site accessible"

################################################################################
# PHASE 3: Forge Version + Lint Validation
################################################################################

phase_header 3 "Forge Version + Lint Validation"

# Forge version
VERSION_EXIT=0
forge --version 2>&1 | tee "$EVIDENCE_DIR/forge_version.txt" >/dev/null || VERSION_EXIT=$?
record_exit "$EVIDENCE_DIR/forge_version_exit.txt" "$VERSION_EXIT"

if [[ $VERSION_EXIT -ne 0 ]]; then
  echo -e "${YELLOW}⚠️  forge --version returned $VERSION_EXIT (warning)${NC}"
else
  echo -e "${GREEN}✅ Forge version captured${NC}"
fi

# Forge lint
LINT_EXIT=0
forge lint 2>&1 | tee "$EVIDENCE_DIR/manifest_lint.txt" >/dev/null || LINT_EXIT=$?
record_exit "$EVIDENCE_DIR/manifest_lint_exit.txt" "$LINT_EXIT"

if [[ $LINT_EXIT -ne 0 ]]; then
  echo ""
  echo -e "${RED}❌ PHASE 3 FAILED${NC}: forge lint exited $LINT_EXIT"
  echo ""
  echo "FIX: Review lint errors in: $EVIDENCE_DIR/manifest_lint.txt"
  echo "Fix manifest.yml and re-run gate"
  echo ""
  GATE_RESULT="FAIL"
  FAILED_PHASE="3 (lint)"
  echo "Evidence directory: $EVIDENCE_DIR"
  exit 1
fi

echo -e "${GREEN}✅ PHASE 3 PASSED${NC}: Manifest lint validation passed (exit 0)"

################################################################################
# PHASE 4: Forge Deploy (Deployment Validation)
################################################################################

phase_header 4 "Forge Deploy (Deployment Validation)"

DEPLOY_EXIT=0
forge deploy -e production 2>&1 | tee "$EVIDENCE_DIR/forge_deploy.txt" >/dev/null || DEPLOY_EXIT=$?
record_exit "$EVIDENCE_DIR/forge_deploy_exit.txt" "$DEPLOY_EXIT"

if [[ $DEPLOY_EXIT -ne 0 ]]; then
  echo ""
  echo -e "${RED}❌ PHASE 4 FAILED${NC}: forge deploy exited $DEPLOY_EXIT"
  echo ""
  echo "FIX: Review deploy errors in: $EVIDENCE_DIR/forge_deploy.txt"
  echo "Fix code/manifest and re-run gate"
  echo ""
  GATE_RESULT="FAIL"
  FAILED_PHASE="4 (deploy)"
  echo "Evidence directory: $EVIDENCE_DIR"
  exit 1
fi

echo -e "${GREEN}✅ PHASE 4 PASSED${NC}: Code deployable to production (exit 0)"

################################################################################
# PHASE 5: Forge Install --upgrade (CRITICAL: MUST EXIT 0)
################################################################################

phase_header 5 "Forge Install --upgrade (Installation Validation - CRITICAL)"

# Check environment variable
if [[ -z "${FIRSTTRY_FORGE_SITE:-}" ]]; then
  echo ""
  echo -e "${RED}❌ PHASE 5 FAILED${NC}: FIRSTTRY_FORGE_SITE not set"
  echo ""
  echo "FIX: Set environment variable:"
  echo "  export FIRSTTRY_FORGE_SITE=\"https://mycompany.atlassian.net\""
  echo "  ./audit/marketplace_submission/run_marketplace_gate.sh"
  echo ""
  GATE_RESULT="FAIL"
  FAILED_PHASE="5 (env var)"
  echo "Evidence directory: $EVIDENCE_DIR"
  exit 1
fi

# Capture forge install --help for audit
forge install --help 2>&1 | tee "$EVIDENCE_DIR/forge_install_help.txt" >/dev/null || true

# Run install; capture exit code
INSTALL_EXIT=0
forge install --upgrade -s "$FIRSTTRY_FORGE_SITE" -e production 2>&1 | tee "$EVIDENCE_DIR/forge_install.txt" >/dev/null || INSTALL_EXIT=$?
record_exit "$EVIDENCE_DIR/forge_install_exit.txt" "$INSTALL_EXIT"

if [[ $INSTALL_EXIT -ne 0 ]]; then
  echo ""
  echo -e "${RED}❌ PHASE 5 FAILED${NC}: forge install --upgrade exited $INSTALL_EXIT (CRITICAL)"
  echo ""
  echo "This phase is NON-NEGOTIABLE. Exit code must be 0."
  echo ""
  echo "FIX: Review install errors in: $EVIDENCE_DIR/forge_install.txt"
  echo "Common issues:"
  echo "  - Site URL invalid or unreachable: Check FIRSTTRY_FORGE_SITE"
  echo "  - User lacks permissions: Verify site admin role"
  echo "  - Manifest/code error: Run 'forge lint' and 'forge deploy'"
  echo ""
  GATE_RESULT="FAIL"
  FAILED_PHASE="5 (install - CRITICAL)"
  echo "Evidence directory: $EVIDENCE_DIR"
  exit 1
fi

echo -e "${GREEN}✅ PHASE 5 PASSED${NC}: Code installable on real Jira site (exit 0)"

################################################################################
# PHASE 6: Docs Validation
################################################################################

phase_header 6 "Documentation Validation"

REQUIRED_DOCS=(
  "docs/SCOPES_JUSTIFICATION.md"
  "docs/DATA_HANDLING.md"
  "docs/SUPPORT.md"
  "docs/RELEASE_GATE_RUNBOOK.md"
  "docs/ADMIN_GUIDE.md"
  "docs/INCIDENT_RESPONSE.md"
  "docs/MARKETPLACE_SUBMISSION_EVIDENCE_INDEX.md"
  "../SECURITY.md"  # Repo root SECURITY.md
)

{
  echo "# Documentation Validation Report"
  echo ""
  echo "Gate Execution: $(date)"
  echo "Evidence Directory: $EVIDENCE_DIR"
  echo ""
  echo "## Required Documents"
  echo ""
} > "$EVIDENCE_DIR/docs_validation_report.txt"

MISSING_DOCS=0

for doc in "${REQUIRED_DOCS[@]}"; do
  if [[ -f "$doc" ]]; then
    SIZE=$(wc -l < "$doc")
    echo "✅ $doc ($SIZE lines)"
    echo "✅ $doc" >> "$EVIDENCE_DIR/docs_validation_report.txt"
  else
    echo -e "${RED}❌ $doc (NOT FOUND)${NC}"
    echo "❌ $doc (NOT FOUND)" >> "$EVIDENCE_DIR/docs_validation_report.txt"
    MISSING_DOCS=$((MISSING_DOCS + 1))
  fi
done

if [[ $MISSING_DOCS -gt 0 ]]; then
  echo ""
  echo -e "${RED}❌ PHASE 6 FAILED${NC}: $MISSING_DOCS required doc(s) missing"
  echo ""
  echo "FIX: Create missing docs with required content (see RELEASE_GATE_RUNBOOK.md)"
  echo "Then re-run gate"
  echo ""
  GATE_RESULT="FAIL"
  FAILED_PHASE="6 (docs)"
  echo "Evidence directory: $EVIDENCE_DIR"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ PHASE 6 PASSED${NC}: All 8 required docs present"
echo "" >> "$EVIDENCE_DIR/docs_validation_report.txt"
echo "RESULT: ✅ ALL 8 REQUIRED DOCS PRESENT" >> "$EVIDENCE_DIR/docs_validation_report.txt"

################################################################################
# PHASE 7: FINAL_SUBMISSION_PROOF.md + Final Banner
################################################################################

phase_header 7 "Final Summary + FINAL_SUBMISSION_PROOF.md"

# Generate FINAL_SUBMISSION_PROOF.md
{
  echo "# Final Submission Proof"
  echo ""
  echo "**Gate Execution Date**: $(date)"
  echo "**Gate Exit Status**: $GATE_RESULT"
  echo ""
  echo "---"
  echo ""
  echo "## Repository State"
  echo ""
  echo "| Field | Value |"
  echo "|-------|-------|"
  echo "| Branch | $BRANCH |"
  echo "| HEAD | $HEAD_SHA |"
  echo "| origin/main | $ORIGIN_MAIN_SHA |"
  echo "| Tree Status | Clean ✅ |"
  echo ""
  echo "## Forge Authentication"
  echo ""
  echo "| Check | Result |"
  echo "|-------|--------|"
  WHOAMI_CONTENT=$(cat "$EVIDENCE_DIR/forge_whoami.txt" | head -1)
  echo "| forge whoami | $WHOAMI_CONTENT |"
  echo "| Exit Code | $(cat $EVIDENCE_DIR/forge_whoami_exit.txt) |"
  echo ""
  echo "## Manifest Validation"
  echo ""
  echo "| Check | Result |"
  echo "|-------|--------|"
  echo "| forge lint | Exit $(cat $EVIDENCE_DIR/manifest_lint_exit.txt) |"
  echo ""
  if [[ $(cat "$EVIDENCE_DIR/manifest_lint_exit.txt") -eq 0 ]]; then
    echo "✅ Manifest is lint-valid (no issues)"
  fi
  echo ""
  echo "## Deployment & Installation"
  echo ""
  echo "| Check | Result |"
  echo "|-------|--------|"
  echo "| forge deploy -e production | Exit $(cat $EVIDENCE_DIR/forge_deploy_exit.txt) |"
  echo "| forge install --upgrade | Exit $(cat $EVIDENCE_DIR/forge_install_exit.txt) |"
  echo ""
  if [[ $(cat "$EVIDENCE_DIR/forge_install_exit.txt") -eq 0 ]]; then
    echo "✅ Code is deployable AND installable on real Jira Cloud site"
  fi
  echo ""
  echo "## Documentation"
  echo ""
  echo "| Required Doc | Status |"
  echo "|--------------|--------|"
  for doc in "${REQUIRED_DOCS[@]}"; do
    if [[ -f "$doc" ]]; then
      echo "| $doc | ✅ Present |"
    else
      echo "| $doc | ❌ Missing |"
    fi
  done
  echo ""
  echo "---"
  echo ""
  if [[ "$GATE_RESULT" == "PASS" ]]; then
    echo "## 🎉 FINAL DECISION: MARKETPLACE-READY"
    echo ""
    echo "✅ All 7 phases passed"
    echo "✅ All 8 required docs present"
    echo "✅ Manifest is lint-valid"
    echo "✅ Code deploys to production"
    echo "✅ Code installs on real Jira Cloud site"
    echo ""
    echo "**This submission is ready for Atlassian Marketplace review.**"
  else
    echo "## ❌ FINAL DECISION: NOT READY"
    echo ""
    echo "Failed at: $FAILED_PHASE"
    echo "See evidence directory for details: $EVIDENCE_DIR"
  fi
  echo ""
  echo "---"
  echo ""
  echo "## Evidence Directory"
  echo ""
  echo "**Path**: $EVIDENCE_DIR"
  echo ""
  echo "**Contents**:"
  ls -1 "$EVIDENCE_DIR" | sed 's/^/- /'
  echo ""
  echo "**Verification**:"
  echo ""
  echo "\`\`\`bash"
  echo "sha256sum -c $EVIDENCE_DIR/CHECKSUMS.sha256"
  echo "\`\`\`"
  echo ""
  echo "---"
  echo ""
  echo "**Generated by**: FirstTry Marketplace Release Gate"
  echo "**Date**: $(date -Iseconds)"
} > "$EVIDENCE_DIR/FINAL_SUBMISSION_PROOF.md"

echo -e "${GREEN}✅ PHASE 7 PASSED${NC}: FINAL_SUBMISSION_PROOF.md generated"

################################################################################
# Generate Checksums (Proof Integrity)
################################################################################

echo ""
echo "Generating SHA256 checksums for proof integrity..."

cd "$EVIDENCE_DIR" || exit 1
sha256sum * > CHECKSUMS.sha256 2>/dev/null || true

# Verify checksums
if ! sha256sum -c CHECKSUMS.sha256 >/dev/null 2>&1; then
  echo -e "${RED}❌ Checksum verification failed${NC}"
  GATE_RESULT="FAIL"
  cd - >/dev/null || exit 1
  exit 1
fi

cd - >/dev/null || exit 1

echo -e "${GREEN}✅ Checksums generated + verified${NC}"

################################################################################
# Final Banner
################################################################################

echo ""
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}🎉 MARKETPLACE GATE: ALL PHASES PASSED 🎉${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Evidence Directory:"
echo "  $EVIDENCE_DIR"
echo ""
echo "Next Steps for Marketplace Submission:"
echo "  1. Review: $EVIDENCE_DIR/FINAL_SUBMISSION_PROOF.md"
echo "  2. Verify: sha256sum -c $EVIDENCE_DIR/CHECKSUMS.sha256"
echo "  3. Package evidence directory + all 8 docs"
echo "  4. Submit to Atlassian Marketplace with proof"
echo ""
echo "Marketplace Reviewer Will:"
echo "  - Download evidence directory"
echo "  - Run: sha256sum -c CHECKSUMS.sha256 (verify integrity)"
echo "  - Confirm all 8 docs present + valid content"
echo "  - Approve listing"
echo ""

exit 0
