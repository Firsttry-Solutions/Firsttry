#!/bin/bash
set -euo pipefail

# ==============================================================================
# verify_no_repo_root_E_refs.sh
# ==============================================================================
# Purpose: Verify NO repo-root E/ evidence path references in production code/docs
# Design: Deterministic, non-noisy, excludes test files that intentionally contain
#         E/ patterns for regression testing
#
# LOCAL VERIFICATION COMMANDS (run from repo root):
# ===================================================
# 
# PASS RUN (should exit 0):
#   export FT_PROD_READY_E="/tmp/ft_test_E_$RANDOM"
#   mkdir -p "$FT_PROD_READY_E/13_repo_scans"
#   bash tools/production/verify_no_repo_root_E_refs.sh
#   cat "$FT_PROD_READY_E/13_repo_scans/no_repo_root_E_refs.verdict.txt"
#
# FAIL RUN (should exit 1):
#   export FT_PROD_READY_E="/tmp/ft_test_E_$RANDOM"
#   mkdir -p "$FT_PROD_READY_E/13_repo_scans"
#   # Inject hardcoded E/ path into a test doc
#   echo "Evidence: E/02_inventory/test.csv" >> docs/production/99_TEST_TEMP.md
#   bash tools/production/verify_no_repo_root_E_refs.sh
#   EXIT_CODE=$(cat "$FT_PROD_READY_E/13_repo_scans/no_repo_root_E_refs.exit_code.txt")
#   echo "Exit code: $EXIT_CODE"
#   # Cleanup
#   rm docs/production/99_TEST_TEMP.md
#
# ==============================================================================

# ==============================================================================
# Check for rg (ripgrep) prerequisite
# ==============================================================================
if ! command -v rg &> /dev/null; then
  echo "FATAL: ripgrep (rg) is required but not installed. Install via: apt install ripgrep" >&2
  exit 1
fi

# ==============================================================================
# Resolve evidence directory (fail-closed)
# ==============================================================================
E="${FT_PROD_READY_E:-}"
if [[ -z "$E" ]]; then
  echo "FAIL: FT_PROD_READY_E must be set to an evidence directory path" >&2
  exit 1
fi

if [[ ! -d "$E" ]]; then
  echo "FAIL: FT_PROD_READY_E directory does not exist: $E" >&2
  exit 1
fi

mkdir -p "$E/13_repo_scans"

# ==============================================================================
# Define evidence file paths
# ==============================================================================
MATCHES_FILE="$E/13_repo_scans/no_repo_root_E_refs.matches.txt"
VERDICT_FILE="$E/13_repo_scans/no_repo_root_E_refs.verdict.txt"
EXIT_CODE_FILE="$E/13_repo_scans/no_repo_root_E_refs.exit_code.txt"

# Initialize as FAIL by default (fail-closed)
echo "1" > "$EXIT_CODE_FILE"
: > "$MATCHES_FILE"

# ==============================================================================
# Gate A: Scan for absolute repo-root evidence paths
# ==============================================================================
echo "[NO_REPO_ROOT_E] GATE A: Scanning for absolute repo-root paths..."

GATE_A_VIOLATIONS=0

# Check for patterns like /workspaces/Firsttry/atlassian/forge-app/E or /workspaces/Firsttry/atlassian/forge-app/E/
# Exclude the verification script itself (which documents these patterns)
ABSOLUTE_HITS=$(rg '/workspaces/Firsttry/atlassian/forge-app/E[/]?' \
  docs/production/ tools/production/ \
  -g '!*verify_no_repo_root_E_refs*' \
  2>/dev/null || true)

if [[ -n "$ABSOLUTE_HITS" ]]; then
  GATE_A_VIOLATIONS=1
  {
    echo "[NO_REPO_ROOT_E] GATE A VIOLATION: Absolute repo-root paths detected"
    echo "Files with violations:"
    echo "$ABSOLUTE_HITS" | sed 's/^/  /'
    echo ""
  } | tee -a "$MATCHES_FILE"
fi

if [[ "$GATE_A_VIOLATIONS" -eq 0 ]]; then
  echo "[NO_REPO_ROOT_E] GATE A PASS: No absolute repo-root paths found" | tee -a "$MATCHES_FILE"
else
  echo "[NO_REPO_ROOT_E] GATE A FAIL: Absolute repo-root paths detected" | tee -a "$MATCHES_FILE"
fi

# ==============================================================================
# Gate B: Scan docs for hardcoded E/[0-9]{2}_ without $E prefix
# ==============================================================================
echo "[NO_REPO_ROOT_E] GATE B: Scanning docs/production for hardcoded E/ paths..."

GATE_B_VIOLATIONS=0

