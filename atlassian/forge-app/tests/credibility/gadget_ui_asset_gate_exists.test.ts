import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("gadget-ui asset integrity gate wiring (static)", () => {
  const root = path.resolve(__dirname, "../../");

  it("tools/gadget_ui_asset_integrity_gate.js exists", () => {
    const gatePath = path.join(root, "tools/gadget_ui_asset_integrity_gate.js");
    expect(fs.existsSync(gatePath)).toBe(true);
  });

  it("proof_mode_run.sh references the asset integrity gate", () => {
    const sh = fs.readFileSync(
      path.join(root, "tools/proof_mode_run.sh"),
      "utf8"
    );
    expect(sh.includes("gadget_ui_asset_integrity_gate.js")).toBe(true);
  });

  it("PROOF_MODE.md mentions 09_gadget_ui_asset_integrity.txt artifact", () => {
    const doc = fs.readFileSync(
      path.join(root, "docs/enterprise-pack/PROOF_MODE.md"),
      "utf8"
    );
    expect(doc.includes("09_gadget_ui_asset_integrity.txt")).toBe(true);
  });
});
