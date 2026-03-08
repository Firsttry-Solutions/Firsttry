#!/bin/bash
# forge_logs_tail.sh
# 
# Deterministic polling tail implementation for Forge CLI logs.
# Replaces unsupported `forge logs --tail` with polling using `forge logs --since`.
#
# Forge CLI only supports: --environment, --since, --limit, --verbose
# Does NOT support: --tail
#
# Usage:
#   tools/forge_logs_tail.sh \
#     --env production \
#     --since "2026-01-16T09:52:58Z" \
#     --limit 200 \
#     --interval 5 \
#     --pattern "TENANT_PROOF|BUILDINFO_PROOF|ERROR" \
#     --outdir "/tmp/ft_prod_logs"
#
# Output files:
#   $OUTDIR/forge_logs_raw.txt      - All Forge logs (append mode)
#   $OUTDIR/forge_logs_filtered.txt - Filtered logs matching pattern (append mode)
#   $OUTDIR/last_since.txt          - Last --since value used
#   $OUTDIR/status.txt              - Running status + timestamps

set -euo pipefail

# Ensure we're in the Forge app directory
if [[ ! -f "manifest.yml" ]]; then
  # Try to find it
  if [[ -f "atlassian/forge-app/manifest.yml" ]]; then
    cd "atlassian/forge-app"
  elif [[ -f "../../../manifest.yml" ]]; then
    cd "../../../"
  else
    echo "ERROR: manifest.yml not found. Please run from Forge app root directory." >&2
    exit 1
  fi
fi

# Defaults
ENV="production"
SINCE=""
LIMIT="200"
INTERVAL="5"
PATTERN="TENANT_PROOF|BUILDINFO_PROOF|SNAPSHOT_WRITE_PROOF|SNAPSHOT_READ_PROOF|FT_PROOF_MARKER|getBuildInfo|getStatusSnapshot|refreshNow|getSnapshotDebug|export|ERROR|Exception"
OUTDIR=""
OVERLAP_SECONDS="10"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV="$2"
      shift 2
      ;;
    --since)
      SINCE="$2"
      shift 2
      ;;
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --interval)
      INTERVAL="$2"
      shift 2
      ;;
    --pattern)
      PATTERN="$2"
      shift 2
      ;;
    --outdir)
      OUTDIR="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Validation
if [[ -z "$OUTDIR" ]]; then
  echo "ERROR: --outdir is required" >&2
  exit 1
fi

if [[ -z "$ENV" ]]; then
  echo "ERROR: --env is required" >&2
  exit 1
fi

# Create output directory
mkdir -p "$OUTDIR"

# Initialize output files
RAW_LOG="$OUTDIR/forge_logs_raw.txt"
FILTERED_LOG="$OUTDIR/forge_logs_filtered.txt"
LAST_SINCE_FILE="$OUTDIR/last_since.txt"
STATUS_FILE="$OUTDIR/status.txt"

# Touch files to ensure they exist
touch "$RAW_LOG" "$FILTERED_LOG" "$STATUS_FILE"

# Determine initial SINCE
if [[ -z "$SINCE" ]]; then
  # Default: last 5 minutes
  SINCE=$(date -u -d '5 minutes ago' +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v-5m +"%Y-%m-%dT%H:%M:%SZ")
fi

echo "🚀 Starting Forge logs polling tail"
echo "   Environment: $ENV"
echo "   Since: $SINCE"
echo "   Limit: $LIMIT"
echo "   Interval: ${INTERVAL}s"
echo "   Pattern: $PATTERN"
echo "   Output dir: $OUTDIR"
echo ""

# Write initial status
{
  echo "STARTED: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "ENV: $ENV"
  echo "SINCE: $SINCE"
  echo "STATUS: RUNNING"
} > "$STATUS_FILE"

# Save initial SINCE
echo "$SINCE" > "$LAST_SINCE_FILE"

# Trap SIGINT and SIGTERM for graceful shutdown
cleanup() {
  {
    echo "STOPPED: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "STATUS: STOPPED"
  } >> "$STATUS_FILE"
  echo ""
  echo "✋ Forge logs polling stopped."
  echo "   Raw logs: $RAW_LOG"
  echo "   Filtered: $FILTERED_LOG"
  exit 0
}

trap cleanup SIGINT SIGTERM

# Polling loop
CURRENT_SINCE="$SINCE"
ITERATION=0

while true; do
  ITERATION=$((ITERATION + 1))
  LOOP_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  echo "[$ITERATION] Polling at $LOOP_START (since: $CURRENT_SINCE)..."
  
  # Call forge logs with current SINCE
  if forge logs \
    --environment "$ENV" \
    --since "$CURRENT_SINCE" \
    --limit "$LIMIT" \
    --verbose > /tmp/forge_logs_temp.txt 2>&1; then
    
    # Append raw logs
    cat /tmp/forge_logs_temp.txt >> "$RAW_LOG"
    
    # Filter and append
    grep -E "$PATTERN" /tmp/forge_logs_temp.txt >> "$FILTERED_LOG" || true
    
    # Count lines
    RAW_COUNT=$(wc -l < "$RAW_LOG")
    FILTERED_COUNT=$(wc -l < "$FILTERED_LOG")
    
    echo "    ✓ Captured: $(wc -l < /tmp/forge_logs_temp.txt) lines (total raw: $RAW_COUNT, filtered: $FILTERED_COUNT)"
    
  else
    # Forge logs error - log it and exit
    FORGE_ERROR=$(cat /tmp/forge_logs_temp.txt)
    {
      echo "ERROR at iteration $ITERATION ($LOOP_START):"
      echo "$FORGE_ERROR"
    } >> "$RAW_LOG"
    
    {
      echo "STOPPED: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
      echo "STATUS: ERROR"
      echo "ERROR_ITERATION: $ITERATION"
      echo "ERROR_REASON: forge logs command failed"
      echo "ERROR_OUTPUT:"
      echo "$FORGE_ERROR"
    } >> "$STATUS_FILE"
    
    # Check if it's an auth error
    if echo "$FORGE_ERROR" | grep -q "Not logged in"; then
      echo "❌ Forge authentication failed. Please run: forge login"
      exit 1
    fi
    
    echo "❌ forge logs failed at iteration $ITERATION. See $RAW_LOG for details."
    exit 1
  fi
  
  # Update SINCE for next iteration (with overlap to avoid gaps)
  NEXT_SINCE=$(date -u -d "${OVERLAP_SECONDS} seconds ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v-${OVERLAP_SECONDS}S +"%Y-%m-%dT%H:%M:%SZ")
  CURRENT_SINCE="$NEXT_SINCE"
  echo "$CURRENT_SINCE" > "$LAST_SINCE_FILE"
  
  # Wait before next poll
  echo "    Sleeping ${INTERVAL}s..."
  sleep "$INTERVAL"
done
