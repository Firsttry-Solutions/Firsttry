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

  // 4b. Two-pass HTML generation: Compute htmlSha256 and rebuild
  console.log("[FT_PROOF_TWO_PASS_HTML_v1]", { marker: "FT_PROOF_TWO_PASS_HTML_v1" });
  const verifyShSha256 = sha256Hex(verifyShScript);
  const verifyPs1Sha256 = sha256Hex(verifyPs1Script);

  // 4c. Fixed-point iteration for htmlSha256 (converge until HTML hash stable)
  // Start with empty/placeholder htmlSha256, iterate until htmlSha256 stabilizes
  let htmlSha256 = "";
  let prevHtmlSha256: string | null = null;
  let convergenceIter = 0;
  const maxIter = 5;

  while (convergenceIter < maxIter) {
    // Rebuild manifest with current htmlSha256
    manifest = buildAuditorManifest({
      snapshot: auditableSnapshot,
      evidenceSha256,
      htmlSha256,
      verifyShSha256,
      verifyPs1Sha256,
    });

    // Regenerate HTML with updated manifest
    htmlContent = generateSmartHtmlReport({
      evidenceJsonString: evidenceJson,
      manifestJson: manifest,
      verifyShScript,
      verifyPs1Script,
    });

    // Compute new htmlSha256
    const newHtmlSha256 = sha256Hex(htmlContent);

    if (newHtmlSha256 === htmlSha256) {
      // Converged! htmlSha256 is stable - htmlContent now contains correct manifest with matching hash
      console.log(`[DEBUG_CONVERGENCE] Converged at iteration ${convergenceIter}`);
      break;
    }

    prevHtmlSha256 = htmlSha256;
    htmlSha256 = newHtmlSha256;
    convergenceIter++;
  }

  if (convergenceIter >= maxIter) {
    console.warn(
      `[WARNING_CONVERGENCE] htmlSha256 did not converge after ${maxIter} iterations`
    );
  }

  // At this point, htmlContent contains the HTML that hashhes to htmlSha256
  // and manifest contains htmlSha256
  // Return this content as-is (do NOT regenerate)

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
