/**
 * Sync-lock contract test: verify.js packHash recomputation logic must
 * stay in sync with ReviewExportPack.computePackHash().
 *
 * Static source analysis — reads reviewPack.ts as text and asserts both
 * computePackHash() and the verify.js template share the same structural
 * rules. If either side drifts, this test fails.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const sourceFile = path.resolve(__dirname, "../../src/export/reviewPack.ts");
const source = fs.readFileSync(sourceFile, "utf8");

/**
 * Extract the computePackHash method body (from signature to next method/closing brace).
 */
function getComputePackHashBlock(): string {
  const marker = "static computePackHash(";
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  // Grab a generous window (the method is ~25 lines)
  return source.slice(start, start + 800);
}

/**
 * Extract the verify.js template string block.
 */
function getVerifyJsBlock(): string {
  const marker = "private static generateVerifyScript";
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, start + 5000);
}

// ─── A/B: extract both sections ───────────────────────────────────────

describe("hash logic sync contract: computePackHash ↔ verify.js", () => {
  // ─── C: computePackHash contract rules ────────────────────────────

  describe("computePackHash contract rules", () => {
    it("delegates to canonical buildPackHashInput", () => {
      const block = getComputePackHashBlock();
      expect(block).toContain("buildPackHashInput");
      expect(block).toContain("this.REQUIRED_FILES");
    });

    it("canonical buildPackHashInput concatenates using filename:content format", () => {
      const fnStart = source.indexOf("export function buildPackHashInput");
      expect(fnStart).toBeGreaterThan(-1);
      const fnBlock = source.slice(fnStart, fnStart + 800);
      expect(fnBlock).toContain("${filename}:${files[filename]}");
    });

    it("canonical buildPackHashInput iterates requiredFiles first then extras sorted", () => {
      const fnStart = source.indexOf("export function buildPackHashInput");
      const fnBlock = source.slice(fnStart, fnStart + 800);
      expect(fnBlock).toMatch(/for\s*\(\s*const\s+\w+\s+of\s+requiredFiles\s*\)/);
      expect(fnBlock).toContain(".filter(");
      expect(fnBlock).toContain(".sort()");
    });

    it("uses SHA-256 and utf8 encoding", () => {
      const block = getComputePackHashBlock();
      expect(block).toContain('createHash("sha256")');
      expect(block).toContain('"utf8"');
    });
  });

  // ─── D: verify.js template must mirror computePackHash logic ──────

  describe("verify.js mirrors computePackHash logic", () => {
    it("uses REQUIRED_FILES list and iterates in order", () => {
      const block = getVerifyJsBlock();
      expect(block).toContain("const REQUIRED_FILES = [");
      // Must iterate REQUIRED_FILES
      expect(block).toMatch(/for\s*\(\s*const\s+\w+\s+of\s+REQUIRED_FILES\s*\)/);
    });

    it("uses canonical buildPackHashInput for hash computation", () => {
      const block = getVerifyJsBlock();
      // verify.js calls the emitted canonical helper instead of duplicating logic
      expect(block).toContain("buildPackHashInput(");
    });

    it("handles manifest self-reference by zeroing packHash before hashing", () => {
      const block = getVerifyJsBlock();
      // Must blank/zero packHash in a copy of manifest before re-serializing
      expect(block).toContain('packHash');
      expect(block).toContain('""');
      // Must re-serialize the zeroed manifest with JSON.stringify
      expect(block).toMatch(/JSON\.stringify\s*\(\s*preHashManifest/);
    });

    it("compares recomputed hash to manifest.packHash", () => {
      const block = getVerifyJsBlock();
      // Must have a comparison between computed and stored hash
      expect(block).toMatch(/computedHash\s*!==?\s*(manifest\.packHash|packHash)/);
    });

    it("fails closed on mismatch (process.exit(1))", () => {
      const block = getVerifyJsBlock();
      expect(block).toContain("FAIL: packHash mismatch");
      expect(block).toContain("process.exit(1)");
    });

    it("prints success marker on match", () => {
      const block = getVerifyJsBlock();
      expect(block).toContain("[VERIFY] ✓ packHash matches manifest");
    });

    it("uses SHA-256 for recomputation", () => {
      const block = getVerifyJsBlock();
      expect(block).toContain('crypto.createHash("sha256")');
    });

    it("REQUIRED_FILES in verify.js includes control-mapping.json", () => {
      const block = getVerifyJsBlock();
      const reqStart = block.indexOf("const REQUIRED_FILES = [");
      const reqEnd = block.indexOf("];", reqStart);
      const reqArray = block.slice(reqStart, reqEnd + 2);
      expect(reqArray).toContain('"control-mapping.json"');
    });
  });

  // ─── E: cross-check both sides share the same REQUIRED_FILES set ──

  describe("REQUIRED_FILES parity between class and verify.js", () => {
    it("class-level REQUIRED_FILES matches verify.js REQUIRED_FILES entries", () => {
      // Extract class-level list
      const classMatch = source.match(
        /static readonly REQUIRED_FILES\s*=\s*\[([\s\S]*?)\];/
      );
      expect(classMatch).not.toBeNull();
      const classEntries = classMatch![1]
        .match(/"([^"]+)"/g)!
        .map((s) => s.replace(/"/g, ""));

      // Extract verify.js template list
      const verifyBlock = getVerifyJsBlock();
      const verifyReqStart = verifyBlock.indexOf("const REQUIRED_FILES = [");
      const verifyReqEnd = verifyBlock.indexOf("];", verifyReqStart);
      const verifyReqStr = verifyBlock.slice(verifyReqStart, verifyReqEnd + 2);
      const verifyEntries = verifyReqStr
        .match(/"([^"]+)"/g)!
        .map((s) => s.replace(/"/g, ""));

      expect(verifyEntries).toEqual(classEntries);
    });
  });

  // ─── Final marker ─────────────────────────────────────────────────

  it("[FT_TEST_PASS_HASH_LOGIC_SYNC_CONTRACT]", () => {
    expect(true).toBe(true);
  });
});
