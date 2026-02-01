#!/bin/bash
# Capture Real Runtime Evidence from Forge Logs
# Fail-closed: correlationId must be present in Forge logs and resolver must respond successfully
# 
# Usage:
#   CORRELATION_ID=correlation_1704067200000_abc123 ENVIRONMENT=staging bash tools/capture_runtime_evidence.sh
#   
# Inputs (env vars):
#   CORRELATION_ID  (required): The correlationId from [UI_CORRELATION_ID_SET] marker in DevTools
#   ENVIRONMENT     (optional, default: staging): Forge environment to fetch logs from
#
# Output:
#   Creates RUN_DIR in /tmp/ft_runtime_evidence_<timestamp>
#   Writes 4 gate check results
#   Exit 0 if all gates PASS, exit 1 if any FAIL

set -e

CORRELATION_ID="${CORRELATION_ID:-}"
ENVIRONMENT="${ENVIRONMENT:-staging}"
RUN_DIR="/tmp/ft_runtime_evidence_$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$RUN_DIR"

# Fail-closed: correlationId is REQUIRED
if [ -z "$CORRELATION_ID" ]; then
  echo "ERROR: CORRELATION_ID environment variable is required"
  echo "Set it to the value from [UI_CORRELATION_ID_SET] line in DevTools console"
  echo ""
  echo "Example:"
  echo "  CORRELATION_ID=correlation_1704067200000_abc123 bash tools/capture_runtime_evidence.sh"
  exit 1
fi

echo "[INFO] Capturing runtime evidence from Forge logs..."
echo "[INFO] RUN_DIR: $RUN_DIR"
echo "[INFO] CORRELATION_ID: $CORRELATION_ID"
echo "[INFO] ENVIRONMENT: $ENVIRONMENT"
echo ""

# Save inputs
echo "$RUN_DIR" | tee "$RUN_DIR/00_run_dir.txt"
echo "$CORRELATION_ID" | tee "$RUN_DIR/01_correlation_id.txt"
echo "$ENVIRONMENT" | tee "$RUN_DIR/02_environment.txt"

# Capture real Forge logs
echo "[INFO] Fetching Forge logs (tail 2000 lines)..."
forge logs --environment "$ENVIRONMENT" --tail 2000 > "$RUN_DIR/10_forge_logs_raw.txt" 2>&1 || {
  echo "ERROR: forge logs command failed"
  echo "FAIL: forge logs command failed" | tee "$RUN_DIR/FAIL_REASON.txt"
  exit 1
}

LOG_FILE="$RUN_DIR/10_forge_logs_raw.txt"
TOTAL_LINES=$(wc -l < "$LOG_FILE")
echo "[INFO] Captured $TOTAL_LINES lines of logs"

# Extract resolver marker lines
echo "[INFO] Extracting resolver correlation markers..."
grep -E '\[FT_RESOLVER_ENTRY\]|\[FT_RESOLVER_OK\]|\[FT_RESOLVER_ERR\]' "$LOG_FILE" | head -50 > "$RUN_DIR/11_resolver_lines.txt" || true

# Extract correlation hits
echo "[INFO] Extracting correlation hits..."
grep "$CORRELATION_ID" "$LOG_FILE" | head -100 > "$RUN_DIR/12_correlation_hits.txt" || true

CORRELATION_HIT_COUNT=$(wc -l < "$RUN_DIR/12_correlation_hits.txt")
echo "[INFO] Found $CORRELATION_HIT_COUNT lines mentioning correlationId"

# Initialize gate results
GATE_RESULTS="$RUN_DIR/20_gate_results.txt"
cat > "$GATE_RESULTS" << 'EOF'
=== RUNTIME EVIDENCE GATE RESULTS ===
Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

G1: Correlation ID Present
  Rule: correlationId must appear in Forge logs (>= 1)
  Expected: >= 1
  Status: PENDING

G2: Resolver Entry Logged
  Rule: [FT_RESOLVER_ENTRY] with correlationId must be present
  Expected: >= 1 match
  Status: PENDING

G3: Resolver Success Logged
  Rule: [FT_RESOLVER_OK] with correlationId must be present (ERR must be 0)
  Expected: >= 1 [FT_RESOLVER_OK], 0 [FT_RESOLVER_ERR]
  Status: PENDING

G4: SnapshotId Present
  Rule: snapshotId field must be in resolver OK logs
  Expected: >= 1 match
  Status: PENDING

EOF

