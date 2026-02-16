/**
 * Phase 3 Review Pack Canonical Builder
 * Pure function, no Forge/storage calls, deterministic fixture generation
 */

export interface ReviewPackCanonical {
  schemaVersion: string;
  siteId: string;
  privilegeContext: string;
  ruleSetVersion: string;
  buildShaShort: string;
  phaseIdentifier: string;
}

export function buildReviewPackCanonicalFixture(): ReviewPackCanonical {
  return {
    schemaVersion: "3.0.0",
    siteId: "ari:cloud:jira::site/12345678-1234-1234-1234-123456789abc",
    privilegeContext: "ADMIN",
    ruleSetVersion: "phase-3-review-set-v1",
    buildShaShort: "f5041c20",
    phaseIdentifier: "phase-3-review-pack"
  };
}

/**
 * Verify struct has required schema keys
 */
export function validateReviewPackSchema(obj: unknown): obj is ReviewPackCanonical {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const o = obj as Record<string, unknown>;
  return (
    typeof o.schemaVersion === 'string' &&
    typeof o.siteId === 'string' &&
    typeof o.privilegeContext === 'string' &&
    typeof o.ruleSetVersion === 'string' &&
    typeof o.buildShaShort === 'string'
  );
}
