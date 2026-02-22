import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("proof mode gate exists", () => {
  const root = path.resolve(__dirname, "../../");

  it("tools/proof_mode_run.sh exists and is executable", () => {
    const p = path.join(root, "tools/proof_mode_run.sh");
    expect(fs.existsSync(p)).toBe(true);
    const stat = fs.statSync(p);
    // Check owner-execute bit
    expect(stat.mode & 0o100).not.toBe(0);
  });

  it("tools/proof_no_skips_gate.js exists", () => {
    const p = path.join(root, "tools/proof_no_skips_gate.js");
    expect(fs.existsSync(p)).toBe(true);
  });
});
