import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("UI smoke production gate wiring (static)", () => {
  const root = path.resolve(__dirname, "../../");

  it("tools/ui_smoke_production_gate.ts exists", () => {
    const gatePath = path.join(root, "tools/ui_smoke_production_gate.ts");
    expect(fs.existsSync(gatePath)).toBe(true);
  });

  it("proof_mode_run.sh references the UI smoke gate", () => {
    const sh = fs.readFileSync(
      path.join(root, "tools/proof_mode_run.sh"),
      "utf8"
    );
    expect(sh.includes("ui_smoke_production_gate.ts")).toBe(true);
  });

  it("proof_mode_run.sh writes 10_ui_smoke_production.txt artifact", () => {
    const sh = fs.readFileSync(
      path.join(root, "tools/proof_mode_run.sh"),
      "utf8"
    );
    expect(sh.includes("10_ui_smoke_production.txt")).toBe(true);
  });

  it("proof_mode_run.sh conditionally runs on FT_UI_SMOKE=1", () => {
    const sh = fs.readFileSync(
      path.join(root, "tools/proof_mode_run.sh"),
      "utf8"
    );
    expect(sh.includes('FT_UI_SMOKE')).toBe(true);
    expect(sh.includes('SKIPPED')).toBe(true);
  });

  it("PROOF_MODE.md mentions 10_ui_smoke_production.txt artifact", () => {
    const doc = fs.readFileSync(
      path.join(root, "docs/enterprise-pack/PROOF_MODE.md"),
      "utf8"
    );
    expect(doc.includes("10_ui_smoke_production.txt")).toBe(true);
  });
});
