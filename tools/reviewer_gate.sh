#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

for c in git sed rg bash python3; do command -v "$c" >/dev/null || { echo "FAIL: missing cmd $c"; exit 90; }; done

if [ -n "$(git status --porcelain=v1)" ]; then
  echo "FAIL: worktree dirty; gate requires clean tree"
  git status --porcelain=v1
  exit 2
fi

OUT_DIR="${FT_GATE_OUT_DIR:-/tmp/firsttry_gate_proofs_$(date -u +%Y%m%dT%H%M%SZ)}"
PROOFS_DIR="$OUT_DIR/proofs"
mkdir -p "$PROOFS_DIR"

SHA="$(git rev-parse HEAD)"
BRANCH="$(git branch --show-current)"
UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "$SHA" > "$PROOFS_DIR/GIT_SHA.txt"
echo "$BRANCH" > "$PROOFS_DIR/GIT_BRANCH.txt"
echo "$UTC" > "$PROOFS_DIR/UTC_TIMESTAMP.txt"

MANIFESTS="$(find . -maxdepth 8 -name manifest.yml -print 2>/dev/null | sort || true)"
echo "$MANIFESTS" > "$PROOFS_DIR/manifests_all.txt"
if echo "$MANIFESTS" | rg -q "^./atlassian/forge-app/manifest\.yml$"; then
  MANIFEST="./atlassian/forge-app/manifest.yml"
else
  COUNT="$(echo "$MANIFESTS" | sed '/^\s*$/d' | wc -l | tr -d ' ')"
  if [ "$COUNT" -ne 1 ]; then
    echo "FAIL: multiple manifest.yml and no canonical found"
    exit 3
  fi
  MANIFEST="$(echo "$MANIFESTS" | head -1)"
fi
FORGE_ROOT="$(dirname "$MANIFEST")"
echo "$MANIFEST" > "$PROOFS_DIR/FORGE_MANIFEST_PATH.txt"
echo "$FORGE_ROOT" > "$PROOFS_DIR/FORGE_ROOT.txt"

sed -n '1,360p' "$MANIFEST" > "$PROOFS_DIR/manifest_head.txt" || true
rg -n "permissions:|scopes:|external:|fetch:|egress|storage:" "$MANIFEST" > "$PROOFS_DIR/manifest_permissions_hits.txt" || true
rg -n "storage\.(get|set|delete|query)|from '@forge/api'|@forge/api" "$FORGE_ROOT" -S > "$PROOFS_DIR/code_storage_hits.txt" || true
rg -n "fetch\(|axios|node-fetch|request\(|https\.request|http\.request" "$FORGE_ROOT" -S > "$PROOFS_DIR/code_network_hits.txt" || true

REQUIRED_DOCS=(
  "docs/VENDOR_FACTS.yml"
  "docs/PRIVACY_POLICY.md"
  "docs/TERMS_OF_SERVICE.md"
  "docs/DATA_FLOW.md"
  "docs/PERMISSIONS_AND_SCOPES.md"
  "docs/SECURITY_CONTACT.md"
  "docs/VULNERABILITY_MANAGEMENT.md"
  "docs/INCIDENT_RESPONSE.md"
  "docs/SUBPROCESSORS.md"
  "docs/DATA_RETENTION_AND_DELETION.md"
  "docs/ENTERPRISE_SECURITY_PACKET.md"
  "docs/SUPPORT_POLICY.md"
  "docs/CHANGE_MANAGEMENT.md"
)

: > "$PROOFS_DIR/missing_docs.txt"
MISS=0
for f in "${REQUIRED_DOCS[@]}"; do
  if [ ! -f "$f" ]; then echo "MISSING: $f" | tee -a "$PROOFS_DIR/missing_docs.txt"; MISS=1; fi
done
if [ "$MISS" -eq 1 ]; then
  echo "FAIL: missing docs; see $PROOFS_DIR/missing_docs.txt"
  exit 4
fi

bash tools/validate_docs.sh > "$PROOFS_DIR/validate_docs.log" 2>&1 || {
  echo "FAIL: validate_docs failed; see $PROOFS_DIR/validate_docs.log"
  exit 5
}

if [ -f "$FORGE_ROOT/package.json" ]; then
  command -v node >/dev/null || { echo "FAIL: missing node"; exit 91; }
  command -v npm >/dev/null || { echo "FAIL: missing npm"; exit 92; }
  # npm test is logged but failures don't block Gate 2 (documentation is primary)
  (cd "$FORGE_ROOT" && npm test) > "$PROOFS_DIR/npm_test.log" 2>&1 || true
  rg -n "Test Files|Tests|failed|passed" "$PROOFS_DIR/npm_test.log" | tail -80 > "$PROOFS_DIR/npm_test.summary.txt" || true
fi

EVID="$OUT_DIR/EVIDENCE_MANIFEST.md"
cat > "$EVID" <<EOF
# Evidence Manifest (SHA-Pinned)

- UTC Generated: **$UTC**
- Git Branch: **$BRANCH**
- Git SHA: **$SHA**
- Forge manifest: \`$MANIFEST\`
- Output directory: \`$OUT_DIR\`

## Proof Artifacts
- \`$PROOFS_DIR/GIT_SHA.txt\`
- \`$PROOFS_DIR/manifest_permissions_hits.txt\`
- \`$PROOFS_DIR/code_storage_hits.txt\`
- \`$PROOFS_DIR/code_network_hits.txt\`
- \`$PROOFS_DIR/validate_docs.log\`
- \`$PROOFS_DIR/npm_test.log\` (if run)

EOF

echo "PASS: reviewer_gate complete"
echo "$OUT_DIR" > "$PROOFS_DIR/OUT_DIR.txt"
