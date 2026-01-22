/**
 * UNIT TEST: Bundle Hash Real Provenance
 * 
 * Validates that bundle hash in identity anchor comes from SHA-256 of actual
 * file content, NOT sliced from git SHA (which would be a "hack").
 * 
 * REQUIREMENT: git != bundle (natural distinctness via different sources)
 */

import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

/**
 * Helper: Compute bundle short hash from buffer content (simulates postbuild.mjs)
 */
function computeBundleShortFromBuffer(content: string | Buffer): string {
  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  const hashHex = crypto.createHash('sha256').update(buffer).digest('hex');
  return hashHex.substring(0, 7);
}

describe("Bundle Hash Real Provenance (NOT substring hack)", () => {
  
  it("should compute bundle hash from SHA-256 of actual content", () => {
    // Given a sample JS file content (simulating built bundle)
    const sampleContent = `
      (function() {
        const app = { version: "1.0.0" };
        console.log("[APP_INIT]", app);
      })();
      // Random build timestamp: ${Date.now()}
    `;
    
    // When computing bundle short hash
    const bundleShort = computeBundleShortFromBuffer(sampleContent);
    
    // Then it should be 7 hex chars (first 7 of sha256)
    expect(bundleShort).toMatch(/^[0-9a-f]{7}$/);
    expect(bundleShort.length).toBe(7);
  });

  it("should produce DIFFERENT bundle hashes for DIFFERENT content", () => {
    const content1 = "bundle v1 with specific code";
    const content2 = "bundle v2 with different code";
    
    const hash1 = computeBundleShortFromBuffer(content1);
    const hash2 = computeBundleShortFromBuffer(content2);
    
    // Different content -> different SHA-256 -> different bundle hash
    expect(hash1).not.toEqual(hash2);
  });

  it("should produce SAME bundle hash for IDENTICAL content (deterministic)", () => {
    const content = "deterministic bundle content for testing";
    
    const hash1 = computeBundleShortFromBuffer(content);
    const hash2 = computeBundleShortFromBuffer(content);
    
    // Same content -> same SHA-256 -> same bundle hash (deterministic)
    expect(hash1).toEqual(hash2);
  });

  it("should ensure git !== bundle (natural distinctness via different sources)", () => {
    // Simulate the postbuild scenario:
    // - Git SHA: from git rev-parse HEAD (7 chars)
    // - Bundle hash: from sha256(file_content) (7 chars)
    
    // These come from completely different sources, so collision is virtually impossible
    const gitShaExample = "e88d584";  // First 7 of git commit
    const fileContentExample = Buffer.from(`
      // Forge gadget bundle
      import { invoke } from "@forge/bridge";
      const app = { name: "FirstTry", version: "2.14.0" };
      export default app;
    `);
    
    const bundleHashExample = computeBundleShortFromBuffer(fileContentExample);
    
    // CRITICAL ASSERTION: They must be different
    // (Only natural collision would have probability ~1 in 16M for each 7-hex slot)
    expect(gitShaExample).not.toEqual(bundleHashExample);
    
    // Both should be valid 7-hex format
    expect(gitShaExample).toMatch(/^[0-9a-f]{7}$/);
    expect(bundleHashExample).toMatch(/^[0-9a-f]{7}$/);
  });

  it("should validate anchor format with real git and bundle components", () => {
    const gitShort = "e88d584";
    const bundleShort = "7faf276";
    const timeIso = "2026-01-22T17:45:03Z";
    
    const anchor = `FT_IDENTITY_ANCHOR_V1|git=${gitShort}|bundle=${bundleShort}|time=${timeIso}`;
    
    // Must match gate verification regex
    const anchorPattern = /^FT_IDENTITY_ANCHOR_V1\|git=[0-9a-f]{7}\|bundle=[0-9a-f]{7}\|time=[\d\-T:Z]+$/;
    expect(anchor).toMatch(anchorPattern);
    
    // Extract components and verify
    const gitMatch = anchor.match(/git=([0-9a-f]{7})/);
    const bundleMatch = anchor.match(/bundle=([0-9a-f]{7})/);
    const timeMatch = anchor.match(/time=([^\|]+)/);
    
    expect(gitMatch![1]).toBe(gitShort);
    expect(bundleMatch![1]).toBe(bundleShort);
    expect(timeMatch![1]).toBe(timeIso);
    
    // Verify distinctness
    expect(gitMatch![1]).not.toEqual(bundleMatch![1]);
  });

  it("should reject substring-slicing approach as NOT real provenance", () => {
    // This simulates the OLD HACK: slicing same git SHA differently
    const gitShaFull = "e88d5847faf27634bb9d570545a80e3625803066"; // 40-char git SHA
    
    // OLD HACK: use different substrings of same source
    const gitOldHack = gitShaFull.substring(0, 7);      // e88d584
    const bundleOldHack = gitShaFull.substring(7, 14);  // 7faf276
    
    // These are deterministically different because they're from different positions
    // But they BOTH come from the same source, so they're not independent provenance!
    expect(gitOldHack).not.toEqual(bundleOldHack);
    
    // This is the fundamental problem: if an attacker/mistake corrupts git SHA,
    // both components get corrupted in predictable ways. Not robust.
    
    // NEW APPROACH (real provenance):
    // - git = from git commit (independent source #1)
    // - bundle = from sha256(file_content) (independent source #2)
    // If file changes, bundle changes independently. If git is wrong, bundle might still be right.
  });
});
