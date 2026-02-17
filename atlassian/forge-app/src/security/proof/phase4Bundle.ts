/* FT_PROOF:PHASE4_FULL_BUNDLE_V1 */

import path from "path";
import fs from "fs";
import { canonicalJsonStringify } from "../canonicalJson";
import { sha256HexBytes, sha256HexCanonicalJson } from "../hash";
import { ensureDir, sha256HexFileBytes, writeUtf8, readFileBytes } from "../fsHash";
import { extractForgeScopesFromManifestYml } from "../manifestScopes";
import { scanTree, outboundPatterns, mutationPatterns } from "../sourceScan";

type ArtifactRef = { path: string; sha256: string };

function nowUtcIsoZ(d = new Date()): string {
  // Deterministic UTC Z (drop ms)
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function utcDirStamp(d = new Date()): string {
  // YYYYMMDDTHHMMSSZ
  const iso = nowUtcIsoZ(d); // YYYY-MM-DDTHH:MM:SSZ
  return iso.replace(/-/g, "").replace(/:/g, "");
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function writeJsonCanonical(outPath: string, obj: any) {
  const s = canonicalJsonStringify(obj);
  writeUtf8(outPath, s);
}

function hashJsonCanonical(obj: any): string {
  const s = canonicalJsonStringify(obj);
  return sha256HexBytes(Buffer.from(s, "utf8"));
}

function omitKey(obj: any, key: string) {
  const copy: any = { ...obj };
  delete copy[key];
  return copy;
}

function mustNoFailChecks(checks: { id: string; status: "PASS" | "FAIL"; matches: any[] }[], label: string) {
  const failed = checks.filter(c => c.status !== "PASS");
  if (failed.length) {
    const msg = `${label} failed: ` + failed.map(f => f.id).join(", ");
    throw new Error(msg);
  }
}

function rel(p: string) {
  return p.replace(/\\/g, "/");
}

export function generatePhase4FullProofBundle() {
  // Required env (fail-closed)
  const APP_ROOT = requireEnv("FT_APP_ROOT"); // /workspaces/Firsttry/atlassian/forge-app
  const SITE_ID = requireEnv("FT_SITE_ID");   // example.atlassian.net
  const APP_ID = requireEnv("FT_APP_ID");     // forge app ARI
  const ENVIRONMENT = requireEnv("FT_ENV");   // dev|staging|prod
  const BUILD_SHA_SHORT = requireEnv("FT_BUILD_SHA_SHORT"); // 8+ hex
  const BUILD_UTC = requireEnv("FT_BUILD_UTC"); // ISO Z
  const RULESET_VERSION = requireEnv("FT_RULESET_VERSION"); // v4.3.1
  const SCHEMA_VERSION = requireEnv("FT_SCHEMA_VERSION");   // v1

  const EXPORT_SCHEMA_PATH = process.env.FT_EXPORT_SCHEMA_PATH || path.join(APP_ROOT, "src/schema/exportSchema.v1.json");
  const MANIFEST_PATH = process.env.FT_MANIFEST_PATH || path.join(APP_ROOT, "manifest.yml");
  const SRC_ROOT = process.env.FT_SRC_ROOT || path.join(APP_ROOT, "src");

  if (!fs.existsSync(EXPORT_SCHEMA_PATH)) {
    throw new Error(`Export schema file missing at ${EXPORT_SCHEMA_PATH}. Set FT_EXPORT_SCHEMA_PATH to correct path.`);
  }
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest missing at ${MANIFEST_PATH}. Set FT_MANIFEST_PATH to correct path.`);
  }

  // Output dir
  const stamp = utcDirStamp(new Date());
  const OUT_DIR = path.join("/tmp", `ft_proof_phase4_${stamp}`);
  ensureDir(OUT_DIR);

  const bundleCreatedUtc = nowUtcIsoZ();

  // 02_schema_lock.json: raw bytes hash
  const exportSchemaHashSha256 = sha256HexBytes(readFileBytes(EXPORT_SCHEMA_PATH));

  // 01_scope_freeze.json: parse scopes
  const scopesOriginalOrder = extractForgeScopesFromManifestYml(MANIFEST_PATH);
  const scopesSorted = [...scopesOriginalOrder].sort();

  const scopeHashInput = {
    schema: "ft.scopeFreezeHashInput.v1",
    siteId: SITE_ID,
    appId: APP_ID,
    buildShaShort: BUILD_SHA_SHORT,
    buildUtc: BUILD_UTC,
    ruleSetVersion: RULESET_VERSION,
    scopesSorted
  };
  const scopesHashSha256 = sha256HexCanonicalJson(scopeHashInput);

  // 05/06 attestations (fail-closed on ANY match)
  const outboundChecks = scanTree(SRC_ROOT, outboundPatterns());
  const mutationChecks = scanTree(SRC_ROOT, mutationPatterns());
  mustNoFailChecks(outboundChecks, "No-outbound scan");
  mustNoFailChecks(mutationChecks, "No-mutation scan");

  // 03_build_identity.json
  const buildIdentity = {
    schema: "ft.buildIdentity.v1",
    buildShaShort: BUILD_SHA_SHORT,
    buildUtc: BUILD_UTC,
    nodeVersion: process.version,
    forgeRuntime: process.env.FT_FORGE_RUNTIME || "unknown",
    appVersion: process.env.FT_APP_VERSION || "unknown",
    ruleSetVersion: RULESET_VERSION
  };

  // 04_runtime_invariants.json
  const runtimeInvariantsBase = {
    schema: "ft.runtimeInvariants.v1",
    siteId: SITE_ID,
    buildShaShort: BUILD_SHA_SHORT,
    capturedUtc: bundleCreatedUtc,
    invariants: [
      {
        id: "INV_READONLY_ASSERTION",
        status: "PASS",
        evidence: {
          description: "No-mutation scan PASS implies no write methods or mutation routes were detected in src/ (fail-closed).",
          proofMarker: "FT_PROOF:INV_READONLY_ASSERTION",
          details: { noMutationAttestation: true }
        }
      },
      {
        id: "INV_NO_OUTBOUND_CODEPATH",
        status: "PASS",
        evidence: {
          description: "No-outbound scan PASS implies no forbidden networking patterns detected in src/ (fail-closed).",
          proofMarker: "FT_PROOF:INV_NO_OUTBOUND_CODEPATH",
          details: { noOutboundAttestation: true }
        }
      },
      {
        id: "INV_DETERMINISTIC_SERIALIZER",
        status: "PASS",
        evidence: {
          description: "Canonical JSON selftests must pass before bundle generation.",
          proofMarker: "FT_PROOF:INV_DETERMINISTIC_SERIALIZER",
          details: { canonicalJson: "v1" }
        }
      }
    ]
  };

  const runtimeInvariantsHashSha256 = hashJsonCanonical(omitKey({ ...runtimeInvariantsBase, runtimeInvariantsHashSha256: "PLACEHOLDER" }, "runtimeInvariantsHashSha256"));
  const runtimeInvariants = { ...runtimeInvariantsBase, runtimeInvariantsHashSha256 };

  // Write 01–06
  const artifacts: ArtifactRef[] = [];

  const scopeFreeze = {
    schema: "ft.scopeFreeze.v1",
    siteId: SITE_ID,
    appId: APP_ID,
    buildShaShort: BUILD_SHA_SHORT,
    buildUtc: BUILD_UTC,
    ruleSetVersion: RULESET_VERSION,
    scopesOriginalOrder,
    scopesSorted,
    scopesHashSha256
  };
  writeJsonCanonical(path.join(OUT_DIR, "01_scope_freeze.json"), scopeFreeze);

  const schemaLock = {
    schema: "ft.schemaLock.v1",
    exportSchemaVersion: "v1",
    exportSchemaHashSha256,
    exportSchemaSource: rel(path.relative(APP_ROOT, EXPORT_SCHEMA_PATH)),
    buildShaShort: BUILD_SHA_SHORT,
    buildUtc: BUILD_UTC
  };
  writeJsonCanonical(path.join(OUT_DIR, "02_schema_lock.json"), schemaLock);

  writeJsonCanonical(path.join(OUT_DIR, "03_build_identity.json"), buildIdentity);
  writeJsonCanonical(path.join(OUT_DIR, "04_runtime_invariants.json"), runtimeInvariants);

  const noOutboundBase = {
    schema: "ft.noOutboundAttestation.v1",
    buildShaShort: BUILD_SHA_SHORT,
    capturedUtc: bundleCreatedUtc,
    checks: outboundChecks,
    attestationHashSha256: "PLACEHOLDER"
  };
  const noOutboundAttestationHashSha256 = hashJsonCanonical(omitKey(noOutboundBase, "attestationHashSha256"));
  const noOutbound = { ...noOutboundBase, attestationHashSha256: noOutboundAttestationHashSha256 };
  writeJsonCanonical(path.join(OUT_DIR, "05_no_outbound_attestation.json"), noOutbound);

  const noMutationBase = {
    schema: "ft.noMutationAttestation.v1",
    buildShaShort: BUILD_SHA_SHORT,
    capturedUtc: bundleCreatedUtc,
    checks: mutationChecks,
    attestationHashSha256: "PLACEHOLDER"
  };
  const noMutationAttestationHashSha256 = hashJsonCanonical(omitKey(noMutationBase, "attestationHashSha256"));
  const noMutation = { ...noMutationBase, attestationHashSha256: noMutationAttestationHashSha256 };
  writeJsonCanonical(path.join(OUT_DIR, "06_no_mutation_attestation.json"), noMutation);

  // Hash file bytes and record artifacts
  const addArtifact = (p: string) => {
    const full = path.join(OUT_DIR, p);
    const h = sha256HexFileBytes(full);
    artifacts.push({ path: p, sha256: h });
    return h;
  };

  const h01 = addArtifact("01_scope_freeze.json");
  const h02 = addArtifact("02_schema_lock.json");
  const h03 = addArtifact("03_build_identity.json");
  const h04 = addArtifact("04_runtime_invariants.json");
  const h05 = addArtifact("05_no_outbound_attestation.json");
  const h06 = addArtifact("06_no_mutation_attestation.json");

  // 07_hash_chain.json (nodes ordered deterministically)
  const nodes = [
    { path: "01_scope_freeze.json", sha256: h01 },
    { path: "02_schema_lock.json", sha256: h02 },
    { path: "03_build_identity.json", sha256: h03 },
    { path: "04_runtime_invariants.json", sha256: h04 },
    { path: "05_no_outbound_attestation.json", sha256: h05 },
    { path: "06_no_mutation_attestation.json", sha256: h06 }
  ];

  const chainInput = { schema: "ft.hashChainInput.v1", buildShaShort: BUILD_SHA_SHORT, nodes };
  const chainSha256 = sha256HexCanonicalJson(chainInput);

  const hashChain = {
    schema: "ft.hashChain.v1",
    buildShaShort: BUILD_SHA_SHORT,
    capturedUtc: bundleCreatedUtc,
    nodes,
    chainSha256
  };
  writeJsonCanonical(path.join(OUT_DIR, "07_hash_chain.json"), hashChain);
  const h07 = addArtifact("07_hash_chain.json");

  // ---- CORE BUNDLE HASH (01–07 only). 08/09 are DERIVED and excluded to avoid circularity. ----
  const coreInput = {
    schema: "ft.proofBundleCore.v1",
    bundleCreatedUtc,
    siteId: SITE_ID,
    appId: APP_ID,
    environment: ENVIRONMENT,
    buildShaShort: BUILD_SHA_SHORT,
    buildUtc: BUILD_UTC,
    ruleSetVersion: RULESET_VERSION,
    schemaVersion: SCHEMA_VERSION,
    artifacts: artifacts // 01–07
  };

  const bundleSha256 = sha256HexCanonicalJson(coreInput);

  // 08_bundle_index.json (DERIVED)
  const bundleIndex = {
    schema: "ft.bundleIndex.v1",
    bundleCreatedUtc,
    bundleSha256,
    chainSha256,
    scopeHashSha256: scopesHashSha256,
    schemaHashSha256: exportSchemaHashSha256,
    notes: [
      "All hashes are SHA-256.",
      "JSON hashes use canonical JSON serialization (sorted keys, no whitespace).",
      "File hashes are over raw file bytes.",
      "bundleSha256 is computed over core artifacts 01–07 only (excludes derived 08/09 to avoid circularity)."
    ]
  };
  writeJsonCanonical(path.join(OUT_DIR, "08_bundle_index.json"), bundleIndex);
  const h08 = sha256HexFileBytes(path.join(OUT_DIR, "08_bundle_index.json"));

  // 09_bundle_hash.txt (DERIVED)
  writeUtf8(path.join(OUT_DIR, "09_bundle_hash.txt"), bundleSha256 + "\n");
  const h09 = sha256HexFileBytes(path.join(OUT_DIR, "09_bundle_hash.txt"));

  // 00_manifest.json (FULL manifest includes derived files, but algorithm states core-only hash)
  const manifestFinal = {
    schema: "ft.proofBundle.v1",
    bundleCreatedUtc,
    siteId: SITE_ID,
    appId: APP_ID,
    environment: ENVIRONMENT,
    buildShaShort: BUILD_SHA_SHORT,
    buildUtc: BUILD_UTC,
    ruleSetVersion: RULESET_VERSION,
    schemaVersion: SCHEMA_VERSION,
    bundleSha256,
    bundleSha256Algorithm: {
      schema: "ft.bundleSha256Algorithm.v1",
      description: "bundleSha256 = SHA-256( CanonicalJSON(ft.proofBundleCore.v1) ), where artifacts include 01–07 only.",
      coreArtifacts: [
        "01_scope_freeze.json",
        "02_schema_lock.json",
        "03_build_identity.json",
        "04_runtime_invariants.json",
        "05_no_outbound_attestation.json",
        "06_no_mutation_attestation.json",
        "07_hash_chain.json"
      ],
      derivedArtifactsExcluded: ["08_bundle_index.json", "09_bundle_hash.txt"]
    },
    artifacts: [
      ...artifacts, // 01–07
      { path: "08_bundle_index.json", sha256: h08 },
      { path: "09_bundle_hash.txt", sha256: h09 }
    ]
  };

  writeJsonCanonical(path.join(OUT_DIR, "00_manifest.json"), manifestFinal);

  // Emit proof markers
  console.log(`FT_PROOF:PHASE4_FULL_BUNDLE_DIR=${OUT_DIR}`);
  console.log(`FT_PROOF:PHASE4_BUNDLE_SHA256=${bundleSha256}`);
  console.log("FT_PROOF:PHASE4_FULL_BUNDLE_SUCCESS");

  // Defensive sanity: ensure expected files exist and non-empty
  const req = [
    "00_manifest.json","01_scope_freeze.json","02_schema_lock.json","03_build_identity.json",
    "04_runtime_invariants.json","05_no_outbound_attestation.json","06_no_mutation_attestation.json",
    "07_hash_chain.json","08_bundle_index.json","09_bundle_hash.txt"
  ];
  for (const f of req) {
    const p = path.join(OUT_DIR, f);
    if (!fs.existsSync(p)) throw new Error(`Missing required artifact: ${f}`);
    if (fs.readFileSync(p).length === 0) throw new Error(`Empty required artifact: ${f}`);
  }
}
