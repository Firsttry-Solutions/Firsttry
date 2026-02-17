#!/usr/bin/env bash
set -euo pipefail

echo "FT_PROOF:PHASE4_BUNDLE_START"

APP_ROOT="/workspaces/Firsttry/atlassian/forge-app"
cd "$APP_ROOT"

# Compile security files first
echo "Compiling security modules..." >> /dev/null
npx tsc src/security/canonicalJson.ts src/security/hash.ts src/security/canonicalJson.selftest.ts --target es2020 --module commonjs --declaration --outDir dist

# Selftest
node -e "require('./dist/src/security/canonicalJson.selftest.js').runCanonicalSelfTest()"

UTC="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="/tmp/ft_proof_phase4_${UTC}"
mkdir -p "$OUT"

# Required files must exist (in dist/src/security from tsc output)
REQUIRED_FILES=(
  "dist/src/security/canonicalJson.js"
  "dist/src/security/hash.js"
  "dist/src/security/canonicalJson.selftest.js"
)

for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "Missing required file: $f"
    exit 1
  fi
done

echo "FT_PROOF:PHASE4_BUNDLE_DIR=$OUT"
echo "FT_PROOF:PHASE4_BUNDLE_SUCCESS"
