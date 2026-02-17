/**
 * Universal Packet Packer
 * Orchestrates evidence, manifest, diff, and HTML generation
 *
 * FT_PROOF_PACKER_v1: This module creates self-contained audit evidence packets
 * FT_PROOF_PACKER_NO_HTML_HASH_v1: Packer computes hashes for critical artifacts only (evidence + scripts); HTML is container
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
  console.log("[FT_PROOF_PACKER_NO_HTML_HASH_v1]", { marker: "FT_PROOF_PACKER_NO_HTML_HASH_v1" });

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

  // 3. Generate verification scripts and compute their hashes
  const verifyShScript = generateVerifySh();
  const verifyPs1Script = generateVerifyPs1();
  
  const verifyShSha256 = sha256Hex(verifyShScript);
  const verifyPs1Sha256 = sha256Hex(verifyPs1Script);

  // 4. Build manifest with critical artifact hashes (evidence + scripts)
  // HTML is NOT hashed - it is a container only
  const manifest = buildAuditorManifest({
    snapshot: auditableSnapshot,
    evidenceSha256,
    verifyShSha256,
    verifyPs1Sha256,
  });

  // 5. Generate HTML (single pass - no two-pass generation needed)
  const htmlContent = generateSmartHtmlReport({
    evidenceJsonString: evidenceJson,
    manifestJson: manifest,
    verifyShScript,
    verifyPs1Script,
  });

  console.log("[FT_PROOF_PACKER_PACKET_COMPLETE]", {
    marker: "FT_PROOF_PACKER_PACKET_COMPLETE",
    evidenceSha256: evidenceSha256.substring(0, 16) + "...",
    htmlSize: htmlContent.length,
    verifyShSha256: verifyShSha256.substring(0, 16) + "...",
    verifyPs1Sha256: verifyPs1Sha256.substring(0, 16) + "...",
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
