/**
 * Contract test: review-manifest.json packHash must be truthful by construction
 *
 * Functional test:
 * - Builds a minimal valid ReviewWorkflow
 * - Calls ReviewExportPack.generatePackFiles()
 * - Asserts manifest.packHash is 64-char lowercase hex
 * - Asserts manifest.packHash === ReviewExportPack.computePackHash(files)
 * - Asserts control-mapping.json is present in files map
 * - Asserts verify.js content references "control-mapping.json"
 */

import { describe, it, expect } from "vitest";
import { ReviewExportPack } from "../../src/export/reviewPack";
import {
  ReviewWorkflow,
  ReviewItem,
  ReviewDecision,
  ReviewException,
} from "../../src/access-review/types";

/**
 * Minimal valid workflow that passes validateExportable()
 * All values are stable / deterministic — no Date.now()
 */
function createMinimalClosedWorkflow(): ReviewWorkflow {
  const fixedUtc = "2026-02-14T00:00:00Z";
  return {
    reviewId: "pack-hash-test-001",
    status: "closed",
    createdAt: fixedUtc,
    closedAt: fixedUtc,
    snapshotHash: "aabbccdd11223344",
    canonicalHash: "eeff00112233445566778899aabbccddeeff00112233445566778899aabbccdd",
    items: {
      "user:test": {
        entityId: "user:test",
        entityType: "user",
        privilegeSummary: "viewer",
        riskLevel: "low",
        addedAt: fixedUtc,
      } as ReviewItem,
    },
    decisions: {
      "user:test": [
        {
          reviewerAccountId: "reviewer-a",
          decision: "approved",
          timestamp: fixedUtc,
        } as ReviewDecision,
      ],
    },
    exceptions: [] as ReviewException[],
    reviewers: ["reviewer-a"],
    progress: 100,
    complianceScore: 100,
    buildVersion: "0.0.1",
    siteId: "test-site",
  } as ReviewWorkflow;
}

describe("manifest packHash contract: truthful by construction", () => {
  const buildSha = "deadbeef";
  const fixedGenAt = "2026-02-14T00:00:00Z";

  it("packHash is a 64-char lowercase hex string", () => {
    const workflow = createMinimalClosedWorkflow();
    const files = ReviewExportPack.generatePackFiles(workflow, buildSha, {
      generatedAt: fixedGenAt,
    });

    const manifest = JSON.parse(files["review-manifest.json"]);
    expect(manifest.packHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("packHash equals computePackHash(files) with packHash zeroed (circularity-safe)", () => {
    const workflow = createMinimalClosedWorkflow();
    const files = ReviewExportPack.generatePackFiles(workflow, buildSha, {
      generatedAt: fixedGenAt,
    });

    const manifest = JSON.parse(files["review-manifest.json"]);

    // The hash was computed from files where packHash was "" (pre-hash state).
    // To verify, we recreate that state before recomputing.
    const preHashManifest = { ...manifest, packHash: "" };
    const verifyFiles = {
      ...files,
      "review-manifest.json": JSON.stringify(preHashManifest, null, 2),
    };
    const recomputedHash = ReviewExportPack.computePackHash(verifyFiles);

    expect(manifest.packHash).toBe(recomputedHash);
  });

  it("packHash is not empty or placeholder", () => {
    const workflow = createMinimalClosedWorkflow();
    const files = ReviewExportPack.generatePackFiles(workflow, buildSha, {
      generatedAt: fixedGenAt,
    });

    const manifest = JSON.parse(files["review-manifest.json"]);
    expect(manifest.packHash).not.toBe("");
    expect(manifest.packHash.length).toBe(64);
  });

  it("control-mapping.json is present in files map", () => {
    const workflow = createMinimalClosedWorkflow();
    const files = ReviewExportPack.generatePackFiles(workflow, buildSha, {
      generatedAt: fixedGenAt,
    });

    expect(files["control-mapping.json"]).toBeDefined();
    expect(files["control-mapping.json"].length).toBeGreaterThan(0);

    // Must be valid JSON
    expect(() => JSON.parse(files["control-mapping.json"])).not.toThrow();
  });

  it("verify.js content references control-mapping.json", () => {
    const workflow = createMinimalClosedWorkflow();
    const files = ReviewExportPack.generatePackFiles(workflow, buildSha, {
      generatedAt: fixedGenAt,
    });

    expect(files["verify.js"]).toContain("control-mapping.json");
  });

  it("two identical runs produce identical packHash (deterministic)", () => {
    const workflow = createMinimalClosedWorkflow();

    const files1 = ReviewExportPack.generatePackFiles(workflow, buildSha, {
      generatedAt: fixedGenAt,
    });
    const files2 = ReviewExportPack.generatePackFiles(workflow, buildSha, {
      generatedAt: fixedGenAt,
    });

    const m1 = JSON.parse(files1["review-manifest.json"]);
    const m2 = JSON.parse(files2["review-manifest.json"]);

    expect(m1.packHash).toBe(m2.packHash);
  });
});
