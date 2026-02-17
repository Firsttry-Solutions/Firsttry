/**
 * Auditor Manifest: Metadata + Critical Artifact Hashes (Evidence + Scripts)
 * Enables external verification without outbound networking
 * HTML is a container only; not integrity-verified.
 *
 * FT_PROOF_AUDITOR_MANIFEST_v1: This module implements the auditor manifest contract
 * FT_PROOF_NO_CIRCULAR_HASH_v1: Evidence hash does NOT include manifest (no circular dependency)
 * FT_PROOF_MANIFEST_CRITICAL_ARTIFACTS_ONLY_v1: Manifest hashes only critical artifacts (evidence + scripts), not HTML
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
  
  // Critical artifact hashes (SHA-256)
  // FT_PROOF_NO_CIRCULAR_HASH_v1: evidenceSha256 computed BEFORE manifest is created
  evidenceSha256: string;
  verifyShSha256: string;  // REQUIRED: hash of verify.sh script
  verifyPs1Sha256: string; // REQUIRED: hash of verify.ps1 script
}

/**
 * Build and validate manifest
 * Fails closed if required metadata missing
 * FT_PROOF_MANIFEST_METADATA_MISSING_v1: Thrown if critical fields missing
 */
export function buildAuditorManifest(params: {
  snapshot: any; // Must have schemaVersion, siteId, buildShaShort, privilegeContext, ruleSetVersion, meta.buildUtc
  evidenceSha256: string;
  verifyShSha256: string;  // REQUIRED
  verifyPs1Sha256: string; // REQUIRED
}): AuditorManifest {
  console.log("[FT_PROOF_AUDITOR_MANIFEST_v1]", { marker: "FT_PROOF_AUDITOR_MANIFEST_v1" });
  console.log("[FT_PROOF_MANIFEST_CRITICAL_ARTIFACTS_ONLY_v1]", { marker: "FT_PROOF_MANIFEST_CRITICAL_ARTIFACTS_ONLY_v1" });

  const { snapshot, evidenceSha256, verifyShSha256, verifyPs1Sha256 } = params;

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

  // Validate script hashes are present (fail-closed)
  if (!verifyShSha256) {
    throw new Error("verifyShSha256 is required (FT_PROOF_MANIFEST_CRITICAL_ARTIFACTS_ONLY_v1)");
  }
  if (!verifyPs1Sha256) {
    throw new Error("verifyPs1Sha256 is required (FT_PROOF_MANIFEST_CRITICAL_ARTIFACTS_ONLY_v1)");
  }

  return {
    schemaVersion: "auditor-manifest@1",
    algorithm: "SHA-256",
    siteId: snapshot.siteId,
    buildUtc: snapshot.meta.buildUtc,
    buildShaShort: snapshot.buildShaShort,
    ruleSetVersion: snapshot.ruleSetVersion,
    privilegeContext: snapshot.privilegeContext,
    evidenceSha256,
    verifyShSha256,
    verifyPs1Sha256,
  };
}
