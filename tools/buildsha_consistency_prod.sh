#!/bin/bash
set -euo pipefail

##############################################################################
# buildsha_consistency_prod.sh
# 
# Deterministic proof script that checks for build SHA mismatches in 
# RESOLVER_* and FT_STATUS_* markers for the same invocation UUID.
#
# Usage: bash buildsha_consistency_prod.sh [--minutes N]
# Default: --minutes 30
#
# Exit codes:
#   0 = OK, no mismatches found
#   1 = Invalid arguments
#   2 = FAIL, mismatches or other issues found
##############################################################################

MINUTES=30

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --minutes)
      MINUTES="$2"
      shift 2
      ;;
    *)
      echo "ERROR: Unknown argument: $1"
      echo "Usage: $0 [--minutes N]"
      exit 1
      ;;
  esac
done

if ! [[ "$MINUTES" =~ ^[0-9]+$ ]]; then
  echo "ERROR: --minutes must be a number"
  exit 1
fi

# Create output directory
RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)
OUT_DIR="/tmp/buildsha_consistency_${RUN_ID}"
mkdir -p "$OUT_DIR"

echo "Build SHA Consistency Checker"
echo "=============================="
echo "Minutes: $MINUTES"
echo "Output: $OUT_DIR"
echo ""

# Capture logs
echo "[1] Capturing production logs..."
cd /workspaces/Firsttry/atlassian/forge-app
forge logs --environment production --since "${MINUTES}m" --limit 5000 \
  > "$OUT_DIR/prod_logs.txt" 2>&1 || true
cd /workspaces/Firsttry

LOG_LINES=$(wc -l < "$OUT_DIR/prod_logs.txt")
echo "    Captured $LOG_LINES lines"

# Run Python analysis
echo "[2] Analyzing markers..."
python3 - "$OUT_DIR" <<'PYEOF'
import sys, re, json, pathlib
from collections import defaultdict

out_dir = sys.argv[1]
logs_file = pathlib.Path(out_dir) / "prod_logs.txt"
logs = logs_file.read_text(errors='ignore')

# UUID pattern
UUID_PAT = r'([0-9a-f-]{36})'

# For each line, extract: UUID, marker type, resolver, backend_build_sha
events = defaultdict(list)

for line in logs.splitlines():
  # Try to extract UUID
  m = re.search(UUID_PAT, line)
  if not m:
    continue
  uuid = m.group(1)
  
  # Skip if not getStatusSnapshot
  if 'resolver":"getStatusSnapshot' not in line and 'getStatusSnapshot' not in line:
    continue
  
  # Identify marker type
  marker = None
  if 'RESOLVER_ENTER' in line:
    marker = 'RESOLVER_ENTER'
  elif 'FT_STATUS_ENTRY' in line:
    marker = 'FT_STATUS_ENTRY'
  elif 'FT_STATUS_OK' in line:
    marker = 'FT_STATUS_OK'
  elif 'FT_STATUS_ERR' in line:
    marker = 'FT_STATUS_ERR'
  elif 'RESOLVER_ERR' in line:
    marker = 'RESOLVER_ERR'
  elif 'RESOLVER_OK' in line:
    marker = 'RESOLVER_OK'
  
  if not marker:
    continue
  
  # Extract backend_build_sha
  sha_match = re.search(r'"backend_build_sha":"([^"]+)"', line)
  sha = sha_match.group(1) if sha_match else None
  
  events[uuid].append({'marker': marker, 'sha': sha})

# Analyze
mismatches = []
false_errs = []

for uuid, markers_list in sorted(events.items()):
  # Check SHA consistency
  shas = [m['sha'] for m in markers_list if m['sha']]
  if len(set(shas)) > 1:
    mismatches.append((uuid, markers_list))
  
  # Check for false ERR (FT_STATUS_OK but also RESOLVER_ERR/RESOLVER_OK)
  marker_types = {m['marker'] for m in markers_list}
  if 'FT_STATUS_OK' in marker_types and 'RESOLVER_ERR' in marker_types:
    false_errs.append((uuid, markers_list))

# Print results
print(f"Total UUIDs analyzed: {len(events)}")
print(f"SHA mismatches: {len(mismatches)}")
print(f"False ERR cases: {len(false_errs)}")
print()

if mismatches:
  print("MISMATCHES:")
  for uuid, markers in mismatches[:5]:
    print(f"  UUID: {uuid}")
    for m in markers:
      print(f"    {m['marker']:20s} sha={m['sha']}")
  print()

if false_errs:
  print("FALSE ERR (FT_STATUS_OK but RESOLVER_ERR logged):")
  for uuid, markers in false_errs[:5]:
    print(f"  UUID: {uuid}")
    for m in markers:
      print(f"    {m['marker']:20s}")
  print()

# Save detailed report
with open(pathlib.Path(out_dir) / "analysis.txt", "w") as f:
  f.write(f"Analyzed {len(events)} invocations\n")
  f.write(f"Mismatches: {len(mismatches)}\n")
  f.write(f"False ERRs: {len(false_errs)}\n")

# Exit code
sys.exit(2 if (mismatches or false_errs) else 0)
PYEOF

EXIT_CODE=$?
echo ""
if [[ $EXIT_CODE -eq 0 ]]; then
  echo "✅ PASS: No mismatches or false ERRs found"
else
  echo "❌ FAIL: Issues detected (see $OUT_DIR for details)"
fi

echo ""
echo "Output saved to: $OUT_DIR"
exit $EXIT_CODE

