#!/bin/bash
# Phase 09: Dependency Security Check
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/lib/00_common.sh"
PHASE_ID="PHASE_09_dependencies"

PHASE_DIR="$EVIDENCE_DIR/PHASE_09_deps"
mkdir -p "$PHASE_DIR"

info "Phase 09: Dependency Security"

cd "$REPO_ROOT/atlassian/forge-app"

# Run npm ci
info "Running npm ci..."
if ! npm ci --prefer-offline --no-audit > "$PHASE_DIR/npm_ci.log" 2>&1; then
  die "npm ci failed - see $PHASE_DIR/npm_ci.log"
fi
ok "npm ci completed"

# Run npm audit
info "Running npm audit..."
npm audit --omit=dev --json > "$PHASE_DIR/npm_audit.json" 2>&1 || true
npm audit --omit=dev > "$PHASE_DIR/npm_audit_summary.txt" 2>&1 || true

# Check for HIGH or CRITICAL vulnerabilities
if [ -f "$PHASE_DIR/npm_audit.json" ]; then
  # Count severity occurrences
  # Note: grep exits 1 when no matches, which pipefail would catch, so we disable it temporarily
  set +o pipefail
  HIGH_COUNT=$(grep -o '"severity":"high"' "$PHASE_DIR/npm_audit.json" 2>/dev/null | wc -l | tr -d ' ')
  CRITICAL_COUNT=$(grep -o '"severity":"critical"' "$PHASE_DIR/npm_audit.json" 2>/dev/null | wc -l | tr -d ' ')
  set -o pipefail
  
  # Default to 0 if empty
  HIGH_COUNT=${HIGH_COUNT:-0}
  CRITICAL_COUNT=${CRITICAL_COUNT:-0}
  
  TOTAL_SEVERE=$((HIGH_COUNT + CRITICAL_COUNT))
  
  if [ "$TOTAL_SEVERE" -gt 0 ]; then
    die "npm audit found $TOTAL_SEVERE HIGH or CRITICAL vulnerabilities (HIGH:$HIGH_COUNT, CRITICAL:$CRITICAL_COUNT)"
  fi
  ok "No HIGH or CRITICAL vulnerabilities"
fi

# List production dependencies
npm ls --production --depth=0 > "$PHASE_DIR/npm_ls_production.txt" 2>&1 || true

write_section "$REPORT_PATH" "Phase 09: Dependency Security - PASS"
echo "- npm ci: successful" >> "$REPORT_PATH"
echo "- Vulnerabilities: none (HIGH/CRITICAL)" >> "$REPORT_PATH"
echo "- Production dependencies: captured" >> "$REPORT_PATH"
echo "- Evidence: \`$PHASE_DIR\`" >> "$REPORT_PATH"

ok "Phase 09: Dependency Security - PASS"
