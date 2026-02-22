/**
 * Contract test: verify.js REQUIRED_FILES must include control-mapping.json
 *
 * Static source analysis — reads reviewPack.ts as text and asserts the
 * verify.js template string contains "control-mapping.json" in its
 * REQUIRED_FILES array.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("verify.js contract: REQUIRED_FILES includes control-mapping.json", () => {
  const sourceFile = path.resolve(
    __dirname,
    "../../src/export/reviewPack.ts"
  );

  it("reviewPack.ts source must exist", () => {
    expect(fs.existsSync(sourceFile)).toBe(true);
  });

  it("verify.js template REQUIRED_FILES array contains 'control-mapping.json'", () => {
    const source = fs.readFileSync(sourceFile, "utf8");

    // Extract the verify.js template string (between generateVerifyScript return ` and closing `)
    const verifyStart = source.indexOf("private static generateVerifyScript");
    expect(verifyStart).toBeGreaterThan(-1);

    const verifyBlock = source.slice(verifyStart, verifyStart + 3000);

    // Find the REQUIRED_FILES array inside the template
    const reqStart = verifyBlock.indexOf("const REQUIRED_FILES = [");
    expect(reqStart).toBeGreaterThan(-1);

    const reqEnd = verifyBlock.indexOf("];", reqStart);
    expect(reqEnd).toBeGreaterThan(reqStart);

    const reqArray = verifyBlock.slice(reqStart, reqEnd + 2);

    expect(reqArray).toContain('"control-mapping.json"');
  });

  it("class-level REQUIRED_FILES also includes control-mapping.json", () => {
    const source = fs.readFileSync(sourceFile, "utf8");

    // The class-level static readonly REQUIRED_FILES should also list it
    const classReqMatch = source.match(
      /static readonly REQUIRED_FILES\s*=\s*\[([\s\S]*?)\];/
    );
    expect(classReqMatch).not.toBeNull();

    const classReqBlock = classReqMatch![1];
    expect(classReqBlock).toContain('"control-mapping.json"');
  });
});
