#!/usr/bin/env bash
set -euo pipefail

echo "FT_PROOF:PHASE4_VERIFY_START"

LATEST="$(ls -1dt /tmp/ft_proof_phase4_* 2>/dev/null | head -1 || true)"
if [ -z "$LATEST" ]; then
  echo "No proof bundle directory found under /tmp/ft_proof_phase4_*"
  exit 1
fi

echo "FT_PROOF:PHASE4_VERIFY_DIR=$LATEST"

REQ=(
  "00_manifest.json"
  "01_scope_freeze.json"
  "02_schema_lock.json"
  "03_build_identity.json"
  "04_runtime_invariants.json"
  "05_no_outbound_attestation.json"
  "06_no_mutation_attestation.json"
  "07_hash_chain.json"
  "08_bundle_index.json"
  "09_bundle_hash.txt"
)

for f in "${REQ[@]}"; do
  if [ ! -f "$LATEST/$f" ]; then
    echo "Missing required artifact: $f"
    exit 1
  fi
done

# 1) Verify 09 bundle hash equals manifest bundleSha256
BUNDLE_SHA_FILE="$(cat "$LATEST/09_bundle_hash.txt" | tr -d '\n')"
MANIFEST_SHA="$(node -e 'const fs=require("fs"); const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(m.bundleSha256);' "$LATEST/00_manifest.json")"

if [ "$BUNDLE_SHA_FILE" != "$MANIFEST_SHA" ]; then
  echo "Bundle hash mismatch (09_bundle_hash.txt != 00_manifest.json bundleSha256)"
  exit 1
fi

# 2) Verify each manifest artifact sha256 matches file bytes
node - <<'NODE'
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

function sha256File(p){
  const b = fs.readFileSync(p);
  return crypto.createHash("sha256").update(b).digest("hex");
}

const dir = process.argv[1];
const manifest = JSON.parse(fs.readFileSync(path.join(dir,"00_manifest.json"),"utf8"));
if (!manifest.artifacts || !Array.isArray(manifest.artifacts)) throw new Error("manifest.artifacts missing");

for (const a of manifest.artifacts){
  const fp = path.join(dir, a.path);
  if (!fs.existsSync(fp)) throw new Error("artifact missing: " + a.path);
  const h = sha256File(fp);
  if (h !== a.sha256) throw new Error(`artifact hash mismatch: ${a.path}\nexpected ${a.sha256}\nactual   ${h}`);
}
process.stdout.write("OK");
NODE
"$LATEST"
echo ""

# 3) Recompute core bundleSha256 from algorithm (01–07 only) using canonical JSON
node - <<'NODE'
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

function canonicalJsonStringify(value){
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite number not allowed");
    if (Object.is(value, -0)) return "0";
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJsonStringify).join(",") + "]";
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalJsonStringify(value[k])).join(",") + "}";
  }
  throw new Error("Unsupported type");
}

function sha256HexUtf8(s){
  return crypto.createHash("sha256").update(Buffer.from(s,"utf8")).digest("hex");
}

const dir = process.argv[1];
const manifest = JSON.parse(fs.readFileSync(path.join(dir,"00_manifest.json"),"utf8"));

const coreArtifactsList = (manifest.bundleSha256Algorithm && manifest.bundleSha256Algorithm.coreArtifacts) || [
  "01_scope_freeze.json",
  "02_schema_lock.json",
  "03_build_identity.json",
  "04_runtime_invariants.json",
  "05_no_outbound_attestation.json",
  "06_no_mutation_attestation.json",
  "07_hash_chain.json"
];

const coreSet = new Set(coreArtifactsList);
const coreArtifacts = manifest.artifacts.filter(a => coreSet.has(a.path));

if (coreArtifacts.length !== coreSet.size) {
  throw new Error("Core artifacts mismatch: expected " + coreSet.size + " got " + coreArtifacts.length);
}

// Ensure deterministic order: exactly in coreArtifactsList order
const coreArtifactsOrdered = coreArtifactsList.map(p => {
  const found = coreArtifacts.find(a => a.path === p);
  if (!found) throw new Error("Missing core artifact in manifest: " + p);
  return found;
});

const coreInput = {
  schema: "ft.proofBundleCore.v1",
  bundleCreatedUtc: manifest.bundleCreatedUtc,
  siteId: manifest.siteId,
  appId: manifest.appId,
  environment: manifest.environment,
  buildShaShort: manifest.buildShaShort,
  buildUtc: manifest.buildUtc,
  ruleSetVersion: manifest.ruleSetVersion,
  schemaVersion: manifest.schemaVersion,
  artifacts: coreArtifactsOrdered
};

const canon = canonicalJsonStringify(coreInput);
const recomputed = sha256HexUtf8(canon);

if (recomputed !== manifest.bundleSha256) {
  throw new Error("bundleSha256 mismatch (recomputed core != manifest)\nrecomputed " + recomputed + "\nmanifest    " + manifest.bundleSha256);
}

process.stdout.write("OK");
NODE
"$LATEST"
echo ""
echo "FT_PROOF:PHASE4_VERIFY_BUNDLE_SHA_RECOMPUTE_OK"

echo "FT_PROOF:PHASE4_VERIFY_SUCCESS"
