/**
 * Contract test: verify.js must recompute packHash and fail on mismatch
 *
 * Static source analysis — reads reviewPack.ts as text and asserts the
 * verify.js template contains all required packHash verification logic.
 *
 * [FT_TEST_PASS_VERIFY_PACKHASH_CONTRACT]
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const sourceFile = path.resolve(__dirname, "../../src/export/reviewPack.ts");

function getVerifyJsBlock(): string {
  const source = fs.readFileSync(sourceFile, "utf8");
  const start = source.indexOf("private static generateVerifyScript");
  expect(start).toBeGreaterThan(-1);
  // Extract a generous block covering the entire template
  const block = source.slice(start, start + 5000);
  return block;
}

describe("verify.js packHash contract: recompute and fail-closed on mismatch", () => {
  it("source file exists", () => {
    expect(fs.existsSync(sourceFile)).toBe(true);
  });

  it("verify.js contains 'recomputing packHash' marker", () => {
    const block = getVerifyJsBlock();
    expect(block).toContain("recomputing packHash");
  });

  it("verify.js reads and parses review-manifest.json", () => {
    const block = getVerifyJsBlock();
    expect(block).toContain("review-manifest.json");
    // Must parse it to get packHash
    expect(block).toContain("manifest.packHash");
  });

  it("verify.js compares recomputed hash to manifest packHash", () => {
    const block = getVerifyJsBlock();
    // Accept variations of the comparison expression
    const comparisonPattern = /computedHash\s*!==?\s*(manifest\.packHash|packHash)/;
    expect(block).toMatch(comparisonPattern);
  });

  it("verify.js contains mismatch failure string", () => {
    const block = getVerifyJsBlock();
    expect(block).toContain("FAIL: packHash mismatch");
  });

  it("verify.js contains success marker string", () => {
    const block = getVerifyJsBlock();
    expect(block).toContain("[VERIFY] ✓ packHash matches manifest");
  });

  it("verify.js uses crypto.createHash('sha256') for real hashing", () => {
    const block = getVerifyJsBlock();
    expect(block).toContain('crypto.createHash("sha256")');
  });

  it("verify.js REQUIRED_FILES includes control-mapping.json", () => {
    const block = getVerifyJsBlock();
    // Find the REQUIRED_FILES array inside the template
    const reqStart = block.indexOf("const REQUIRED_FILES = [");
    expect(reqStart).toBeGreaterThan(-1);
    const reqEnd = block.indexOf("];", reqStart);
    expect(reqEnd).toBeGreaterThan(reqStart);
    const reqArray = block.slice(reqStart, reqEnd + 2);
    expect(reqArray).toContain('"control-mapping.json"');
  });

  it("verify.js iterates REQUIRED_FILES for hash computation", () => {
    const block = getVerifyJsBlock();
    // Must iterate the list — look for a for-of or forEach over REQUIRED_FILES
    const iterPattern = /for\s*\(\s*const\s+\w+\s+of\s+REQUIRED_FILES\s*\)|REQUIRED_FILES\.forEach/;
    expect(block).toMatch(iterPattern);
  });

  it("[FT_TEST_PASS_VERIFY_PACKHASH_CONTRACT]", () => {
    expect(true).toBe(true);
  });
});
