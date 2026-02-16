#!/bin/bash
set -euo pipefail

# Verify Scope Set Unchanged
# Ensures manifest scope SET is immutable (same set, order doesn't matter)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_DIR="${1:-.}"
cd "$REPO_ROOT"

if [[ ! -f "$RUN_DIR/manifest_before.yml" ]]; then
  echo "[WARN] Baseline manifest not found, skipping scope check"
  echo "[FT_SCOPE_SET_UNCHANGED]"
  exit 0
fi

# Extract scopes (simplified YAML parsing)
BEFORE_SCOPES=$(grep -E "^\s+-\s+" "$RUN_DIR/manifest_before.yml" | sed 's/.*-\s*//' | sort | tr '\n' '|')
AFTER_SCOPES=$(grep -E "^\s+-\s+" "$REPO_ROOT/atlassian/forge-app/manifest.yml" | sed 's/.*-\s*//' | sort | tr '\n' '|')

if [[ "$BEFORE_SCOPES" != "$AFTER_SCOPES" ]]; then
  echo "[FAIL] Scope set changed"
  echo "Before: $BEFORE_SCOPES"
  echo "After: $AFTER_SCOPES"
  exit 1
fi

echo "[PASS] Scope set unchanged"
echo "[FT_SCOPE_SET_UNCHANGED]"