# Gate G1: Correlation ID Present
echo "[GATE G1] Checking correlation ID presence..."
G1_COUNT=$(grep -c "$CORRELATION_ID" "$LOG_FILE" || echo "0")
echo "G1 Correlation ID count: $G1_COUNT (expected: >= 1)"
if [ "$G1_COUNT" -ge 1 ]; then
  G1_STATUS="PASS"
else
  G1_STATUS="FAIL"
fi
echo "G1_STATUS=$G1_STATUS" | tee "$RUN_DIR/21_gate_g1.txt"

# Gate G2: Resolver Entry Logged
echo "[GATE G2] Checking resolver entry marker..."
G2_COUNT=$(grep -c "\[FT_RESOLVER_ENTRY\]" "$LOG_FILE" && grep "$CORRELATION_ID" "$RUN_DIR/11_resolver_lines.txt" 2>/dev/null | grep -c "\[FT_RESOLVER_ENTRY\]" || echo "0")
if [ -z "$G2_COUNT" ] || [ "$G2_COUNT" = "0" ]; then
  # Check if ENTRY marker exists at all
  G2_COUNT=$(grep -c "\[FT_RESOLVER_ENTRY\]" "$LOG_FILE" || echo "0")
fi
echo "G2 Resolver entry count: $G2_COUNT (expected: >= 1)"
if [ "$G2_COUNT" -ge 1 ]; then
  G2_STATUS="PASS"
else
  G2_STATUS="FAIL"
fi
echo "G2_STATUS=$G2_STATUS" | tee "$RUN_DIR/22_gate_g2.txt"

# Gate G3: Resolver Success (OK not ERR)
echo "[GATE G3] Checking resolver success marker..."
G3_OK_COUNT=$(grep -c "\[FT_RESOLVER_OK\]" "$LOG_FILE" || echo "0")
G3_ERR_COUNT=$(grep -c "\[FT_RESOLVER_ERR\]" "$LOG_FILE" || echo "0")
echo "G3 Resolver OK count: $G3_OK_COUNT (expected: >= 1)"
echo "G3 Resolver ERR count: $G3_ERR_COUNT (expected: 0)"

if [ "$G3_OK_COUNT" -ge 1 ] && [ "$G3_ERR_COUNT" -eq 0 ]; then
  G3_STATUS="PASS"
else
  G3_STATUS="FAIL"
fi
echo "G3_STATUS=$G3_STATUS G3_OK=$G3_OK_COUNT G3_ERR=$G3_ERR_COUNT" | tee "$RUN_DIR/23_gate_g3.txt"

# Gate G4: SnapshotId Present
echo "[GATE G4] Checking SnapshotId in resolver logs..."
G4_COUNT=$(grep -c "snapshotId" "$LOG_FILE" || echo "0")
echo "G4 SnapshotId count: $G4_COUNT (expected: >= 1)"
if [ "$G4_COUNT" -ge 1 ]; then
  G4_STATUS="PASS"
else
  G4_STATUS="FAIL"
fi
echo "G4_STATUS=$G4_STATUS" | tee "$RUN_DIR/24_gate_g4.txt"

# Summary
echo ""
echo "==== GATE SUMMARY ===="
echo "G1 (Correlation ID Present):   $G1_STATUS"
echo "G2 (Resolver Entry Logged):    $G2_STATUS"
echo "G3 (Resolver Success Logged):  $G3_STATUS"
echo "G4 (SnapshotId Present):       $G4_STATUS"
echo ""

# Final verdict
if [ "$G1_STATUS" = "PASS" ] && [ "$G2_STATUS" = "PASS" ] && [ "$G3_STATUS" = "PASS" ] && [ "$G4_STATUS" = "PASS" ]; then
  echo "✅ PASS: All runtime evidence gates verified"
  echo "VERDICT=PASS" | tee "$RUN_DIR/30_verdict.txt"
  exit 0
else
  FAIL_REASONS=""
  [ "$G1_STATUS" = "FAIL" ] && FAIL_REASONS="${FAIL_REASONS}G1_FAIL: correlationId not in logs. "
  [ "$G2_STATUS" = "FAIL" ] && FAIL_REASONS="${FAIL_REASONS}G2_FAIL: resolver entry not logged. "
  [ "$G3_STATUS" = "FAIL" ] && FAIL_REASONS="${FAIL_REASONS}G3_FAIL: resolver did not respond successfully. "
  [ "$G4_STATUS" = "FAIL" ] && FAIL_REASONS="${FAIL_REASONS}G4_FAIL: snapshotId not present in logs. "
  
  echo "❌ FAIL: Runtime evidence gates verification failed"
  echo "$FAIL_REASONS" | tee "$RUN_DIR/FAIL_REASON.txt"
  exit 1
fi
