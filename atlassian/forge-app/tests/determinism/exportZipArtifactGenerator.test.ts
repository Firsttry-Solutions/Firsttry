/**
 * Export ZIP Artifact Generator for Phase 06 Contamination Scanning
 * 
 * Generates the actual customer-delivered ZIP file using the same code path
 * as the export resolver (buildZipArchive).
 * 
 * This tests the FINAL artifact that customers download, not just pack files.
 * 
 * Used by: tools/audit/v3_1/lib/determinism.sh
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";
import { ReviewExportPack } from "../../src/export/reviewPack";
import { makeDeterministicZip, ZipInputFile } from "../../src/zip/deterministicZip";

/**
 * Minimal valid closed workflow (deterministic)
 */
function createDeterministicWorkflow(): any {
  const fixedUtc = "2026-02-14T00:00:00Z";
  return {
    reviewId: "zip-artifact-scan-001",
    status: "closed",
    createdAt: fixedUtc,
    closedAt: fixedUtc,
    snapshotHash: "deterministic0002",
    canonicalHash: "dcba4321567890dcba4321567890dcba4321567890dcba4321567890dcba4321",
    items: {
      "user:ziptest": {
        entityId: "user:ziptest",
        entityType: "user",
        privilegeSummary: "viewer",
        riskLevel: "low",
        addedAt: fixedUtc,
      },
    },
    decisions: {
      "user:ziptest": [
        {
          reviewerAccountId: "reviewer-zip-deterministic",
          decision: "approved",
          timestamp: fixedUtc,
        },
      ],
    },
    exceptions: [],
    reviewers: ["reviewer-zip-deterministic"],
    progress: 100,
    complianceScore: 100,
    buildVersion: "0.0.1-zip-deterministic",
    siteId: "test-site-zip-deterministic",
  };
}

/**
 * Convert pack files to ZIP using the same builder as the resolver
 */
function buildZipArchive(files: Record<string, string>): Buffer {
  const encoder = new TextEncoder();
  const zipInputFiles: ZipInputFile[] = Object.keys(files).map(name => ({
    path: name,
    bytes: encoder.encode(files[name]),
  }));
  const zipBytes = makeDeterministicZip(zipInputFiles);
  
  // Validate PK header (same validation as resolver)
  if (zipBytes.length < 4 || zipBytes[0] !== 0x50 || zipBytes[1] !== 0x4B || zipBytes[2] !== 0x03 || zipBytes[3] !== 0x04) {
    throw new Error('[FT_ZIP_HEADER_INVALID] ZIP output does not start with PK header');
  }
  
  return Buffer.from(zipBytes);
}

describe("Export ZIP Artifact Generator", () => {
  it("should generate customer-delivered ZIP for contamination scanning", () => {
    const buildSha = "deterministic-zip-build-sha";
    const fixedGenAt = "2026-02-14T00:00:00Z";
    
    // Generate pack files
    const workflow = createDeterministicWorkflow();
    const files = ReviewExportPack.generatePackFiles(workflow, buildSha, {
      generatedAt: fixedGenAt,
    });

    // Verify files were generated
    expect(files).toBeDefined();
    expect(Object.keys(files).length).toBeGreaterThan(0);

    // Build ZIP using the same code path as the resolver
    const zipBuffer = buildZipArchive(files);
    expect(zipBuffer.length).toBeGreaterThan(0);

    // Verify PK header
    expect(zipBuffer[0]).toBe(0x50); // 'P'
    expect(zipBuffer[1]).toBe(0x4B); // 'K'
    expect(zipBuffer[2]).toBe(0x03);
    expect(zipBuffer[3]).toBe(0x04);

    // If FT_EXPORT_ARTIFACT_DIR is set, write ZIP to disk for Phase 06 contamination scanning
    // If not set, test passes after basic ZIP validation (not in audit mode)
    const outputDir = process.env.FT_EXPORT_ARTIFACT_DIR;
    if (!outputDir) {
      console.log('[FT_EXPORT_ZIP_ARTIFACT_GEN_SKIP] FT_EXPORT_ARTIFACT_DIR not set, skipping artifact write (not in audit mode)');
      return;
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const zipPath = path.join(outputDir, "export_pack.zip");
    fs.writeFileSync(zipPath, zipBuffer);

    console.log(`[FT_EXPORT_ZIP_ARTIFACT_GEN_SUCCESS] Generated ZIP at ${zipPath}`);
    console.log(`  Size: ${zipBuffer.length} bytes`);
    console.log(`  Files in archive: ${Object.keys(files).length}`);
    console.log("[FT_EXPORT_ZIP_ARTIFACT_GEN_PASS]");
  });
});
