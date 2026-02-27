/**
 * Export Artifact Generator for Phase 06 Contamination Scanning
 * 
 * Generates deterministic export artifacts and writes them to disk
 * for artifact-level scanning (correlationId/UUID leakage detection).
 * 
 * Used by: tools/audit/v3_1/lib/determinism.sh
 * 
 * This is a minimal test that runs the export pack generation
 * and writes artifacts to $FT_EXPORT_ARTIFACT_DIR for scanning.
 */

import * as fs from "fs";
import * as path from "path";
import { describe, it, expect } from "vitest";
import { ReviewExportPack } from "../../src/export/reviewPack";

/**
 * Minimal valid closed workflow (deterministic)
 */
function createDeterministicWorkflow(): any {
  const fixedUtc = "2026-02-14T00:00:00Z";
  return {
    reviewId: "artifact-contamination-scan-001",
    status: "closed",
    createdAt: fixedUtc,
    closedAt: fixedUtc,
    snapshotHash: "deterministic0001",
    canonicalHash: "abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234",
    items: {
      "user:test": {
        entityId: "user:test",
        entityType: "user",
        privilegeSummary: "viewer",
        riskLevel: "low",
        addedAt: fixedUtc,
      },
    },
    decisions: {
      "user:test": [
        {
          reviewerAccountId: "reviewer-deterministic",
          decision: "approved",
          timestamp: fixedUtc,
        },
      ],
    },
    exceptions: [],
    reviewers: ["reviewer-deterministic"],
    progress: 100,
    complianceScore: 100,
    buildVersion: "0.0.1-deterministic",
    siteId: "test-site-deterministic",
  };
}

describe("Export Artifact Generator", () => {
  it("should generate export pack artifacts for contamination scanning", () => {
    const buildSha = "deterministic-build-sha";
    const fixedGenAt = "2026-02-14T00:00:00Z";
    
    const workflow = createDeterministicWorkflow();
    const files = ReviewExportPack.generatePackFiles(workflow, buildSha, {
      generatedAt: fixedGenAt,
    });

    // Verify files were generated
    expect(files).toBeDefined();
    expect(Object.keys(files).length).toBeGreaterThan(0);

    // If FT_EXPORT_ARTIFACT_DIR is set, write artifacts to disk
    const outputDir = process.env.FT_EXPORT_ARTIFACT_DIR;
    if (outputDir) {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const writtenPaths: string[] = [];
      for (const [filename, content] of Object.entries(files)) {
        const filePath = path.join(outputDir, filename);
        fs.writeFileSync(filePath, content, "utf-8");
        writtenPaths.push(filePath);
      }

      console.log(`[FT_ARTIFACT_GEN_SUCCESS] Generated ${writtenPaths.length} files in ${outputDir}`);
      writtenPaths.forEach((p) => console.log(`  ${path.basename(p)}`));
    }

    console.log("[FT_EXPORT_ARTIFACT_GEN_PASS]");
  });
});
