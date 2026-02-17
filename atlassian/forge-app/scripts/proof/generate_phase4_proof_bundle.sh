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

# FAIL-CLOSED dist entrypoint resolution (deterministic, zero ambiguity)
ENTRY="$(bash scripts/proof/resolve_phase4_dist_entrypoint.sh)"
echo "FT_PROOF:PHASE4_DIST_ENTRYPOINT=$ENTRY"

# Run generator (selftest included) - explicitly pass env to ensure they're available
FT_APP_ROOT="$APP_ROOT" \
FT_SITE_ID="$FT_SITE_ID" \
FT_APP_ID="$FT_APP_ID" \
FT_ENV="$FT_ENV" \
FT_BUILD_SHA_SHORT="$FT_BUILD_SHA_SHORT" \
FT_BUILD_UTC="$FT_BUILD_UTC" \
FT_RULESET_VERSION="$FT_RULESET_VERSION" \
FT_SCHEMA_VERSION="$FT_SCHEMA_VERSION" \
node "$ENTRY"

echo "FT_PROOF:PHASE4_BUNDLE_SUCCESS"
