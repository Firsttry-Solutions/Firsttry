#!/usr/bin/env bash
set -euo pipefail

# ONE-COMMAND ENTRYPOINT: LIVE Jira Governance Evidence Collection
# Requirements: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN in environment
# This script enforces LIVE mode and fails hard if credentials are invalid

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ============================================================================
# STRICT PRECONDITION VALIDATION (FAIL-CLOSED)
# ============================================================================

# Check all three credentials are provided
if [[ -z "${JIRA_BASE_URL:-}" ]]; then
  echo "[FATAL] JIRA_BASE_URL not set"
  exit 2
fi

if [[ -z "${JIRA_EMAIL:-}" ]]; then
  echo "[FATAL] JIRA_EMAIL not set"
  exit 2
fi

if [[ -z "${JIRA_API_TOKEN:-}" ]]; then
  echo "[FATAL] JIRA_API_TOKEN not set"
  exit 2
fi

# Strict HTTPS validation for JIRA_BASE_URL
# Must be: https://something.atlassian.net (no http://, no trailing slash, no path)
if ! [[ "$JIRA_BASE_URL" =~ ^https://[a-z0-9][a-z0-9-]*[a-z0-9]\.atlassian\.net$ ]]; then
  echo "[FATAL] JIRA_BASE_URL must be like: https://your-domain.atlassian.net"
  echo "[FATAL] Received: $JIRA_BASE_URL"
  echo ""
  echo "Rules:"
  echo "  - Must start with https:// (not http://)"
  echo "  - Hostname must end with .atlassian.net"
  echo "  - No trailing slash"
  echo "  - No path component"
  echo "  - No whitespace"
  exit 2
fi

# Additional validation: no trailing slash
if [[ "$JIRA_BASE_URL" == */ ]]; then
  echo "[FATAL] JIRA_BASE_URL must not have trailing slash"
  echo "[FATAL] Received: $JIRA_BASE_URL"
  exit 2
fi

# Additional validation: no path component
if [[ "$JIRA_BASE_URL" =~ ^https://[^/]+/.*$ ]]; then
  echo "[FATAL] JIRA_BASE_URL must not contain path component"
  echo "[FATAL] Received: $JIRA_BASE_URL"
  exit 2
fi

# Export LIVE mode flag and credentials
export MODE="LIVE"
export JIRA_BASE_URL
export JIRA_EMAIL
export JIRA_API_TOKEN

echo "==============================================================="
echo "FirstTry LIVE Jira Governance Evidence Collection"
echo "==============================================================="
echo ""
echo "Mode: $MODE"
echo "Jira Instance: $JIRA_BASE_URL"
echo "User: $JIRA_EMAIL"
echo ""

# ============================================================================
# RUN MAIN HARNESS (ENFORCED LIVE MODE)
# ============================================================================

cd "$SCRIPT_DIR"
bash run_reviewer_demo.sh
HARNESS_EXIT_CODE=$?

# Get evidence root
LATEST_EVIDENCE=${EVIDENCE_ROOT:-/tmp/firsttry_reviewer_demo_LATEST}

# ============================================================================
# PHASE 3: POST-RUN ASSERTION (MUST NOT DOWNGRADE TO DEMO)
# ============================================================================

# Check that EFFECTIVE_MODE was not downgraded
if [[ -f "${LATEST_EVIDENCE}/00_meta/METADATA.json" ]]; then
  REPORTED_MODE=$(jq -r '.mode // "unknown"' "${LATEST_EVIDENCE}/00_meta/METADATA.json" 2>/dev/null || echo "unknown")
  if [[ "$REPORTED_MODE" != "LIVE" ]]; then
    echo ""
    echo "[FATAL] LIVE run incorrectly downgraded to $REPORTED_MODE"
    echo "[FATAL] This is a critical failure. MODE=LIVE must not silently fall back to DEMO."
    exit 1
  fi
fi

# ============================================================================
# DISPLAY RESULTS
# ============================================================================

echo ""
echo "==============================================================="
echo "EVIDENCE COLLECTION COMPLETE"
echo "==============================================================="
echo ""
echo "Evidence directory: $LATEST_EVIDENCE"
echo ""

# Show final verdict
if [[ -f "${LATEST_EVIDENCE}/FINAL_REVIEWER_VERDICT.txt" ]]; then
  echo "Final Verdict:"
  cat "${LATEST_EVIDENCE}/FINAL_REVIEWER_VERDICT.txt"
  echo ""
fi

# Show verifier report (pretty-printed)
if [[ -f "${LATEST_EVIDENCE}/VERIFIER_REPORT.json" ]]; then
  echo "Verifier Report:"
  jq . "${LATEST_EVIDENCE}/VERIFIER_REPORT.json" 2>/dev/null || cat "${LATEST_EVIDENCE}/VERIFIER_REPORT.json"
  echo ""
fi

# Show raw evidence summary
echo "LIVE Jira Raw Evidence Files:"
if [[ -d "${LATEST_EVIDENCE}/01_raw_api" ]]; then
  find "${LATEST_EVIDENCE}/01_raw_api" -maxdepth 1 -name "*.response.json" -type f | sort | while read -r f; do
    echo "  - $(basename "$f")"
  done
  echo ""
fi

echo "Evidence Summary:"
EVIDENCE_FILE_COUNT=$(find "${LATEST_EVIDENCE}" -type f \( -name "*.json" -o -name "*.sha256" \) | wc -l)
echo "  Total evidence files: $EVIDENCE_FILE_COUNT"
echo ""

# ============================================================================
# EXIT WITH HARNESS STATUS
# ============================================================================

exit $HARNESS_EXIT_CODE
