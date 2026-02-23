import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "../../");

describe("release proof tooling wiring (static)", () => {
  describe("tools/e2e_save_storage_state.mjs", () => {
    const script = path.join(root, "tools/e2e_save_storage_state.mjs");

    it("file exists", () => {
      expect(fs.existsSync(script)).toBe(true);
    });

    it("references storageState", () => {
      const src = fs.readFileSync(script, "utf8");
      expect(src.includes("storageState")).toBe(true);
    });

    it("launches headless: false", () => {
      const src = fs.readFileSync(script, "utf8");
      expect(src.includes("headless: false")).toBe(true);
    });

    it("defaults to https://firsttry.atlassian.net", () => {
      const src = fs.readFileSync(script, "utf8");
      expect(src.includes("https://firsttry.atlassian.net")).toBe(true);
    });
  });

  describe("tools/release_proof_run.sh", () => {
    const script = path.join(root, "tools/release_proof_run.sh");

    it("file exists", () => {
      expect(fs.existsSync(script)).toBe(true);
    });

    it("forces FT_UI_SMOKE=1 (non-bypassable)", () => {
      const src = fs.readFileSync(script, "utf8");
      expect(src.includes("FT_UI_SMOKE=1")).toBe(true);
    });

    it("enforces firsttry.atlassian.net/browse domain requirement", () => {
      const src = fs.readFileSync(script, "utf8");
      expect(src.includes("firsttry.atlassian.net/browse")).toBe(true);
    });

    it("runs npm run proof", () => {
      const src = fs.readFileSync(script, "utf8");
      expect(src.includes("npm run proof")).toBe(true);
    });

    it("writes sha256 sums (99_SHA256SUMS.txt)", () => {
      const src = fs.readFileSync(script, "utf8");
      expect(src.includes("99_SHA256SUMS.txt")).toBe(true);
    });

    it("writes RELEASE_PROOF_RECEIPT.txt on pass", () => {
      const src = fs.readFileSync(script, "utf8");
      expect(src.includes("RELEASE_PROOF_RECEIPT.txt")).toBe(true);
    });

    it("uses set -euo pipefail (fail-closed)", () => {
      const src = fs.readFileSync(script, "utf8");
      expect(src.includes("set -euo pipefail")).toBe(true);
    });
  });

  describe("docs/enterprise-pack/RELEASE_PROOF_RUNBOOK.md", () => {
    const doc = path.join(root, "docs/enterprise-pack/RELEASE_PROOF_RUNBOOK.md");

    it("file exists", () => {
      expect(fs.existsSync(doc)).toBe(true);
    });

    it("references e2e_save_storage_state.mjs", () => {
      const src = fs.readFileSync(doc, "utf8");
      expect(src.includes("e2e_save_storage_state.mjs")).toBe(true);
    });

    it("references release_proof_run.sh", () => {
      const src = fs.readFileSync(doc, "utf8");
      expect(src.includes("release_proof_run.sh")).toBe(true);
    });
  });
});
