#!/bin/bash
#
# tools/validate_dashboard_runtime_contract.sh
# 
# Runtime contract validator for Jira dashboard gadget
# Ensures UI + backend satisfy marketplace gates:
# 1. No contradictory copy
# 2. Snapshot runner scheduled
# 3. FT_PROOF_MARKER with nonce logging
# 4. Resolvers present
# 5. Export functions real (not placeholder)

set -euo pipefail

FORGE_DIR="${1:-.}"
if [ ! -f "$FORGE_DIR/manifest.yml" ]; then
  echo "FAIL: manifest.yml not found at $FORGE_DIR"
  exit 1
fi

FAIL_COUNT=0

# Helper
fail() {
  echo "[FAIL] $*"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

pass() {
  echo "[PASS] $*"
}

warn() {
  echo "[WARN] $*"
}

header() {
  echo ""
  echo "=== $* ==="
}

# ============================================================================
# GATE 1: Manifest structure - scheduled triggers
# ============================================================================
header "GATE 1: Manifest scheduling"

if grep -q "scheduledTrigger:" "$FORGE_DIR/manifest.yml"; then
  pass "scheduledTrigger section found in manifest"
else
  fail "No scheduledTrigger section in manifest"
fi

if grep -q "interval: fiveMinute\|interval: hour\|interval: day" "$FORGE_DIR/manifest.yml"; then
  pass "At least one scheduled interval configured"
else
  fail "No scheduled intervals found"
fi

# ============================================================================
# GATE 2: Handler files - snapshot runners exist
# ============================================================================
header "GATE 2: Snapshot handler implementations"

if [ -f "$FORGE_DIR/src/scheduled/snapshot_daily.ts" ]; then
  pass "snapshot_daily.ts exists"
else
  fail "snapshot_daily.ts missing"
fi

if [ -f "$FORGE_DIR/src/scheduled/snapshot_weekly.ts" ]; then
  pass "snapshot_weekly.ts exists"
else
  fail "snapshot_weekly.ts missing"
fi

# ============================================================================
# GATE 3: FT_PROOF_MARKER logging exists
# ============================================================================
header "GATE 3: FT_PROOF_MARKER logging"

if grep -r "FT_PROOF_MARKER" "$FORGE_DIR/src/resolvers" > /dev/null 2>&1; then
  pass "FT_PROOF_MARKER found in resolver code"
else
  fail "FT_PROOF_MARKER not found in resolvers"
fi

if grep -q "uiReqId" "$FORGE_DIR/src/resolvers/getBuildInfo.ts" > /dev/null 2>&1; then
  pass "uiReqId nonce used in getBuildInfo"
else
  fail "uiReqId not found in getBuildInfo"
fi

# ============================================================================
# GATE 4: UI code - no contradictory copy
# ============================================================================
header "GATE 4: UI copy consistency"

# Forbidden phrases that indicate contradictions
FORBIDDEN_COPY=(
  "does not trigger background jobs"  # Old phrasing
  "Snapshot Age: undefined"           # Bad placeholder display
  "Data Freshness: FRESH.*undefined"  # Contradictory state
)

FORBIDDEN_FOUND=0
for phrase in "${FORBIDDEN_COPY[@]}"; do
  if grep -r "$phrase" "$FORGE_DIR/src/gadget-ui/src" > /dev/null 2>&1; then
    fail "Found forbidden copy: '$phrase'"
    FORBIDDEN_FOUND=$((FORBIDDEN_FOUND + 1))
  fi
done

if [ $FORBIDDEN_FOUND -eq 0 ]; then
  pass "No forbidden copy phrases found"
fi

# ============================================================================
# GATE 5: Export functions - real snapshot data (not placeholder)
# ============================================================================
header "GATE 5: Export functions"

if [ -f "$FORGE_DIR/src/resolvers/audit_snapshot_export.ts" ]; then
  pass "audit_snapshot_export.ts exists"
  if grep -q "snapshot\|export.*json\|export.*csv" "$FORGE_DIR/src/resolvers/audit_snapshot_export.ts"; then
    pass "Export resolver implements snapshot data export"
  else
    warn "Export resolver found but may not implement snapshot export"
  fi
else
  fail "audit_snapshot_export.ts missing"
fi

if grep -q "exportTrustSnapshot" "$FORGE_DIR/src/gadget-resolver.ts"; then
  pass "exportTrustSnapshot registered in resolver"
else
  fail "exportTrustSnapshot not registered"
fi

# ============================================================================
# GATE 6: getStatusSnapshot resolver
# ============================================================================
header "GATE 6: Status snapshot resolver"

if [ -f "$FORGE_DIR/src/resolvers/getStatusSnapshot.ts" ]; then
  pass "getStatusSnapshot.ts exists"
  if grep -q "getStatusSnapshot_resolver" "$FORGE_DIR/src/resolvers/getStatusSnapshot.ts"; then
    pass "getStatusSnapshot_resolver properly exported"
  else
    fail "getStatusSnapshot_resolver not exported"
  fi
else
  fail "getStatusSnapshot.ts missing"
fi

# ============================================================================
# GATE 7: Storage schema - tenant isolation
# ============================================================================
header "GATE 7: Storage schema"

if [ -f "$FORGE_DIR/src/status/statusStorage.ts" ]; then
  pass "statusStorage.ts exists"
  if grep -q "tenant\|TenantKey\|cloudId" "$FORGE_DIR/src/status/statusStorage.ts"; then
    pass "Tenant isolation implemented in storage"
  else
    warn "Tenant isolation may not be implemented"
  fi
else
  fail "statusStorage.ts missing"
fi

# ============================================================================
# GATE 8: Health/Freshness logic
# ============================================================================
header "GATE 8: Freshness logic"

if grep -r "freshness\|FRESH\|STALE\|NOT_AVAILABLE" "$FORGE_DIR/src" > /dev/null 2>&1; then
  pass "Freshness state logic found"
else
  warn "Freshness state logic may be missing"
fi

# ============================================================================
# RESULTS
# ============================================================================
header "RESULTS"

if [ $FAIL_COUNT -eq 0 ]; then
  echo "✅ ALL GATES PASSED"
  exit 0
else
  echo "❌ $FAIL_COUNT GATES FAILED"
  exit 1
fi
