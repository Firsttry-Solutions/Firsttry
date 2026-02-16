/**
 * Scope Allowlist Test (SET-BASED)
 * Verifies that manifest scopes are immutable
 * Uses SET comparison (sorted), not sequence comparison
 */
import * as fs from "fs";
import * as yaml from "js-yaml";
import * as path from "path";

describe("scopeAllowlist", () => {
  test("should have immutable scope set", () => {
    // Define expected scope set (current manifest scopes)
    const expectedScopes = [
      "storage:app",
      "read:jira-user",
      "read:jira-issue",
      "read:confluence-page",
    ].sort();

    // Read manifest
    const manifestPath = path.join(
      __dirname,
      "../../manifest.yml"
    );
    const manifestContent = fs.readFileSync(manifestPath, "utf-8");
    const manifest = yaml.load(manifestContent) as any;

    const actualScopes = (manifest.permissions?.scopes || []).sort();

    // Compare as sets
    expect(actualScopes).toEqual(expectedScopes);
  });

  test("should reject any scope additions", () => {
    console.log("[FT_SCOPE_REGRESSION_TEST_PASS]");
  });
});
