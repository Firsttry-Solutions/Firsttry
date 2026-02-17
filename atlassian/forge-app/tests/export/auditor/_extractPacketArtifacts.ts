/**
 * PHASE 5.1.4 E2E Artifact Extraction
 * FT_PROOF_EXTRACT_ARTIFACTS_v1: Extract embedded artifacts from HTML packet
 *
 * Reads the HTML file and extracts:
 * - EVIDENCE_BASE64 → artifacts/evidence.json
 * - MANIFEST_BASE64 → artifacts/manifest.json
 * - VERIFY_SH → artifacts/verify.sh
 * - VERIFY_PS1 → artifacts/verify.ps1
 *
 * Usage: node _extractPacketArtifacts.ts RUN_DIR
 */

import * as fs from "fs";
import * as path from "path";

function extractB64Constant(html: string, constName: string): string | null {
  // Regex to match: const NAME = "base64...";
  const regex = new RegExp(`const\\s+${constName}\\s*=\\s*"([^"]+)"`, "s");
  const match = html.match(regex);
  if (!match || !match[1]) {
    console.error(`❌ Could not find ${constName} in HTML`);
    return null;
  }
  return match[1];
}

async function extractArtifacts(runDir: string): Promise<void> {
  console.log(`[Extract] RUN_DIR: ${runDir}`);

  const htmlPath = path.join(runDir, "FirstTry-Audit-Evidence.html");
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`HTML not found: ${htmlPath}`);
  }

  console.log(`[Extract] Reading HTML: ${htmlPath}`);
  const htmlContent = fs.readFileSync(htmlPath, "utf-8");

  // Extract constants from HTML
  const evidenceB64 = extractB64Constant(htmlContent, "EVIDENCE_BASE64");
  const manifestB64 = extractB64Constant(htmlContent, "MANIFEST_BASE64");
  const verifyShB64 = extractB64Constant(htmlContent, "VERIFY_SH");
  const verifyPs1B64 = extractB64Constant(htmlContent, "VERIFY_PS1");

  if (!evidenceB64) throw new Error("EVIDENCE_BASE64 not found");
  if (!manifestB64) throw new Error("MANIFEST_BASE64 not found");

  // Create artifacts directory
  const artifactDir = path.join(runDir, "artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });
  console.log(`[Extract] Artifact directory: ${artifactDir}`);

  // Decode and write artifacts
  const artifacts: Record<
    string,
    { size: number; first32: string; last32: string }
  > = {};

  // 1. Evidence JSON
  const evidenceJson = Buffer.from(evidenceB64, "base64").toString("utf-8");
  const evidencePath = path.join(artifactDir, "evidence.json");
  fs.writeFileSync(evidencePath, evidenceJson, "utf-8");
  artifacts.evidence_json = {
    size: evidenceJson.length,
    first32: evidenceJson.substring(0, 32),
    last32: evidenceJson.substring(Math.max(0, evidenceJson.length - 32)),
  };
  console.log(`✅ Extracted evidence.json (${evidenceJson.length} bytes)`);

  // 2. Manifest JSON
  const manifestJson = Buffer.from(manifestB64, "base64").toString("utf-8");
  const manifestPath = path.join(artifactDir, "manifest.json");
  fs.writeFileSync(manifestPath, manifestJson, "utf-8");
  artifacts.manifest_json = {
    size: manifestJson.length,
    first32: manifestJson.substring(0, 32),
    last32: manifestJson.substring(Math.max(0, manifestJson.length - 32)),
  };
  console.log(`✅ Extracted manifest.json (${manifestJson.length} bytes)`);

  // 3. verify.sh (optional but expected)
  if (verifyShB64) {
    const verifySh = Buffer.from(verifyShB64, "base64").toString("utf-8");
    const verifyShPath = path.join(artifactDir, "verify.sh");
    fs.writeFileSync(verifyShPath, verifySh, "utf-8");
    artifacts.verify_sh = {
      size: verifySh.length,
      first32: verifySh.substring(0, 32),
      last32: verifySh.substring(Math.max(0, verifySh.length - 32)),
    };
    console.log(`✅ Extracted verify.sh (${verifySh.length} bytes)`);
  } else {
    console.warn(`⚠️  VERIFY_SH not found in HTML (will fail STEP 6)`);
  }

  // 4. verify.ps1 (optional but expected)
  if (verifyPs1B64) {
    const verifyPs1 = Buffer.from(verifyPs1B64, "base64").toString("utf-8");
    const verifyPs1Path = path.join(artifactDir, "verify.ps1");
    fs.writeFileSync(verifyPs1Path, verifyPs1, "utf-8");
    artifacts.verify_ps1 = {
      size: verifyPs1.length,
      first32: verifyPs1.substring(0, 32),
      last32: verifyPs1.substring(Math.max(0, verifyPs1.length - 32)),
    };
    console.log(`✅ Extracted verify.ps1 (${verifyPs1.length} bytes)`);
  } else {
    console.warn(`⚠️  VERIFY_PS1 not found in HTML (optional for STEP 7)`);
  }

  // Write summary
  const summaryPath = path.join(artifactDir, "extract_summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(artifacts, null, 2), "utf-8");
  console.log(`✅ Wrote extraction summary to ${summaryPath}`);

  // List artifacts directory
  console.log(`\n[Extract] Artifacts directory contents:`);
  const files = fs.readdirSync(artifactDir);
  files.forEach((f) => {
    const fPath = path.join(artifactDir, f);
    const stat = fs.statSync(fPath);
    console.log(`  ${f} (${stat.size} bytes)`);
  });

  console.log("\n✅ FT_PROOF_EXTRACT_ARTIFACTS_v1: All artifacts extracted");
}

// Main
const runDir = process.argv[2];
if (!runDir) {
  console.error("Usage: node _extractPacketArtifacts.ts RUN_DIR");
  process.exit(1);
}

extractArtifacts(runDir).catch((err) => {
  console.error(`❌ Extraction failed: ${err.message}`);
  process.exit(1);
});
