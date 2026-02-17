#!/usr/bin/env bash
set -euo pipefail

# STEP 0: Isolated compile directory (no reuse, no repo dist mutation)
UTC="$(date -u +%Y%m%dT%H%M%SZ)"
PROOF_BUILD_DIR="/tmp/ft_phase4_build_${UTC}"
mkdir -p "$PROOF_BUILD_DIR"
echo "FT_PROOF:PHASE4_BUILD_DIR=$PROOF_BUILD_DIR"

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

# Build: gadget (required)
npm run build

# STEP 2: Deterministic compile of ONLY Phase 4 proof-pack sources into isolated output
# No dependency on repo-wide compilation. No mutation of repo dist.
npx tsc \
  src/security/sourceScan.ts \
  src/security/scanAllowlist.ts \
  src/security/proof/phase4Bundle.ts \
  src/security/proof/phase4Bundle.cli.ts \
  src/security/canonicalJson.ts \
  src/security/hash.ts \
  src/security/fsHash.ts \
  src/security/manifestScopes.ts \
  --module commonjs \
  --target ES2020 \
  --lib ES2020,DOM \
  --declaration false \
  --sourceMap false \
  --outDir "$PROOF_BUILD_DIR/dist" \
  --strict false \
  --esModuleInterop \
  --skipLibCheck \
  --forceConsistentCasingInFileNames

# STEP 3: Run CLI from deterministic location (no repo dist mutation)
export FT_APP_ROOT="/workspaces/Firsttry/atlassian/forge-app"
# Note: tsc outputs individual files to --outDir root, not preserving source structure
ENTRY="$PROOF_BUILD_DIR/dist/proof/phase4Bundle.cli.js"
test -f "$ENTRY" || { echo "FAIL-CLOSED: missing compiled entrypoint at $ENTRY"; exit 1; }

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

# STEP 6: Generator self-check - allowlist must exist in 05/06
LATEST="$(ls -1dt /tmp/ft_proof_phase4_* 2>/dev/null | head -1)"
test -f "$LATEST/05_no_outbound_attestation.json" || { echo "FAIL-CLOSED: missing 05"; exit 1; }
test -f "$LATEST/06_no_mutation_attestation.json" || { echo "FAIL-CLOSED: missing 06"; exit 1; }

node - <<NODE
const fs=require("fs");
const p=(f)=>JSON.parse(fs.readFileSync(f,"utf8"));
const a=p("$LATEST/05_no_outbound_attestation.json").allowlist;
const b=p("$LATEST/06_no_mutation_attestation.json").allowlist;
if(!a||!a.version||!a.sha256) throw new Error("missing allowlist in 05");
if(!b||!b.version||!b.sha256) throw new Error("missing allowlist in 06");
process.stdout.write("FT_PROOF:PHASE4_ALLOWLIST_PRESENT_OK\n");
NODE

echo "FT_PROOF:PHASE4_BUNDLE_SUCCESS"
