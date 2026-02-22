#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/Firsttry/atlassian/forge-app
EVIDENCE_DIR="/tmp/ft_proof_mode_$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$EVIDENCE_DIR"
echo "$EVIDENCE_DIR" | tee "$EVIDENCE_DIR/EVIDENCE_DIR.txt"

git status --porcelain | tee "$EVIDENCE_DIR/00_git_status.txt"
test -z "$(git status --porcelain)" || (echo "FAIL: dirty tree" | tee -a "$EVIDENCE_DIR/00_git_status.txt" && exit 1)

git rev-parse HEAD | tee "$EVIDENCE_DIR/04_head_sha.txt"
printf "%s\n" "backbone_fix_a_correlation_echoing.test.ts" "p4_bridge_diagnostics_panel.test.ts" | tee "$EVIDENCE_DIR/05_skips_allowlist.txt"

export FT_REQUIRE_CLEAN=1
export FT_PROOF_MODE=1

npm test 2>&1 | tee "$EVIDENCE_DIR/01_test_output.txt"

node tools/posttest_clean_gate.js 2>&1 | tee "$EVIDENCE_DIR/02_posttest_clean_gate.txt"

node tools/proof_no_skips_gate.js "$EVIDENCE_DIR/01_test_output.txt" 2>&1 | tee "$EVIDENCE_DIR/03_no_skips_gate.txt"

# Create checksum file for all evidence artifacts
( cd "$EVIDENCE_DIR" && ls -1 | sort | xargs -I{} sh -c 'test -f "{}" && sha256sum "{}"' ) \
  | tee "$EVIDENCE_DIR/06_evidence_sha256sums.txt"

echo "PASS: PROOF MODE"
echo "EVIDENCE_DIR=$EVIDENCE_DIR"
