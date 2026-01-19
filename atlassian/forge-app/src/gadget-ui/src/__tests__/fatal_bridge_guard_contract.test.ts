import { describe, test, expect } from "vitest";
import { ensureForgeBridgeOrRenderFatal } from "../_FATAL_MISSING_FORGE_BRIDGE";

describe("_FATAL_MISSING_FORGE_BRIDGE canonical contract", () => {
  test("ensureForgeBridgeOrRenderFatal is exported as named export", () => {
    expect(typeof ensureForgeBridgeOrRenderFatal).toBe("function");
  });

  test("ensureForgeBridgeOrRenderFatal accepts HTMLElement and returns boolean", () => {
    const container = document.createElement("div");
    const result = ensureForgeBridgeOrRenderFatal(container);
    expect(typeof result).toBe("boolean");
  });

  test("contract prevents regression: function must not be default export", () => {
    // This ensures future refactors maintain the named export
    // If this test fails, it means the import contract changed
    expect(ensureForgeBridgeOrRenderFatal.name).toBe("ensureForgeBridgeOrRenderFatal");
  });
});
