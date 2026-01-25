/**
 * REGRESSION GATE: Forbid modules.webtrigger
 * 
 * This test ensures that the manifest never contains a webtrigger module,
 * which would break Runs on Atlassian eligibility.
 * 
 * Failure indicates a critical regression: webtriggers have been re-added.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("forbid_webtrigger_module", () => {
  it("must NOT contain modules.webtrigger", () => {
    // Read manifest
    const manifestPath = path.join(__dirname, "../manifest.yml");
    const manifestContent = fs.readFileSync(manifestPath, "utf-8");
    
    // Check for webtrigger module using regex (no external YAML parser)
    const hasWebtrgerModule = /^\s*webtrigger\s*:/m.test(manifestContent);
    
    // Fail-closed
    expect(hasWebtrgerModule).toBe(false);
    
    // Additional check: ensure no webtrigger references in function handlers
    expect(manifestContent).not.toContain("webtriggers/runtime_proof");
    expect(manifestContent).not.toContain("webtriggers/contract-proof");
    
    // Prove the gate ran
    console.log("✓ FORBIDDEN: modules.webtrigger NOT found. ROA eligibility preserved.");
  });
});
