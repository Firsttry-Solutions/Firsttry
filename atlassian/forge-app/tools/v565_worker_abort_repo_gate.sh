#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/Firsttry/atlassian/forge-app

# Discover candidate files:
# - must mention jobId
# - must look like a handler/runner/processor file (heuristics)
# - exclude resolver definition files (they delegate to adapter, not process jobs directly)
CANDIDATES="$(rg -l "jobId" src \
  | grep -v "gadget-resolver\\.ts" \
  | while read -r f; do
      if rg -q "(export\s+const\s+run\s*=|export\s+async\s+function\s+run\s*\(|export\s+async\s+function\s+handler\s*\(|scheduledTrigger|enqueue|process\()" "$f" 2>/dev/null; then
        echo "$f"
      fi
    done)"

echo "$CANDIDATES" | tee /tmp/ft_v565_worker_repo_candidates.txt >/dev/null

# Mandatory enforcement: for each candidate file, if it references jobId, it must include abortIfMasterFailed(jobId)
FAIL=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if rg -q "jobId" "$f"; then
    rg -q "abortIfMasterFailed\(jobId\)" "$f" || { echo "FAIL: missing abortIfMasterFailed(jobId) in $f"; FAIL=1; }
  fi
done <<< "$CANDIDATES"

# Also require that at least these two v565 execution points contain abort:
rg -q "abortIfMasterFailed\(jobId\)" src/jobs/v565/snapshotScheduleKickoff.ts || { echo "FAIL: kickoff missing abort"; FAIL=1; }
rg -q "abortIfMasterFailed\(jobId\)" src/jobs/v565/snapshotMasterEnqueueAdapter.ts || { echo "FAIL: adapter missing abort with jobId var"; FAIL=1; }

[ "$FAIL" -eq 0 ] && echo "PASS: repo worker abort gate" || exit 1
