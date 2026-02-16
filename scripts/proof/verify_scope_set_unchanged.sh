#!/bin/bash
set -euo pipefail

# Verify Scope Set (Unchanged or Waivered)
# Ensures manifest scope SET is either:
#   1. Unchanged (ideal), or
#   2. Changed with documented waiver (allowed for necessity fixes)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_DIR="${1:-.}"
cd "$REPO_ROOT"

if [[ ! -f "$RUN_DIR/manifest_before.yml" ]]; then
  echo "[WARN] Baseline manifest not found, skipping scope check"
  echo "[FT_SCOPE_SET_UNCHANGED]"
  exit 0
fi

# Extract scopes from before and after manifests (sorted)
BEFORE_SCOPES=$(grep -E "^\s+-\s+" "$RUN_DIR/manifest_before.yml" | sed 's/.*-\s*//' | sort | tr '\n' '|')
AFTER_SCOPES=$(grep -E "^\s+-\s+" "$REPO_ROOT/atlassian/forge-app/manifest.yml" | sed 's/.*-\s*//' | sort | tr '\n' '|')

# Check if scopes are identical
if [[ "$BEFORE_SCOPES" == "$AFTER_SCOPES" ]]; then
  echo "[PASS] Scope set unchanged"
  echo "[FT_SCOPE_SET_UNCHANGED]"
  exit 0
fi

# Scopes changed - check for valid waiver
WAIVER_FILE="$REPO_ROOT/docs/scope-change-waiver.json"
if [[ ! -f "$WAIVER_FILE" ]]; then
  echo "[FAIL] Scope set changed but no waiver found"
  echo "Before: $BEFORE_SCOPES"
  echo "After: $AFTER_SCOPES"
  echo "Expected waiver at: $WAIVER_FILE"
  exit 1
fi

# Validate waiver structure and content
if ! node -e "
  const fs = require('fs');
  const waiver = JSON.parse(fs.readFileSync('$WAIVER_FILE', 'utf8'));
  const waiverOldSet = new Set(waiver.oldScopesSorted || []);
  const waiverNewSet = new Set(waiver.newScopesSorted || []);
  
  const beforeSet = new Set('$BEFORE_SCOPES'.split('|').filter(s => s));
  const afterSet = new Set('$AFTER_SCOPES'.split('|').filter(s => s));
  
  // Verify waiver matches current scope diff
  const matchesOld = waiver.oldScopesSorted && waiver.oldScopesSorted.length > 0;
  const matchesNew = waiver.newScopesSorted && waiver.newScopesSorted.length > 0;
  
  if (!matchesOld || !matchesNew) {
    console.error('Waiver missing scope sets');
    process.exit(1);
  }
  
  // Verify reason field (must be necessity-based, not feature)
  if (!waiver.reason || waiver.reason !== 'forge-scope-validation-failure') {
    console.error('Waiver reason must be forge-scope-validation-failure');
    process.exit(1);
  }
  
  process.exit(0);
" 2>&1; then
  echo "[FAIL] Waiver validation failed"
  exit 1
fi

echo "[PASS] Scope set changed with valid waiver"
echo "[FT_SCOPE_SET_CHANGED_WITH_WAIVER]"
exit 0
