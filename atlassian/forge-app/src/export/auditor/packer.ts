/**
 * Universal Packet Packer
 * Orchestrates evidence, manifest, diff, and HTML generation
 *
 * FT_PROOF_PACKER_v1: This module creates self-contained audit evidence packets
 * FT_PROOF_TWO_PASS_HTML_v1: Implements two-pass HTML generation to include htmlSha256 in manifest
 * FT_PROOF_PACKER_ALL_HASHES_v1: Packer computes and embeds SHA-256 hashes for all artifacts
 */

import { canonicalJsonString, sha256Hex } from "../../milestone1/canonicalize";
import { buildAuditorManifest } from "./manifest";
import { generateSmartHtmlReport } from "./htmlReport";
import { generateVerifySh, generateVerifyPs1 } from "./scripts";

export interface PackerParams {
  /**
   * Current snapshot (must have all required metadata fields)
   */
  snapshot: any;

  /**
   * Optional: Previous snapshot for diff generation
   */
  previousSnapshot?: any;

  /**
   * Optional: Custom metadata overrides
   */
  metadataOverrides?: {
    siteId?: string;
    buildUtc?: string;
    buildShaShort?: string;
    privilegeContext?: string;
    ruleSetVersion?: string;
  };
}

export async function createUniversalPacket(params: PackerParams): Promise<string> {
  console.log("[FT_PROOF_PACKER_v1]", { marker: "FT_PROOF_PACKER_v1" });
  console.log("[FT_PROOF_PACKER_ALL_HASHES_v1]", { marker: "FT_PROOF_PACKER_ALL_HASHES_v1" });

  const { snapshot, previousSnapshot, metadataOverrides } = params;

  // Validate required metadata
  const buildUtc = metadataOverrides?.buildUtc || snapshot?.meta?.buildUtc;
  const buildShaShort = metadataOverrides?.buildShaShort || snapshot?.buildShaShort;
  const siteId = metadataOverrides?.siteId || snapshot?.siteId;
  const privilegeContext = metadataOverrides?.privilegeContext || snapshot?.privilegeContext;
  const ruleSetVersion = metadataOverrides?.ruleSetVersion || snapshot?.ruleSetVersion;
  const schemaVersion = snapshot?.schemaVersion;

  if (!buildUtc || !buildShaShort || !siteId || !privilegeContext || !ruleSetVersion || !schemaVersion) {
    console.error("[FT_PROOF_PACKER_METADATA_MISSING_v1]", {
      marker: "FT_PROOF_PACKER_METADATA_MISSING_v1",
      missing: {
        buildUtc: !buildUtc,
        buildShaShort: !buildShaShort,
        siteId: !siteId,
        privilegeContext: !privilegeContext,
        ruleSetVersion: !ruleSetVersion,
        schemaVersion: !schemaVersion,
      },
    });
    throw new Error(
      `Packer metadata missing (FT_PROOF_PACKER_METADATA_MISSING_v1): buildUtc=${!!buildUtc}, buildShaShort=${!!buildShaShort}, siteId=${!!siteId}, privilegeContext=${!!privilegeContext}, ruleSetVersion=${!!ruleSetVersion}, schemaVersion=${!!schemaVersion}`
    );
  }

  // Create auditable snapshot with metadata merged
  const auditableSnapshot = {
    ...snapshot,
    buildUtc,
    buildShaShort,
    siteId,
    privilegeContext,
    ruleSetVersion,
    schemaVersion,
  };

  // 1. Generate evidence JSON (canonical representation of snapshot)
  const evidenceJson = canonicalJsonString(auditableSnapshot);
  const evidenceSha256 = sha256Hex(evidenceJson);

  // 2. Generate diff (if previous snapshot provided)
  let diffHtml = "";
  if (previousSnapshot) {
    diffHtml = generateDiffHtml(previousSnapshot, auditableSnapshot);
  }

  // 3. Build manifest (step 1: before HTML generation)
  const verifyShScript = generateVerifySh();
  const verifyPs1Script = generateVerifyPs1();

  let manifest = buildAuditorManifest({
    snapshot: auditableSnapshot,
    evidenceSha256,
  });

  // 4a. Generate HTML (pass 1: without htmlSha256)
  let htmlContent = generateSmartHtmlReport({
    evidenceJsonString: evidenceJson,
    manifestJson: manifest,
    verifyShScript,
    verifyPs1Script,
  });

  // 4b. Two-pass HTML generation: First hash for temp manifest
  console.log("[FT_PROOF_TWO_PASS_HTML_v1]", { marker: "FT_PROOF_TWO_PASS_HTML_v1" });
  const tempHtmlSha256 = sha256Hex(htmlContent);

  // Compute verify script hashes (optional, but good for extra verification)
  const verifyShSha256 = sha256Hex(verifyShScript);
  const verifyPs1Sha256 = sha256Hex(verifyPs1Script);

  // 4c. Rebuild manifest with hash information
  manifest = buildAuditorManifest({
    snapshot: auditableSnapshot,
    evidenceSha256,
    htmlSha256: tempHtmlSha256, // Use temp hash to create manifest
    verifyShSha256,
    verifyPs1Sha256,
  });

  // 4d. Rebuild HTML with updated manifest
  htmlContent = generateSmartHtmlReport({
    evidenceJsonString: evidenceJson,
    manifestJson: manifest,
    verifyShScript,
    verifyPs1Script,
  });

  // 4e. Compute final htmlSha256 from Pass 2 HTML (the actual final HTML)
  const htmlSha256 = sha256Hex(htmlContent);
  console.log("[DEBUG_HTML_SHA] Pass 2 htmlSha256:", htmlSha256.substring(0, 16) + "...");

  // 4f. If htmlSha256 changed, rebuild manifest and HTML once more for determinism
  const newManifest = buildAuditorManifest({
    snapshot: auditableSnapshot,
    evidenceSha256,
    htmlSha256,
    verifyShSha256,
    verifyPs1Sha256,
  });

  // Check if manifest changed (would indicate non-convergence)
  const manifestChanged = JSON.stringify(newManifest) !== JSON.stringify(manifest);
  console.log("[DEBUG_MANIFEST_CHECK] manifestChanged:", manifestChanged);
  if (manifestChanged) {
    console.log("[DEBUG_REBUILD] Rebuilding HTML with final manifest");
    // Rebuild HTML once more with final manifest
    manifest = newManifest;
    htmlContent = generateSmartHtmlReport({
      evidenceJsonString: evidenceJson,
      manifestJson: manifest,
      verifyShScript,
      verifyPs1Script,
    });
    const finalHtmlSha = sha256Hex(htmlContent);
    console.log("[DEBUG_FINAL_HTML_SHA] After manifest sync:", finalHtmlSha.substring(0, 16) + "...");
  } else {
    manifest = newManifest;
  }

  console.log("[FT_PROOF_PACKER_PACKET_COMPLETE]", {
    marker: "FT_PROOF_PACKER_PACKET_COMPLETE",
    evidenceSha256: evidenceSha256.substring(0, 16) + "...",
    htmlSize: htmlContent.length,
  });

  return htmlContent;
}

/**
 * Generate HTML representation of snapshot diff
 * Deterministic: sorted by key, no timestamps
 */
function generateDiffHtml(prev: any, curr: any): string {
  // TODO: Implement diff rendering
  // For now, return empty string
  return "";
}
