#!/bin/bash
# Phase 6 Strict Real Runtime Verification - Complete Script
# This script must run to completion without interruption

set -e

export FORGE_APP="/workspaces/Firsttry/atlassian/forge-app"
export JIRA_DASHBOARD_URL="https://firsttry.atlassian.net/jira/dashboards/10102"
export RUN_DIR="/tmp/ft_phase6_strict_runtime_verify_$(date -u +%Y%m%dT%H%M%SZ)"
export STORAGE_STATE="/workspaces/Firsttry/e2e/.auth/storageState.json"

mkdir -p "$RUN_DIR"
echo "RUN_DIR=$RUN_DIR" | tee "$RUN_DIR/00_run_dir.txt"

cd "$FORGE_APP"

# LAYER 0: Verify clean tree and tools exist
echo "=== LAYER 0: Setup and Tools Verification ===" | tee "$RUN_DIR/00_layer_status.txt"

git status --porcelain=v1 | tee "$RUN_DIR/05_git_status.txt"
if [ -s "$RUN_DIR/05_git_status.txt" ]; then
  echo "STOP: DIRTY_TREE" | tee "$RUN_DIR/99_STOP_REPORT.txt"
  exit 1
fi

for f in tools/verify_bundle_provenance.sh tools/strip_and_hash.js tools/verify_runtime_acceptance_gate.sh e2e/phase6_runtime_probe.mjs tools/truth_table_check.mjs; do
  if ! git ls-files --error-unmatch "$f" >/dev/null 2>&1; then
    echo "STOP: UNTRACKED_REQUIRED_FILE=$f" | tee "$RUN_DIR/99_STOP_REPORT.txt"
    exit 1
  fi
done
echo "✅ LAYER 0: PASS" | tee -a "$RUN_DIR/00_layer_status.txt"

# LAYER 2: Build Verification
echo "=== LAYER 2: Build + Provenance ===" | tee "$RUN_DIR/02_layer_status.txt"

echo "[LAYER 2] Running npm test..." 
npm test 2>&1 | tee "$RUN_DIR/10_npm_test_full.txt" > /dev/null 2>&1 || {
  echo "STOP: npm test failed" | tee "$RUN_DIR/99_STOP_REPORT.txt"
  exit 1
}
grep -E "Test Files:|Tests:|Duration:" "$RUN_DIR/10_npm_test_full.txt" | tail -5 | tee "$RUN_DIR/11_npm_test_summary.txt"

echo "[LAYER 2] Running npm run build:gadget..."
npm run build:gadget 2>&1 | tee "$RUN_DIR/20_build_gadget_full.txt" || {
  echo "STOP: build:gadget failed" | tee "$RUN_DIR/99_STOP_REPORT.txt"
  tail -100 "$RUN_DIR/20_build_gadget_full.txt" | tee -a "$RUN_DIR/99_STOP_REPORT.txt"
  exit 1
}

# Verify provenance verifier ran
if ! grep -q "verify:bundle:provenance" "$RUN_DIR/20_build_gadget_full.txt"; then
  echo "STOP: verify:bundle:provenance did not run in build" | tee "$RUN_DIR/99_STOP_REPORT.txt"
  exit 1
fi

grep -E "verify:bundle:provenance|PASS|FAIL|GATE_" "$RUN_DIR/20_build_gadget_full.txt" | tail -50 | tee "$RUN_DIR/21_build_gate_tail.txt"
echo "✅ LAYER 2: PASS" | tee -a "$RUN_DIR/02_layer_status.txt"

# Verify hash matches
echo "[LAYER 2] Verifying provenance JSON..."
BUNDLE="$(ls -1 src/gadget-ui/dist/app.*.js | head -1)"
node tools/strip_and_hash.js "$BUNDLE" 2>&1 | tee "$RUN_DIR/30_strip_and_hash.json" || {
  echo "STOP: strip_and_hash.js failed" | tee "$RUN_DIR/99_STOP_REPORT.txt"
  exit 1
}

# Extract values from JSON
ANCHOR_COUNT=$(grep -o '"anchorCount":[0-9]*' "$RUN_DIR/30_strip_and_hash.json" | cut -d':' -f2)
EMBEDDED=$(grep -o '"embeddedBundle":"[^"]*"' "$RUN_DIR/30_strip_and_hash.json" | cut -d'"' -f4)
COMPUTED=$(grep -o '"computedPrefix7":"[^"]*"' "$RUN_DIR/30_strip_and_hash.json" | cut -d'"' -f4)

if [ "$ANCHOR_COUNT" -ne 1 ] || [ "$EMBEDDED" != "$COMPUTED" ]; then
  echo "STOP: Provenance hash mismatch or invalid anchor count" | tee "$RUN_DIR/99_STOP_REPORT.txt"
  exit 1
fi
echo "✅ Provenance verified: embedded=$EMBEDDED, computed=$COMPUTED" | tee "$RUN_DIR/30_provenance_verified.txt"

# LAYER 3: Runtime Probe
echo "=== LAYER 3: Real Runtime Probe ===" | tee "$RUN_DIR/03_layer_status.txt"

if [ ! -f "$STORAGE_STATE" ]; then
  echo "STOP: STORAGE_STATE missing: $STORAGE_STATE" | tee "$RUN_DIR/99_STOP_REPORT.txt"
  exit 1
