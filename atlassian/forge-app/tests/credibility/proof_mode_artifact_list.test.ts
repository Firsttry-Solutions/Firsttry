import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("proof mode artifact list", () => {
  const root = path.resolve(__dirname, "../../");

  it("PROOF_MODE.md includes 06_evidence_sha256sums.txt", () => {
    const doc = fs.readFileSync(path.join(root, "docs/enterprise-pack/PROOF_MODE.md"), "utf8");
    expect(doc).toContain("06_evidence_sha256sums.txt");
  });

  it("proof_mode_run.sh references 06_evidence_sha256sums.txt", () => {
    const script = fs.readFileSync(path.join(root, "tools/proof_mode_run.sh"), "utf8");
    expect(script).toContain("06_evidence_sha256sums.txt");
  });
});
