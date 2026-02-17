/**
 * PHASE 5.1.4 E2E Hash Comparison
 * FT_PROOF_HASH_COMPARE_v1: Validates all artifact hashes against manifest
 *
 * Computes SHA-256 for:
 * - artifacts/evidence.json
 * - artifacts/verify.sh
 * - artifacts/verify.ps1
 * - FirstTry-Audit-Evidence.html (final HTML bytes)
 *
 * Reads manifest and compares:
 * - evidenceSha256
 * - htmlSha256
 * - verifyShSha256
 * - verifyPs1Sha256
 *
 * Fails if any mismatch.
 *
 * Usage: node _hashCompare.ts RUN_DIR
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

interface HashReport {
  timestamp: string;
  artifacts: Record<
    string,
    {
      expected: string;
      actual: string;
      match: boolean;
      size: number;
    }
  >;
  summary: {
    total_artifacts: number;
    passed: number;
    failed: number;
    all_match: boolean;
  };
}

function computeSha256(data: Buffer | string): string {
  const hash = crypto.createHash("sha256");
  if (typeof data === "string") {
    hash.update(data, "utf-8");
  } else {
    hash.update(data);
  }
  return hash.digest("hex");
}

async function compareHashes(runDir: string): Promise<void> {
  console.log(`[HashCompare] RUN_DIR: ${runDir}`);

  // Paths
  const htmlPath = path.join(runDir, "FirstTry-Audit-Evidence.html");
  const artifactDir = path.join(runDir, "artifacts");
  const evidencePath = path.join(artifactDir, "evidence.json");
  const manifestPath = path.join(artifactDir, "manifest.json");
  const verifyShPath = path.join(artifactDir, "verify.sh");
  const verifyPs1Path = path.join(artifactDir, "verify.ps1");

  // Verify files exist
  if (!fs.existsSync(htmlPath)) throw new Error(`HTML not found: ${htmlPath}`);
  if (!fs.existsSync(manifestPath))
    throw new Error(`Manifest not found: ${manifestPath}`);
  if (!fs.existsSync(evidencePath))
    throw new Error(`Evidence not found: ${evidencePath}`);
  if (!fs.existsSync(verifyShPath))
    throw new Error(`verify.sh not found: ${verifyShPath}`);
  if (!fs.existsSync(verifyPs1Path))
    throw new Error(`verify.ps1 not found: ${verifyPs1Path}`);

  console.log(`[HashCompare] Reading manifest...`);
  const manifestJson = JSON.parse(
    fs.readFileSync(manifestPath, "utf-8")
  ) as Record<string, any>;

  // Expected hashes from manifest
  const expectedEvidenceSha = manifestJson.evidenceSha256;
  const expectedHtmlSha = manifestJson.htmlSha256;
  const expectedVerifyShSha = manifestJson.verifyShSha256;
  const expectedVerifyPs1Sha = manifestJson.verifyPs1Sha256;

  if (!expectedEvidenceSha)
    throw new Error("Manifest missing evidenceSha256");
  if (!expectedHtmlSha) throw new Error("Manifest missing htmlSha256");
  if (!expectedVerifyShSha) throw new Error("Manifest missing verifyShSha256");
  if (!expectedVerifyPs1Sha) throw new Error("Manifest missing verifyPs1Sha256");

  console.log(`[HashCompare] Computing actual hashes...`);

  // Compute actual hashes
  const evidenceBytes = fs.readFileSync(evidencePath);
  const actualEvidenceSha = computeSha256(evidenceBytes);

  const htmlBytes = fs.readFileSync(htmlPath);
  const actualHtmlSha = computeSha256(htmlBytes);

  const verifyShBytes = fs.readFileSync(verifyShPath);
  const actualVerifyShSha = computeSha256(verifyShBytes);

  const verifyPs1Bytes = fs.readFileSync(verifyPs1Path);
  const actualVerifyPs1Sha = computeSha256(verifyPs1Bytes);

  // Compare
  const artifacts = {
    evidence_json: {
      expected: expectedEvidenceSha,
      actual: actualEvidenceSha,
      match: expectedEvidenceSha === actualEvidenceSha,
      size: evidenceBytes.length,
    },
    html_report: {
      expected: expectedHtmlSha,
      actual: actualHtmlSha,
      match: expectedHtmlSha === actualHtmlSha,
      size: htmlBytes.length,
    },
    verify_sh: {
      expected: expectedVerifyShSha,
      actual: actualVerifyShSha,
      match: expectedVerifyShSha === actualVerifyShSha,
      size: verifyShBytes.length,
    },
    verify_ps1: {
      expected: expectedVerifyPs1Sha,
      actual: actualVerifyPs1Sha,
      match: expectedVerifyPs1Sha === actualVerifyPs1Sha,
      size: verifyPs1Bytes.length,
    },
  };

  // Compute summary
  const artifactEntries = Object.entries(artifacts);
  const passCount = artifactEntries.filter(([_, a]) => a.match).length;
  const failCount = artifactEntries.length - passCount;

  const report: HashReport = {
    timestamp: new Date().toISOString(),
    artifacts,
    summary: {
      total_artifacts: artifactEntries.length,
      passed: passCount,
      failed: failCount,
      all_match: failCount === 0,
    },
  };

  // Print report
  console.log(`\n[HashCompare] Results:`);
  console.log(`  evidence.json:    ${report.artifacts.evidence_json.match ? "✅ PASS" : "❌ FAIL"}`);
  if (!report.artifacts.evidence_json.match) {
    console.log(`    Expected: ${report.artifacts.evidence_json.expected}`);
    console.log(`    Actual:   ${report.artifacts.evidence_json.actual}`);
  }

  console.log(`  HTML report:      ${report.artifacts.html_report.match ? "✅ PASS" : "❌ FAIL"}`);
  if (!report.artifacts.html_report.match) {
    console.log(`    Expected: ${report.artifacts.html_report.expected}`);
    console.log(`    Actual:   ${report.artifacts.html_report.actual}`);
  }

  console.log(`  verify.sh:        ${report.artifacts.verify_sh.match ? "✅ PASS" : "❌ FAIL"}`);
  if (!report.artifacts.verify_sh.match) {
    console.log(`    Expected: ${report.artifacts.verify_sh.expected}`);
    console.log(`    Actual:   ${report.artifacts.verify_sh.actual}`);
  }

  console.log(`  verify.ps1:       ${report.artifacts.verify_ps1.match ? "✅ PASS" : "❌ FAIL"}`);
  if (!report.artifacts.verify_ps1.match) {
    console.log(`    Expected: ${report.artifacts.verify_ps1.expected}`);
    console.log(`    Actual:   ${report.artifacts.verify_ps1.actual}`);
  }

  console.log(`\n[HashCompare] Summary: ${report.summary.passed}/${report.summary.total_artifacts} passed`);

  // Write report
  const reportPath = path.join(runDir, "hash_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`[HashCompare] Report written to ${reportPath}`);

  // Fail if any mismatch
  if (!report.summary.all_match) {
    console.error(
      `❌ FT_PROOF_HASH_COMPARE_v1: Hash validation FAILED (${report.summary.failed} mismatches)`
    );
    process.exit(1);
  }

  console.log(`\n✅ FT_PROOF_HASH_COMPARE_v1: All hashes match!`);
}

// Main
const runDir = process.argv[2];
if (!runDir) {
  console.error("Usage: node _hashCompare.ts RUN_DIR");
  process.exit(1);
}

compareHashes(runDir).catch((err) => {
  console.error(`❌ Hash comparison failed: ${err.message}`);
  process.exit(1);
});
