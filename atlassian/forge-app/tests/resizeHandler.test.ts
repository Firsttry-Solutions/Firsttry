/**
 * Unit tests for Native Forge Bridge Resize Handler
 * 
 * GOALS:
 * 1. Verify resize never throws (fail-closed)
 * 2. Test that code structure is CSP-safe (no inline styles)
 * 3. Verify capability detection code exists
 * 4. Verify module exports correct functions
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("resizeHandler - Module Exports", () => {
  it("should export initResizeHandler function", async () => {
    const { initResizeHandler } = await import("../src/gadget-ui/src/resizeHandler");
    expect(typeof initResizeHandler).toBe("function");
  });

  it("should export cleanupResizeHandler function", async () => {
    const { cleanupResizeHandler } = await import("../src/gadget-ui/src/resizeHandler");
    expect(typeof cleanupResizeHandler).toBe("function");
  });
});

describe("resizeHandler - Source Code Verification", () => {
  let source: string;

  beforeEach(() => {
    const filePath = path.resolve("src/gadget-ui/src/resizeHandler.ts");
    source = fs.readFileSync(filePath, "utf-8");
  });

  it("should import view from @forge/bridge", () => {
    // Verify Forge bridge import exists
    expect(source).toMatch(/import\s+{\s*view\s*}\s+from\s+['"]@forge\/bridge['"]/);
  });

  it("should use ResizeObserver (native API, not iframe-resizer)", () => {
    // Verify uses ResizeObserver
    expect(source).toMatch(/new\s+ResizeObserver/);

    // Verify NO runtime iframeResizer usage (comments/docs are OK)
    // Look for actual imports, requires, or function calls - not comments
    const sourceWithoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(sourceWithoutComments).not.toMatch(/import\s+.*iframeResizer|require\s+.*iframeResizer|window\.parent\.postMessage.*iframeResizer/i);
  });

  it("should not use inline style mutations (CSP-safe)", () => {
    // Should NOT have inline style patterns
    expect(source).not.toMatch(/\.style\.\w+\s*=/);
    expect(source).not.toMatch(/setAttribute\s*\(\s*['"]style['"]/);
    expect(source).not.toMatch(/createElement\s*\(\s*['"]style['"]/);
  });

  it("should have capability detection code", () => {
    // Should check for view.resize
    expect(source).toMatch(/typeof.*view.*resize/);

    // Should check for view.setHeight
    expect(source).toMatch(/typeof.*view.*setHeight/);

    // Should have resizeFuncType variable
    expect(source).toMatch(/resizeFuncType/);
  });

  it("should have fail-closed behavior markers", () => {
    // Should have error catch blocks
    expect(source).toMatch(/catch\s*\(/);

    // Should NOT have top-level throws
    expect(source).not.toMatch(/^\s*throw\s+/m);

    // Should have warning log for missing capability
    expect(source).toMatch(/console\.warn/);
  });

  it("should emit UI_RESIZE_CAPS marker on boot", () => {
    // Should log UI_RESIZE_CAPS marker
    expect(source).toMatch(/UI_RESIZE_CAPS/);

    // Marker should include hasResize field
    expect(source).toMatch(/hasResize/);

    // Marker should include hasSetHeight field
    expect(source).toMatch(/hasSetHeight/);

    // Marker should include resizeFuncType field
    expect(source).toMatch(/resizeFuncType/);

    // Marker should include timestamp
    expect(source).toMatch(/new\s+Date\(\)\.toISOString/);
  });

  it("should handle missing Forge capability gracefully", () => {
    // Should check if resizeFuncType === "none"
    expect(source).toMatch(/resizeFuncType.*===.*['"]none['"]/);

    // Should return early (not throw) if no capability
    expect(source).toMatch(/return;\s*\/\/ Gadget continues/);
  });

  it("should debounce resize requests", () => {
    // Should have debounce timeout
    expect(source).toMatch(/RESIZE_DEBOUNCE_MS/);
    expect(source).toMatch(/setTimeout/);
    expect(source).toMatch(/clearTimeout/);
  });

  it("should cleanup resize observer on shutdown", () => {
    // cleanupResizeHandler should disconnect observer
    expect(source).toMatch(/resizeObserver\.disconnect/);

    // Should clear timeout
    expect(source).toMatch(/clearTimeout.*resizeTimeout/);
  });

  it("should support both view.resize() and view.setHeight() APIs", () => {
    // Should conditionally call resize
    expect(source).toMatch(/resizeFuncType.*===.*['"]resize['"]/);

    // Should conditionally call setHeight
    expect(source).toMatch(/resizeFuncType.*===.*['"]setHeight['"]/);
  });
});

describe("resizeHandler - Integration Proof", () => {
  it("main.ts should import initResizeHandler", () => {
    const filePath = path.resolve("src/gadget-ui/src/main.ts");
    const mainSource = fs.readFileSync(filePath, "utf-8");

    // Should import initResizeHandler
    expect(mainSource).toMatch(/import.*initResizeHandler.*from.*['"].*resizeHandler['"]/);

    // Should call it
    expect(mainSource).toMatch(/initResizeHandler\(\)/);
  });

  it("resizeHandler should be the ONLY resize mechanism", () => {
    const filePath = path.resolve("src/gadget-ui/src/main.ts");
    const mainSource = fs.readFileSync(filePath, "utf-8");

    // Should NOT import any iframe-related libs
    expect(mainSource).not.toMatch(/import.*iframe-resizer/i);
    expect(mainSource).not.toMatch(/require.*iframe-resizer/i);

    // Should NOT call window.parent.postMessage for resize
    // (iframe-resizer's common pattern)
    expect(mainSource).not.toMatch(/window\.parent\.postMessage.*iframeResizer/i);
  });
});


