/**
 * Phase 1 Canonical Export Fixture (deterministic synthetic)
 */

export interface Phase1Canonical {
  schemaVersion: string;
  siteId: string;
  privilegeContext: string;
  ruleSetVersion: string;
  buildShaShort: string;
}

export function buildPhase1CanonicalFixture(): Phase1Canonical {
  return {
    schemaVersion: "1.0.0",
    siteId: "ari:cloud:jira::site/12345678-1234-1234-1234-123456789abc",
    privilegeContext: "READ_ONLY",
    ruleSetVersion: "phase-1-base-v1",
    buildShaShort: "f5041c20"
  };
}

export function validatePhase1Schema(obj: unknown): obj is Phase1Canonical {
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
