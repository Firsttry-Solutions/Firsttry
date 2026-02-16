/**
 * Export Schema Lock Test
 * Verifies schema structure and fail-closed constraints
 */

import { buildPhase1CanonicalFixture, validatePhase1Schema } from "../../src/export/phase1CanonicalFixture";
import { buildReviewPackCanonicalFixture, validateReviewPackSchema } from "../../src/export/reviewPackCanonical";

describe("exportSchemaLock", () => {
  test("should verify phase 1 canonical schema", () => {
    const phase1 = buildPhase1CanonicalFixture();
    
    // Validate schema
    expect(validatePhase1Schema(phase1)).toBe(true);
    
    // Verify required keys exist
    expect(phase1.schemaVersion).toBeDefined();
    expect(phase1.siteId).toBeDefined();
    expect(phase1.privilegeContext).toBeDefined();
    expect(phase1.ruleSetVersion).toBeDefined();
    expect(phase1.buildShaShort).toBeDefined();
    
    console.log("[FT_EXPORT_SCHEMA_LOCK_PASS]");
  });

  test("should verify phase 3 canonical schema", () => {
    const phase3 = buildReviewPackCanonicalFixture();
    
    // Validate schema
    expect(validateReviewPackSchema(phase3)).toBe(true);
    
    // Verify required keys exist
    expect(phase3.schemaVersion).toBeDefined();
    expect(phase3.siteId).toBeDefined();
    expect(phase3.privilegeContext).toBeDefined();
    expect(phase3.ruleSetVersion).toBeDefined();
    expect(phase3.buildShaShort).toBeDefined();
  });

  test("should disallow timestamp keys in canonical hash domain", () => {
    const phase1 = buildPhase1CanonicalFixture();
    const phase3 = buildReviewPackCanonicalFixture();

    // Check for timestamp-like keys (fail-closed)
    const timestampPattern = /(timestamp|Utc|At)$/i;
    
    Object.keys(phase1).forEach((key) => {
      expect(key).not.toMatch(timestampPattern);
    });

    Object.keys(phase3).forEach((key) => {
      expect(key).not.toMatch(timestampPattern);
    });

    console.log("[FT_EXPORT_SCHEMA_LOCK_PASS]");
  });
});
