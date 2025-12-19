#!/bin/bash

################################################################################
# Runtime Verification Script - PHASE 1.1
#
# Purpose: Verify Phase 1 event ingestion endpoint works end-to-end
#
# Prerequisites:
#   - FORGE_EMAIL environment variable set
#   - FORGE_API_TOKEN environment variable set
#   - FIRSTRY_INGEST_TOKEN environment variable set
#   - Forge CLI v12+ installed
#   - App deployed to development environment
#
# Usage:
#   bash scripts/verify_runtime_ingestion.sh
#
# Exit code:
#   0 = all checks pass
#   1 = any check fails
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0

# Log function
log_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASS++))
}

log_fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAIL++))
}

log_info() {
  echo -e "${BLUE}→${NC} $1"
}

log_section() {
  echo ""
  echo -e "${BLUE}=== $1 ===${NC}"
  echo ""
}

################################################################################
# Step 1: Verify prerequisites
################################################################################

log_section "Checking Prerequisites"

if [ -z "$FORGE_EMAIL" ]; then
  log_fail "FORGE_EMAIL not set"
  exit 1
fi
log_pass "FORGE_EMAIL is set"

if [ -z "$FORGE_API_TOKEN" ]; then
  log_fail "FORGE_API_TOKEN not set"
  exit 1
fi
log_pass "FORGE_API_TOKEN is set"

if [ -z "$FIRSTRY_INGEST_TOKEN" ]; then
  log_fail "FIRSTRY_INGEST_TOKEN not set"
  exit 1
fi
log_pass "FIRSTRY_INGEST_TOKEN is set"

command -v forge &> /dev/null || { log_fail "forge CLI not found"; exit 1; }
log_pass "forge CLI is installed"

command -v curl &> /dev/null || { log_fail "curl not found"; exit 1; }
log_pass "curl is installed"

################################################################################
# Step 2: Check Forge CLI version
################################################################################

log_section "Verifying Forge CLI Version"

FORGE_VERSION=$(forge --version 2>&1 || echo "")
log_info "Forge version: $FORGE_VERSION"

if [[ $FORGE_VERSION == *"12."* ]] || [[ $FORGE_VERSION == *"13."* ]]; then
  log_pass "Forge CLI is v12+"
else
  log_fail "Forge CLI version not v12+ (got: $FORGE_VERSION)"
  # Don't exit; continue to show what we have
fi

################################################################################
# Step 3: Check app installation
################################################################################

log_section "Checking App Installation"

INSTALL_LIST=$(forge install list 2>&1 || echo "")
log_info "Installation list retrieved"

if echo "$INSTALL_LIST" | grep -q "firsttry"; then
  log_pass "App 'firsttry' is installed"
else
  log_fail "App 'firsttry' not found in installation list"
  echo "Available apps:"
  echo "$INSTALL_LIST"
  exit 1
fi

if echo "$INSTALL_LIST" | grep -q "development"; then
  log_pass "Development environment found"
else
  log_fail "Development environment not found"
  exit 1
fi

################################################################################
# Step 4: Extract webtrigger URL
################################################################################

log_section "Constructing Webtrigger URL"

# Try to extract app URL from install list
APP_URL=$(echo "$INSTALL_LIST" | grep -o 'https://[^[:space:]]*' | head -1 || echo "")

if [ -z "$APP_URL" ]; then
  # Fallback: construct from pattern
  APP_URL="https://firsttry.atlassian.net/extensions/app/firsttry"
  log_info "Using fallback URL: $APP_URL"
else
  log_info "Extracted app URL: $APP_URL"
fi

INGEST_URL="${APP_URL}/webhook/ingest"
log_pass "Webtrigger URL constructed: $INGEST_URL"

################################################################################
# Step 5: Send first event (new)
################################################################################

log_section "Test 1: Send New Event"

EVENT_ID="test-event-$(date +%s%N | cut -b1-13)"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)

log_info "Event ID: $EVENT_ID"
log_info "Timestamp: $TIMESTAMP"

EVENT_PAYLOAD=$(cat <<EOF
{
  "schema_version": "event.v1",
  "event_id": "$EVENT_ID",
  "timestamp": "$TIMESTAMP",
  "org_key": "testorg",
  "repo_key": "testrepo",
  "profile": "strict",
  "gates": ["lint", "test"],
  "duration_ms": 1500,
  "status": "success",
  "cache_hit": true,
  "retry_count": 0
}
EOF
)

