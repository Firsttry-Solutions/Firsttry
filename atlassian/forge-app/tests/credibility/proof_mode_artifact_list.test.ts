import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("proof mode artifact list is pinned (static)", () => {
  const root = path.resolve(__dirname, "../../");

  it("docs and script reference required artifacts", () => {
    const doc = fs.readFileSync(path.join(root, "docs/enterprise-pack/PROOF_MODE.md"), "utf8");
    const sh = fs.readFileSync(path.join(root, "tools/proof_mode_run.sh"), "utf8");

    expect(doc.includes("06_evidence_sha256sums.txt")).toBe(true);
    expect(doc.includes("07_env_versions.txt")).toBe(true);
    expect(doc.includes("08_npm_ls_depth0.txt")).toBe(true);

    expect(sh.includes("06_evidence_sha256sums.txt")).toBe(true);
    expect(sh.includes("07_env_versions.txt")).toBe(true);
    expect(sh.includes("08_npm_ls_depth0.txt")).toBe(true);
  });
});