# Pattern: (^|[^$`])E/[0-9]{2}_
# This matches E/XX_ not preceded by $ or backtick (indicating env var or code block)
# We exclude test files: docs_evidence_paths_invariant
HARDCODED_HITS=$(rg '(^|[^$`])E/[0-9]{2}_' \
  docs/production/ \
  -g '!*docs_evidence_paths_invariant*' \
  2>/dev/null || true)

if [[ -n "$HARDCODED_HITS" ]]; then
  GATE_B_VIOLATIONS=1
  {
    echo "[NO_REPO_ROOT_E] GATE B VIOLATION: Hardcoded E/ paths found in docs (without $ prefix)"
    echo "$HARDCODED_HITS"
  } | tee -a "$MATCHES_FILE"
fi

if [[ "$GATE_B_VIOLATIONS" -eq 0 ]]; then
  echo "[NO_REPO_ROOT_E] GATE B PASS: No hardcoded E/ paths in docs (all use \$E notation)" | tee -a "$MATCHES_FILE"
else
  echo "[NO_REPO_ROOT_E] GATE B FAIL: Hardcoded E/ paths found in docs" | tee -a "$MATCHES_FILE"
fi

# ==============================================================================
# Gate C: Scan tools/production for problematic E/ references
# ==============================================================================
echo "[NO_REPO_ROOT_E] GATE C: Scanning tools/production for hardcoded E/..."

GATE_C_VIOLATIONS=0

# Pattern: (^|[^[:alnum:]_$])E/
# This matches E/ not preceded by alphanumeric, underscore, or $ (which allows $E/)
# We exclude test/invariant patterns and the verify script itself (which documents these patterns)
TOOLS_HITS=$(rg '(^|[^[:alnum:]_$`])E/' \
  tools/production/ \
  -g '!*enterprise_audit_invariants*' \
  -g '!*docs_evidence_paths_invariant*' \
  -g '!*verify_no_repo_root_E_refs*' \
  2>/dev/null || true)

# Filter out false positives: lines that are grep/rg patterns used for detection
# These are lines containing 'grep' or 'rg' commands where E/ is part of the regex pattern
FILTERED_TOOLS_HITS=$(echo "$TOOLS_HITS" | grep -v -E '(#|grep|rg).*(E/|E\\/)' || true)

if [[ -n "$FILTERED_TOOLS_HITS" ]]; then
  GATE_C_VIOLATIONS=1
  {
    echo "[NO_REPO_ROOT_E] GATE C VIOLATION: Hardcoded E/ in tools/production (excluding grep/rg patterns)"
    echo "$FILTERED_TOOLS_HITS"
  } | tee -a "$MATCHES_FILE"
fi

if [[ "$GATE_C_VIOLATIONS" -eq 0 ]]; then
  echo "[NO_REPO_ROOT_E] GATE C PASS: No problematic E/ references in tools/production" | tee -a "$MATCHES_FILE"
else
  echo "[NO_REPO_ROOT_E] GATE C FAIL: Hardcoded E/ references found in tools" | tee -a "$MATCHES_FILE"
fi

# ==============================================================================
# Finalization: Determine overall verdict
# ==============================================================================
TOTAL_VIOLATIONS=$((GATE_A_VIOLATIONS + GATE_B_VIOLATIONS + GATE_C_VIOLATIONS))

{
  echo ""
  echo "[NO_REPO_ROOT_E] Summary:"
  echo "  Gate A (absolute paths): $([ "$GATE_A_VIOLATIONS" -eq 0 ] && echo PASS || echo FAIL)"
  echo "  Gate B (hardcoded E/ in docs): $([ "$GATE_B_VIOLATIONS" -eq 0 ] && echo PASS || echo FAIL)"
  echo "  Gate C (hardcoded E/ in tools): $([ "$GATE_C_VIOLATIONS" -eq 0 ] && echo PASS || echo FAIL)"
  echo "  Total violations: $TOTAL_VIOLATIONS"
  echo ""
} | tee -a "$MATCHES_FILE"

if [[ "$TOTAL_VIOLATIONS" -eq 0 ]]; then
  echo "0" > "$EXIT_CODE_FILE"
  echo "PASS" > "$VERDICT_FILE"
  echo "[NO_REPO_ROOT_E] VERDICT: PASS - No repo-root E/ references detected" | tee -a "$MATCHES_FILE"
  exit 0
else
  echo "1" > "$EXIT_CODE_FILE"
  echo "FAIL" > "$VERDICT_FILE"
  echo "[NO_REPO_ROOT_E] VERDICT: FAIL - Violations detected" | tee -a "$MATCHES_FILE"
  exit 1
fi
