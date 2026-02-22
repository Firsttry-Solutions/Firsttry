#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/Firsttry/atlassian/forge-app

ALLOWLIST="${1:-/tmp/ft_v565_allowlist_missing}"
test -f "$ALLOWLIST" || (echo "FAIL: allowlist file not provided or missing: $ALLOWLIST" && exit 1)

while IFS= read -r f; do
  test -f "$f" || (echo "FAIL: allowlist file path missing in repo: $f" && exit 1)
  # Only enforce for files that still mention jobId
  if rg -n "jobId" "$f" >/dev/null; then
    rg -n "abortIfMasterFailed\(jobId\)" "$f" >/dev/null || (echo "FAIL: missing abortIfMasterFailed(jobId) in $f" && exit 1)
  fi
done < "$ALLOWLIST"

echo "PASS: worker abort present in all allowlisted jobId worker files"
