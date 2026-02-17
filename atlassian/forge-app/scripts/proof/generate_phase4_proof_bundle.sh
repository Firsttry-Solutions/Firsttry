#!/usr/bin/env bash
set -euo pipefail

echo "FT_PROOF:PHASE4_BUNDLE_START"

APP_ROOT="/workspaces/Firsttry/atlassian/forge-app"
cd "$APP_ROOT"

# Required env (fail-closed)
: "${FT_SITE_ID:?Set FT_SITE_ID (e.g. example.atlassian.net)}"
: "${FT_APP_ID:?Set FT_APP_ID (Forge app ARI)}"
: "${FT_ENV:?Set FT_ENV (dev|staging|prod)}"
: "${FT_BUILD_SHA_SHORT:?Set FT_BUILD_SHA_SHORT (8+ hex)}"
: "${FT_BUILD_UTC:?Set FT_BUILD_UTC (ISO Z)}"
: "${FT_RULESET_VERSION:?Set FT_RULESET_VERSION (v4.3.1)}"
: "${FT_SCHEMA_VERSION:?Set FT_SCHEMA_VERSION (e.g. v1)}"

export FT_APP_ROOT="$APP_ROOT"

# Build (dist must exist)
npm run build

# FAIL-CLOSED dist entrypoint check (no ambiguity)
# Check both possible output locations (tsc may vary)
if [ -f "dist/security/proof/phase4Bundle.cli.js" ]; then
  ENTRY_POINT="dist/security/proof/phase4Bundle.cli.js"
elif [ -f "dist/proof/phase4Bundle.cli.js" ]; then
  ENTRY_POINT="dist/proof/phase4Bundle.cli.js"
else
  echo "FAIL-CLOSED: expected dist/security/proof/phase4Bundle.cli.js or dist/proof/phase4Bundle.cli.js not found."
  echo "Your build output layout differs. Fix build config or adjust script to correct dist path (do not guess)."
  exit 1
fi

# Run generator (selftest included)
node "$ENTRY_POINT"

echo "FT_PROOF:PHASE4_BUNDLE_SUCCESS"
