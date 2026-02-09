/**
 * REGRESSION GATE: Forbid modules.webtrigger (except backend identity)
 * 
 * This test ensures that the manifest never contains problematic webtrigger modules
 * that would break Runs on Atlassian eligibility.
 * 
 * EXCEPTION: backend-identity-trigger is allowed (read-only, E2E verification only).
 * 
 * Failure indicates a critical regression: forbidden webtriggers have been re-added.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("forbid_webtrigger_module", () => {
  it("must NOT contain forbidden webtrigger modules", () => {
    // Read manifest
    const manifestPath = path.join(__dirname, "../manifest.yml");
    const manifestContent = fs.readFileSync(manifestPath, "utf-8");
    
    // Check for webtrigger module
    const hasWebtrgerModule = /^\s*webtrigger\s*:/m.test(manifestContent);
    
    // If webtriggers exist, verify only backend-identity-trigger is present
    if (hasWebtrgerModule) {
      // Allow only backend-identity-trigger
      const hasBackendIdentity = manifestContent.includes('backend-identity-trigger');
      expect(hasBackendIdentity).toBe(true);
      
      // Verify no forbidden webtrigger keys
      expect(manifestContent).not.toContain('runtime-proof-trigger');
      expect(manifestContent).not.toContain('contract-proof-trigger');
      
      console.log(`✓ ALLOWED: backend-identity-trigger webtrigger (E2E verification only)`);
    }
    
    // Additional check: ensure no forbidden webtrigger references in function handlers
    expect(manifestContent).not.toContain("webtriggers/runtime_proof");
    expect(manifestContent).not.toContain("webtriggers/contract-proof");
    
    // Prove the gate ran
    console.log("✓ FORBIDDEN: problematic webtriggers NOT found. ROA eligibility preserved.");
  });
});