RESPONSE1=$(curl -s -X POST \
  -H "X-FT-INGEST-TOKEN: ${FIRSTRY_INGEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$EVENT_PAYLOAD" \
  "$INGEST_URL" || echo '{"status":"error","message":"curl failed"}')

log_info "Response: $RESPONSE1"

if echo "$RESPONSE1" | grep -q '"status":"accepted"'; then
  log_pass "Event accepted (new)"
elif echo "$RESPONSE1" | grep -q '"status":"duplicate"'; then
  log_pass "Event processed (may be duplicate in test re-run)"
else
  log_fail "Event not accepted: $RESPONSE1"
fi

# Extract event_id from response for next test
RETURNED_EVENT_ID=$(echo "$RESPONSE1" | grep -o '"event_id":"[^"]*"' | cut -d'"' -f4 || echo "$EVENT_ID")

################################################################################
# Step 6: Send duplicate event (idempotency check)
################################################################################

log_section "Test 2: Send Duplicate Event (Idempotency)"

log_info "Event ID (same as Test 1): $RETURNED_EVENT_ID"
log_info "Timestamp (new): $TIMESTAMP"

RESPONSE2=$(curl -s -X POST \
  -H "X-FT-INGEST-TOKEN: ${FIRSTRY_INGEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"schema_version\": \"event.v1\",
    \"event_id\": \"$RETURNED_EVENT_ID\",
    \"timestamp\": \"$TIMESTAMP\",
    \"org_key\": \"testorg\",
    \"repo_key\": \"testrepo\",
    \"profile\": \"strict\",
    \"gates\": [\"lint\", \"test\"],
    \"duration_ms\": 1500,
    \"status\": \"success\",
    \"cache_hit\": true,
    \"retry_count\": 0
  }" \
  "$INGEST_URL" || echo '{"status":"error","message":"curl failed"}')

log_info "Response: $RESPONSE2"

if echo "$RESPONSE2" | grep -q '"status":"duplicate"'; then
  log_pass "Idempotency verified (duplicate detected)"
else
  log_fail "Idempotency not working: $RESPONSE2"
fi

################################################################################
# Step 7: Fetch storage proof snapshot
################################################################################

log_section "Test 3: Fetch Storage Proof Snapshot"

SNAPSHOT_URL="${APP_URL}/admin/storage-proof?org_key=testorg&repo_key=testrepo"
log_info "Snapshot URL: (redacted admin endpoint)"

RESPONSE3=$(curl -s -X GET \
  -H "X-Debug-Token: ${FIRSTRY_INGEST_TOKEN}" \
  -H "Content-Type: application/json" \
  "$SNAPSHOT_URL" || echo '{"status":"error","message":"curl failed"}')

log_info "Response: $RESPONSE3"

if echo "$RESPONSE3" | grep -q '"status":"success"\|"status":"incomplete"'; then
  log_pass "Storage proof snapshot retrieved"
else
  log_fail "Snapshot retrieval failed: $RESPONSE3"
fi

################################################################################
# Step 8: Verify event ID in snapshot
################################################################################

log_section "Test 4: Verify Event in Snapshot"

if echo "$RESPONSE3" | grep -q "$RETURNED_EVENT_ID"; then
  log_pass "Event ID appears in snapshot: $RETURNED_EVENT_ID"
else
  log_fail "Event ID not found in snapshot"
fi

################################################################################
# Step 9: Verify shard key in snapshot
################################################################################

if echo "$RESPONSE3" | grep -q '"shard'; then
  log_pass "Shard key found in snapshot"
else
  log_fail "Shard key not found in snapshot"
fi

################################################################################
# Step 10: Verify total count in snapshot
################################################################################

if echo "$RESPONSE3" | grep -q '"total_ingested_today"'; then
  COUNT=$(echo "$RESPONSE3" | grep -o '"total_ingested_today":[0-9]*' | cut -d':' -f2)
  if [ ! -z "$COUNT" ] && [ "$COUNT" -ge 0 ]; then
    log_pass "Total ingested count recorded: $COUNT"
  else
    log_fail "Invalid total count: $COUNT"
  fi
else
  log_fail "Total ingested count not found in snapshot"
fi

################################################################################
# Final Summary
################################################################################

log_section "Test Summary"

TOTAL=$((PASS + FAIL))
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "Total:  $TOTAL"

if [ $FAIL -eq 0 ]; then
  log_pass "All verification checks passed!"
  exit 0
else
  log_fail "Some checks failed"
  exit 1
fi
