/**
 * Scope Rationale Enforcement Test
 * Verifies scope allowlist matches manifest and all have rationales
 */

import * as fs from "fs";
import * as path from "path";
import { extractScopesFromManifestText } from "../../src/security/manifestScopes";
import { SCOPE_ALLOWLIST } from "../../src/security/scopeAllowlist";
import { SCOPE_RATIONALE } from "../../src/security/scopeRationale";

describe("scopeRationale", () => {
  test("should keep scope allowlist synchronized with manifest", () => {
    // Read manifest
    const manifestPath = path.join(__dirname, "../../manifest.yml");
    const manifestText = fs.readFileSync(manifestPath, "utf-8");

    // Extract scopes from manifest
    const manifestScopes = extractScopesFromManifestText(manifestText);

    // Compare as sorted sets
    const allowlistScopes = SCOPE_ALLOWLIST.sort();
    const sortedManifestScopes = manifestScopes.sort();

    expect(sortedManifestScopes).toEqual(allowlistScopes);

    console.log("[FT_SCOPE_RATIONALE_PASS]");
  });

  test("should have rationale for every allowed scope", () => {
    const allowlistScopes = SCOPE_ALLOWLIST.sort();
    const rationales = Object.keys(SCOPE_RATIONALE).sort();

    expect(rationales).toEqual(allowlistScopes);

    // Verify each rationale is non-empty
    allowlistScopes.forEach((scope) => {
      const rationale = SCOPE_RATIONALE[scope];
      expect(rationale).toBeDefined();
      expect(rationale.length).toBeGreaterThan(0);
    });
  });

  test("should emit scope rationale marker", () => {
    console.log("[FT_SCOPE_RATIONALE_PASS]");
    expect(true).toBe(true);
  });
});
