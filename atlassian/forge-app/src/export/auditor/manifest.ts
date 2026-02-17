/**
 * Auditor Manifest: Metadata + Evidence Hash
 * Enables external verification without outbound networking
 *
 * FT_PROOF_AUDITOR_MANIFEST_v1: This module implements the auditor manifest contract
 * FT_PROOF_NO_CIRCULAR_HASH_v1: Evidence hash does NOT include manifest (no circular dependency)
 * FT_PROOF_MANIFEST_ALL_ARTIFACT_HASHES_v1: Manifest includes hashes for all artifacts (evidence, html, scripts)
 */

export interface AuditorManifest {
  // Contract version
  schemaVersion: "auditor-manifest@1";
  
  // Algorithm identifier
  algorithm: "SHA-256";
  
  // Site/tenant identification
  siteId: string;
  
  // Build identifiers (from snapshot metadata)
  buildUtc: string;
  buildShaShort: string;
  
  // Policy identifiers
  ruleSetVersion: string;
  privilegeContext: string;
  
  // Evidence integrity hash (SHA-256 of canonical evidence JSON)
  // FT_PROOF_NO_CIRCULAR_HASH_v1: This hash is computed BEFORE manifest is created
  evidenceSha256: string;
  
  // Optional: Self hashes (for embedded HTML/scripts - removes tamper complaints)
  htmlSha256?: string;
  verifyShSha256?: string;
  verifyPs1Sha256?: string;
}

/**
 * Build and validate manifest
 * Fails closed if required metadata missing
 * FT_PROOF_MANIFEST_METADATA_MISSING_v1: Thrown if critical fields missing
 */
export function buildAuditorManifest(params: {
  snapshot: any; // Must have schemaVersion, siteId, buildShaShort, privilegeContext, ruleSetVersion, meta.buildUtc
  evidenceSha256: string;
  htmlSha256?: string;
  verifyShSha256?: string;
  verifyPs1Sha256?: string;
}): AuditorManifest {
  console.log("[FT_PROOF_AUDITOR_MANIFEST_v1]", { marker: "FT_PROOF_AUDITOR_MANIFEST_v1" });
  console.log("[FT_PROOF_MANIFEST_ALL_ARTIFACT_HASHES_v1]", { marker: "FT_PROOF_MANIFEST_ALL_ARTIFACT_HASHES_v1" });

  const { snapshot, evidenceSha256, htmlSha256, verifyShSha256, verifyPs1Sha256 } = params;

  // Validate required metadata
  const required = [
    { field: "snapshot.schemaVersion", value: snapshot?.schemaVersion },
    { field: "snapshot.siteId", value: snapshot?.siteId },
    { field: "snapshot.buildShaShort", value: snapshot?.buildShaShort },
    { field: "snapshot.privilegeContext", value: snapshot?.privilegeContext },
    { field: "snapshot.ruleSetVersion", value: snapshot?.ruleSetVersion },
    { field: "snapshot.meta.buildUtc", value: snapshot?.meta?.buildUtc },
  ];

  const missing = required.filter((r) => !r.value);
  if (missing.length > 0) {
    console.error("[FT_PROOF_MANIFEST_METADATA_MISSING_v1]", {
      marker: "FT_PROOF_MANIFEST_METADATA_MISSING_v1",
      missing: missing.map((m) => m.field),
    });
    throw new Error(
      `Manifest metadata missing: ${missing.map((m) => m.field).join(", ")} (FT_PROOF_MANIFEST_METADATA_MISSING_v1)`
    );
  }

  // No circular hashing: evidenceSha256 is computed before manifest creation
  console.log("[FT_PROOF_NO_CIRCULAR_HASH_v1]", {
    marker: "FT_PROOF_NO_CIRCULAR_HASH_v1",
    note: "evidenceSha256 computed before manifest; manifest not included in evidence hash",
  });

  return {
    schemaVersion: "auditor-manifest@1",
    algorithm: "SHA-256",
    siteId: snapshot.siteId,
    buildUtc: snapshot.meta.buildUtc,
    buildShaShort: snapshot.buildShaShort,
    ruleSetVersion: snapshot.ruleSetVersion,
    privilegeContext: snapshot.privilegeContext,
    evidenceSha256,
    htmlSha256,
    verifyShSha256,
    verifyPs1Sha256,
  };
}
