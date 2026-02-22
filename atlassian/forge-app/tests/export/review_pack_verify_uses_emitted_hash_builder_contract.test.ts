/**
 * Contract test: verify.js must use the emitted canonical buildPackHashInput
 * helper and must NOT contain an independently-coded hash algorithm.
 *
 * Also validates that buildPackHashInput produces identical output to
 * ReviewExportPack.computePackHash (functional contract).
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { buildPackHashInput } from "../../src/export/reviewPack";
import { ReviewExportPack } from "../../src/export/reviewPack";

const sourceFile = path.resolve(__dirname, "../../src/export/reviewPack.ts");
const source = fs.readFileSync(sourceFile, "utf8");

/**
 * Extract the verify.js template region (from generateVerifyScript to end of method).
 */
function getVerifyJsBlock(): string {
  const marker = "private static generateVerifyScript";
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, start + 5000);
}

/**
 * Extract the emitBuildPackHashInputFunctionSource region.
 */
function getEmitterBlock(): string {
  const marker = "function emitBuildPackHashInputFunctionSource";
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, start + 1200);
}

// ─── 3A: Static enforcement ─────────────────────────────────────────

describe("verify.js uses emitted canonical helper (static enforcement)", () => {
  it("emitBuildPackHashInputFunctionSource exists in source", () => {
    expect(source).toContain("function emitBuildPackHashInputFunctionSource");
  });

  it("generateVerifyScript references the emitted helper", () => {
    const block = getVerifyJsBlock();
    expect(block).toContain("emitBuildPackHashInputFunctionSource");
  });

  it("emitted function contains the [FT_VERIFY_PACKHASH_CANONICAL_BUILDER] marker", () => {
    const block = getEmitterBlock();
    expect(block).toContain("[FT_VERIFY_PACKHASH_CANONICAL_BUILDER]");
  });

  it("verify.js template calls buildPackHashInput( exactly once for recomputation", () => {
    const block = getVerifyJsBlock();
    // Find all occurrences of buildPackHashInput( in the template
    const matches = block.match(/buildPackHashInput\s*\(/g) || [];
    // Exactly one call for recomputation (the emittedHelper interpolation defines the function, not calls it)
    expect(matches.length).toBe(1);
  });

  it("verify.js template does NOT contain its own REQUIRED_FILES iteration for hashing", () => {
    const block = getVerifyJsBlock();
    // The file-reading loop (for reading disk files) IS allowed — it reads into a files dict.
    // But there must NOT be a separate `combined +=` pattern for hash concatenation.
    // That logic is in the emitted function, not inline in the template.
    const combinedPattern = /combined\s*\+=\s*\w+\s*\+\s*"?:?"?\s*\+\s*\w+/;
    expect(block).not.toMatch(combinedPattern);
  });

  it("verify.js template does NOT contain .filter(f => !REQUIRED_FILES pattern for extras", () => {
    const block = getVerifyJsBlock();
    // This pattern would indicate duplicated extras logic in the template itself
    expect(block).not.toContain(".filter((f) => !REQUIRED_FILES.includes(f))");
    expect(block).not.toContain("extraFiles = Object.keys(files)");
  });

  it("emitted function contains the canonical algorithm markers", () => {
    const block = getEmitterBlock();
    // Must iterate REQUIRED_FILES in order
    expect(block).toMatch(/for\s*\(\s*const\s+\w+\s+of\s+REQUIRED_FILES\s*\)/);
    // Must use filename:content concatenation
    expect(block).toContain('filename + ":" + files[filename]');
    // Must handle extras in sorted order
    expect(block).toContain(".sort()");
  });
});

// ─── 3B: Functional contract ────────────────────────────────────────

describe("buildPackHashInput functional contract", () => {
  it("buildPackHashInput is an exported function", () => {
    expect(typeof buildPackHashInput).toBe("function");
  });

  it("sha256(buildPackHashInput(files, REQUIRED_FILES)) === computePackHash(files)", () => {
    // Representative files map with all required + 2 extras
    const files: Record<string, string> = {
      "review-manifest.json": '{"reviewId":"test","packHash":""}',
      "review-summary.json": '{"status":"closed"}',
      "access-review.csv": "entityId,entityType\nuser:a,user",
      "exceptions.csv": "entityId,reason\nuser:b,test",
      "snapshot-hash.txt": "abc123",
      "control-mapping.json": '{"controls":[]}',
      "verify.js": "// verify script",
      "schema-version.txt": "3.0.0",
      "extra-alpha.txt": "alpha content",
      "extra-beta.txt": "beta content",
    };

    const input = buildPackHashInput(files, ReviewExportPack.REQUIRED_FILES);
    const hashFromHelper = crypto
      .createHash("sha256")
      .update(input, "utf8")
      .digest("hex");

    const hashFromMethod = ReviewExportPack.computePackHash(files);

    expect(hashFromHelper).toBe(hashFromMethod);
  });

  it("extras are included in sorted order after required files", () => {
    const files: Record<string, string> = {
      "review-manifest.json": "manifest",
      "zebra-extra.txt": "z",
      "alpha-extra.txt": "a",
    };
    const requiredFiles = ["review-manifest.json"];

    const input = buildPackHashInput(files, requiredFiles);

    // Required first, then extras sorted: alpha before zebra
    expect(input).toBe(
      "review-manifest.json:manifest" +
        "alpha-extra.txt:a" +
        "zebra-extra.txt:z"
    );
  });

  it("empty files map produces empty string", () => {
    expect(buildPackHashInput({}, [])).toBe("");
  });

  it("missing required files are skipped gracefully", () => {
    const files: Record<string, string> = {
      "a.txt": "hello",
    };
    const input = buildPackHashInput(files, ["missing.txt", "a.txt"]);
    expect(input).toBe("a.txt:hello");
  });
});

// ─── Final marker ───────────────────────────────────────────────────

describe("marker", () => {
  it("[FT_TEST_PASS_VERIFY_USES_EMITTED_HASH_BUILDER_CONTRACT]", () => {
    expect(true).toBe(true);
  });
});
