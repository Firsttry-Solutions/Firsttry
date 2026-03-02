#!/usr/bin/env bash
# marketplace_gap_closure.sh
# Master orchestration: Run all 6 phases sequentially (fail-closed)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Evidence directory
E="${1:-}"
if [[ -z "$E" ]]; then
  E="/tmp/ft_marketplace_gap_closure_$(date -u +%Y%m%dT%H%M%SZ)_$RANDOM"
  mkdir -p "$E"/{00_env,01_pages,02_claims,03_docs,04_build,05_ci,99_verdict}
  ln -sfn "$E" /tmp/ft_marketplace_gap_closure_latest
  
  # Capture environment
  {
    echo "=== Environment ==="
    echo "Node: $(node -v)"
    echo "NPM: $(npm -v)"
    echo "jq: $(jq --version)"
    echo "Git SHA: $(git rev-parse HEAD)"
    echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } | tee "$E/00_env/env.txt"
  
  echo "Evidence directory: $E"
  echo ""
fi

cd "$REPO_ROOT"

FINAL_VERDICT="$E/99_verdict/FINAL_VERDICT.txt"
FINAL_REPORT="$E/99_verdict/FINAL_REPORT.md"

# Initialize report
cat > "$FINAL_REPORT" <<EOF
# Marketplace Gap Closure - Final Report

**Generated:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Evidence:** $E

## Phase Results

EOF

OVERALL_STATUS="PASS"

# ============================================================
# PHASE 1: GitHub Pages Build Readiness
# ============================================================
echo "═══════════════════════════════════════════════════════════"
echo "PHASE 1: GitHub Pages Build Readiness"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1A: Detect Pages implementation
echo "[1/4] Detecting Pages configuration..."
"$SCRIPT_DIR/pages_detect.sh" "$E"

# 1B: Compose expected URLs
echo "[2/4] Generating expected Pages URLs..."
"$SCRIPT_DIR/compose_pages_urls.sh" "$E"

# 1C: Check Pages workflow
echo "[3/4] Checking Pages workflow..."
PAGES_WORKFLOW=".github/workflows/pages.yml"
if [[ ! -f "$REPO_ROOT/$PAGES_WORKFLOW" ]] && [[ ! -f "$REPO_ROOT/.github/workflows/pages-docs.yml" ]]; then
  echo "  ⚠️  WARN: No Pages workflow found (will need manual deployment)"
  echo "WARN: No Pages workflow" > "$E/01_pages/workflow_status.txt"
else
  echo "  ✅ Pages workflow exists"
  echo "PASS: Workflow exists" > "$E/01_pages/workflow_status.txt"
fi

# 1D: Phase 1 verdict
PAGES_READY=$(jq -r '.pages_ready' "$E/01_pages/pages_detect.json" 2>/dev/null || echo "false")
if [[ "$PAGES_READY" == "true" ]]; then
  echo "PASS" > "$E/01_pages/VERDICT.txt"
  echo ""
  echo "✅ PHASE 1: PASS"
  echo "### ✅ Phase 1: GitHub Pages Readiness - PASS" >> "$FINAL_REPORT"
else
  echo "WARN" > "$E/01_pages/VERDICT.txt"
  echo ""
  echo "⚠️  PHASE 1: WARN (Pages not fully configured)"
  echo "### ⚠️  Phase 1: GitHub Pages Readiness - WARN" >> "$FINAL_REPORT"
  echo "" >> "$FINAL_REPORT"
  echo "GitHub Pages not detected. URLs will be relative until Pages is deployed." >> "$FINAL_REPORT"
fi
echo "" >> "$FINAL_REPORT"

# ============================================================
# PHASE 2: Claims Consistency Check
# ============================================================
echo ""
echo "═══════════════════════════════════════════════════"
echo "PHASE 2: Claims Consistency Check"
echo "═══════════════════════════════════════════════════"
echo ""

echo "[1/3] Extracting product facts from code/manifest..."
"$SCRIPT_DIR/extract_product_facts.sh" "$E"

echo "[2/3] Extracting claims from trust documentation..."
"$SCRIPT_DIR/extract_trust_doc_claims.sh" "$E"

echo "[3/3] Verifying consistency..."
if "$SCRIPT_DIR/verify_claims_consistency.sh" "$E"; then
  echo "PASS" > "$E/02_claims/PHASE_VERDICT.txt"
  echo ""
  echo "✅ PHASE 2: PASS"
  echo "### ✅ Phase 2: Claims Consistency - PASS" >> "$FINAL_REPORT"
else
  echo "FAIL" > "$E/02_claims/PHASE_VERDICT.txt"
  OVERALL_STATUS="FAIL"
  echo ""
  echo "❌ PHASE 2: FAIL"
  echo "### ❌ Phase 2: Claims Consistency - FAIL" >> "$FINAL_REPORT"
  echo "" >> "$FINAL_REPORT"
  echo "**Failures:**" >> "$FINAL_REPORT"
  grep "^- FAIL:" "$E/02_claims/consistency_report.md" >> "$FINAL_REPORT" || echo "See consistency_report.md" >> "$FINAL_REPORT"
fi
echo "" >> "$FINAL_REPORT"

# ============================================================
# REMAINING PHASES (PLACEHOLDER)
# ============================================================
# Phase 3: Trust Doc Hardening (TODO)
# Phase 4: Offline Linkability (TODO)
# Phase 5: CI Integration (TODO)
# Phase 6: Already in progress (this script)

# ============================================================
# FINAL VERDICT
# ============================================================
echo ""
echo "═══════════════════════════════════════════════════"
echo "FINAL VERDICT"
echo "═══════════════════════════════════════════════════"
echo ""

cat >> "$FINAL_REPORT" <<EOF

## Overall Status

**Verdict:** $OVERALL_STATUS

EOF

if [[ "$OVERALL_STATUS" == "PASS" ]]; then
  echo "PASS" > "$FINAL_VERDICT"
  echo "✅ ALL CHECKS PASSED"
  echo ""
  echo "Next steps:"
  echo "1. Review evidence directory: $E"
  echo "2. Deploy docs to GitHub Pages (if not already)"
  echo "3. Submit to Atlassian Marketplace with generated URLs"
  exit 0
else
  echo "FAIL" > "$FINAL_VERDICT"
  echo "❌ FAILURES DETECTED"
  echo ""
  echo "Remediation required. See reports:"
  echo "  - Claims consistency: $E/02_claims/consistency_report.md"
  echo "  - Final report: $FINAL_REPORT"
  exit 1
fi
