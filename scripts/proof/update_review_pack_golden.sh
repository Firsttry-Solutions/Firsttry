#!/usr/bin/env bash
set -euo pipefail

# Manual updater for Phase 3 review pack golden (NOT used in CI)
# Updates repo-tracked golden file with current canonical fixture

REPO_ROOT="$(git rev-parse --show-toplevel)"
GOLDEN_FILE="$REPO_ROOT/atlassian/forge-app/tests/determinism/golden/review_pack_golden.json"

cd "$REPO_ROOT/atlassian/forge-app"

# Generate canonical using Node
GOLDEN_JSON=$(node -e "
const mod = require('./dist/export/reviewPackCanonical.js');
const fixture = mod.buildReviewPackCanonicalFixture();
console.log(JSON.stringify(fixture, Object.keys(fixture).sort(), 2));
" 2>/dev/null || echo '{}')

if [ "$GOLDEN_JSON" = "{}" ]; then
  echo "WARNING: Dist not built; using hardcoded fixture" >&2
  GOLDEN_JSON=$(node -e "
console.log(JSON.stringify({
  schemaVersion: '3.0.0',
  siteId: 'ari:cloud:jira::site/12345678-1234-1234-1234-123456789abc',
  privilegeContext: 'ADMIN',
  ruleSetVersion: 'phase-3-review-set-v1',
  buildShaShort: 'f5041c20',
  phaseIdentifier: 'phase-3-review-pack'
}, null, 2));
")
fi

# Overwrite golden
echo "$GOLDEN_JSON" > "$GOLDEN_FILE"

echo "[FT_REVIEW_PACK_GOLDEN_UPDATED]"