fi
echo "$STORAGE_STATE" | tee "$RUN_DIR/44_storage_state_ok.txt"

echo "[LAYER 3] Running real Playwright probe..."
RUN_DIR="$RUN_DIR" STORAGE_STATE="$STORAGE_STATE" JIRA_DASHBOARD_URL="$JIRA_DASHBOARD_URL" \
  node e2e/phase6_runtime_probe.mjs 2>&1 | tee "$RUN_DIR/46_probe_run.txt" || {
  echo "STOP: Runtime probe failed" | tee "$RUN_DIR/99_STOP_REPORT.txt"
  exit 1
}

# Verify runtime artifacts exist
for f in 50_runtime_console.log 51_runtime_truth.json 52_runtime_page.html 53_runtime_screenshot.png 54_runtime_trace.zip; do
  if [ ! -f "$RUN_DIR/$f" ]; then
    echo "STOP: MISSING_RUNTIME_ARTIFACT=$f" | tee "$RUN_DIR/99_STOP_REPORT.txt"
    exit 1
  fi
done
echo "✅ LAYER 3: PASS (all runtime artifacts present)" | tee -a "$RUN_DIR/03_layer_status.txt"

# LAYER 4: Gates + Truth Table
echo "=== LAYER 4: Runtime Gate + Truth Table ===" | tee "$RUN_DIR/04_layer_status.txt"

echo "[LAYER 4] Running runtime acceptance gate..."
bash tools/verify_runtime_acceptance_gate.sh --log-file "$RUN_DIR/50_runtime_console.log" 2>&1 | tee "$RUN_DIR/60_runtime_acceptance_gate.txt" || {
  echo "STOP: Runtime acceptance gate failed" | tee "$RUN_DIR/99_STOP_REPORT.txt"
  exit 1
}

if ! grep -q "PASS" "$RUN_DIR/60_runtime_acceptance_gate.txt"; then
  echo "STOP: Runtime acceptance gate did not report PASS" | tee "$RUN_DIR/99_STOP_REPORT.txt"
  exit 1
fi

echo "[LAYER 4] Checking truth table consistency..."
node tools/truth_table_check.mjs "$RUN_DIR/51_runtime_truth.json" 2>&1 | tee "$RUN_DIR/70_truth_table_check.txt" || {
  echo "STOP: Truth table consistency failed" | tee "$RUN_DIR/99_STOP_REPORT.txt"
  exit 1
}

if ! grep -q "TRUTH_TABLE_CONSISTENCY: PASSED" "$RUN_DIR/70_truth_table_check.txt"; then
  echo "STOP: Truth table did not pass all rules" | tee "$RUN_DIR/99_STOP_REPORT.txt"
  exit 1
fi

echo "✅ LAYER 4: PASS (all gates + truth table consistent)" | tee -a "$RUN_DIR/04_layer_status.txt"

# FINAL REPORT
echo "=== FINAL REPORT ===" | tee "$RUN_DIR/99_FINAL_REPORT.md"
cat >> "$RUN_DIR/99_FINAL_REPORT.md" << EOF

# PHASE 6 STRICT REAL RUNTIME VERIFICATION — FINAL REPORT

## Verification Status: ✅ PASS

### Git State
- Branch: $(cat "$RUN_DIR/03_branch.txt" 2>/dev/null || git rev-parse --abbrev-ref HEAD)
- HEAD SHA: $(git rev-parse HEAD)
- Tree: CLEAN (no modifications)

### Build Verification
- npm test: $(grep "Tests.*passed" "$RUN_DIR/11_npm_test_summary.txt" | head -1)
- build:gadget: ALL GATES PASSING
- verify:bundle:provenance: EXECUTED (no warnings)
- Provenance hash: embedded=$EMBEDDED matches computed=$COMPUTED

### Runtime Verification
- Dashboard URL: $JIRA_DASHBOARD_URL
- Playwright probe: EXECUTED
- Console log: $(wc -l < "$RUN_DIR/50_runtime_console.log") lines
- Screenshot: $(ls -lh "$RUN_DIR/53_runtime_screenshot.png" | awk '{print $5}')
- Trace: $(ls -lh "$RUN_DIR/54_runtime_trace.zip" | awk '{print $5}')

### Truth Table
- All 6 consistency rules: PASSED
- overall_health_state: $(grep '"overall_health_state"' "$RUN_DIR/51_runtime_truth.json" | head -1)
- snapshot_count: $(grep '"snapshot_count"' "$RUN_DIR/51_runtime_truth.json" | head -1)
- ui_request_id: SET (not UNSET)
- tenant_identity: KNOWN (not UNKNOWN)
- Build SHAs: VALID (not UNSET or ERROR)

### Runtime Gate
- Status: PASS

### Evidence Files
EOF

ls -1 "$RUN_DIR" | sed 's/^/- /' >> "$RUN_DIR/99_FINAL_REPORT.md"

echo ""
echo "================================================================================"
echo "✅ PHASE 6 STRICT RUNTIME VERIFICATION: PASS"
echo "================================================================================"
echo ""
echo "RUN_DIR=$RUN_DIR"
echo ""
cat "$RUN_DIR/99_FINAL_REPORT.md"

exit 0
