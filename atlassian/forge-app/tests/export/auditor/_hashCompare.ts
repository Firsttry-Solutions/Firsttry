/**
 * PHASE 5.1.5 E2E Hash Comparison
 * FT_PROOF_HASH_COMPARE_v1: Validates critical artifact hashes against manifest
 * FT_PROOF_HASH_COMPARE_CRITICAL_ONLY_v1: Compares ONLY critical artifacts (evidence + scripts)
 *
 * Computes SHA-256 for:
 * - artifacts/evidence.json
 * - artifacts/verify.sh
 * - artifacts/verify.ps1
 *
 * Reads manifest and compares:
 * - evidenceSha256
 * - verifyShSha256
 * - verifyPs1Sha256
 *
 * FAIL if:
 * - Any critical hash mismatch
 * - Manifest contains htmlSha256 (disallowed)
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
  console.log(`[FT_PROOF_HASH_COMPARE_CRITICAL_ONLY_v1] RUN_DIR: ${runDir}`);

  // Paths
  const htmlPath = path.join(runDir, "FirstTry-Audit-Evidence.html");
  const artifactDir = path.join(runDir, "artifacts");
  const evidencePath = path.join(artifactDir, "evidence.json");
  const manifestPath = path.join(artifactDir, "manifest.json");
  const verifyShPath = path.join(artifactDir, "verify.sh");
  const verifyPs1Path = path.join(artifactDir, "verify.ps1");

  // Verify critical files exist
  if (!fs.existsSync(manifestPath))
    throw new Error(`Manifest not found: ${manifestPath}`);
  if (!fs.existsSync(evidencePath))
    throw new Error(`Evidence not found: ${evidencePath}`);
  if (!fs.existsSync(verifyShPath))
    throw new Error(`verify.sh not found: ${verifyShPath}`);
  if (!fs.existsSync(verifyPs1Path))
    throw new Error(`verify.ps1 not found: ${verifyPs1Path}`);

  console.log(`[FT_PROOF_HASH_COMPARE_CRITICAL_ONLY_v1] Reading manifest...`);
  const manifestJson = JSON.parse(
    fs.readFileSync(manifestPath, "utf-8")
  ) as Record<string, any>;

  // FAIL if manifest contains htmlSha256 (disallowed in Phase 5.1.5)
  if (manifestJson.htmlSha256) {
    console.error(
      `❌ FT_PROOF_HASH_COMPARE_CRITICAL_ONLY_v1: FAIL - Manifest contains forbidden htmlSha256 field`
    );
    console.error(`   This violates the Phase 5.1.5 constraint: HTML is a container, not independently verified`);
    process.exit(1);
  }

  // Expected hashes from manifest (CRITICAL artifacts only)
  const expectedEvidenceSha = manifestJson.evidenceSha256;
  const expectedVerifyShSha = manifestJson.verifyShSha256;
  const expectedVerifyPs1Sha = manifestJson.verifyPs1Sha256;

  if (!expectedEvidenceSha)
    throw new Error("Manifest missing evidenceSha256");
  if (!expectedVerifyShSha) throw new Error("Manifest missing verifyShSha256");
  if (!expectedVerifyPs1Sha) throw new Error("Manifest missing verifyPs1Sha256");

  console.log(`[FT_PROOF_HASH_COMPARE_CRITICAL_ONLY_v1] Computing actual hashes...`);

  // Compute actual hashes (CRITICAL artifacts only)
  const evidenceBytes = fs.readFileSync(evidencePath);
  const actualEvidenceSha = computeSha256(evidenceBytes);

  const verifyShBytes = fs.readFileSync(verifyShPath);
  const actualVerifyShSha = computeSha256(verifyShBytes);

  const verifyPs1Bytes = fs.readFileSync(verifyPs1Path);
  const actualVerifyPs1Sha = computeSha256(verifyPs1Bytes);

  // Compare (CRITICAL artifacts only)
  const artifacts = {
    evidence_json: {
      expected: expectedEvidenceSha,
      actual: actualEvidenceSha,
      match: expectedEvidenceSha === actualEvidenceSha,
      size: evidenceBytes.length,
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

  // Compute summary (CRITICAL artifacts: 3/3)
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

  // Print report (CRITICAL artifacts only)
  console.log(`\n[FT_PROOF_HASH_COMPARE_CRITICAL_ONLY_v1] Results:`);
  console.log(`  evidence.json:    ${report.artifacts.evidence_json.match ? "✅ PASS" : "❌ FAIL"}`);
  if (!report.artifacts.evidence_json.match) {
    console.log(`    Expected: ${report.artifacts.evidence_json.expected}`);
    console.log(`    Actual:   ${report.artifacts.evidence_json.actual}`);
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

  // Summary: 3/3 critical artifacts must pass
  const criticalPassed = [
    report.artifacts.evidence_json.match,
    report.artifacts.verify_sh.match,
    report.artifacts.verify_ps1.match,
  ].filter((x) => x).length;

  console.log(`\n[FT_PROOF_HASH_COMPARE_CRITICAL_ONLY_v1] Summary: ${criticalPassed}/3 critical artifacts verified`);

  // Write report
  const reportPath = path.join(runDir, "hash_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.log(`[FT_PROOF_HASH_COMPARE_CRITICAL_ONLY_v1] Report written to ${reportPath}`);

  // Fail if critical artifacts don't match (evidence + scripts MUST match)
  const criticalFailed = 3 - criticalPassed;
  if (criticalFailed > 0) {
    console.error(
      `❌ FT_PROOF_HASH_COMPARE_CRITICAL_ONLY_v1: Hash validation FAILED (${criticalFailed} critical mismatches)`
    );
    process.exit(1);
  }

  console.log(`\n✅ FT_PROOF_HASH_COMPARE_CRITICAL_ONLY_v1: All 3 critical hashes match!`);
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
