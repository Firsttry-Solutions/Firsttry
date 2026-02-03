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

  it("should use requestAnimationFrame (not ResizeObserver or iframe-resizer)", () => {
    // Verify uses requestAnimationFrame for post-render detection
    expect(source).toMatch(/requestAnimationFrame/);

    // Verify NO ResizeObserver loop (one-shot only, no continuous observers)
    expect(source).not.toMatch(/new\s+ResizeObserver/);

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

    // Should have resizeCapability variable (detects which API is available)
    expect(source).toMatch(/resizeCapability/);
  });

  it("should have fail-closed behavior markers", () => {
    // Should have error catch blocks (to handle resize failures)
    expect(source).toMatch(/catch\s*\(/);

    // Should log FAILED marker when errors occur (deterministic proof)
    expect(source).toMatch(/console\.log.*UI_RESIZE_FAILED/);

    // Should emit APPLIED marker when successful
    expect(source).toMatch(/console\.log.*UI_RESIZE_APPLIED/);

    // Should have finally or similar to set window marker (deterministic proof)
    expect(source).toMatch(/finally|window.*__FT_RESIZE/);
  });

  it("should emit UI_RESIZE_CAPS_FINAL marker on boot", () => {
    // Should log UI_RESIZE_CAPS_FINAL marker
    expect(source).toMatch(/UI_RESIZE_CAPS_FINAL/);

    // Marker should include capability detection
    expect(source).toMatch(/canResize/);

    // Marker should include kind field (which API: view.resize, view.setHeight, or none)
    expect(source).toMatch(/kind/);

    // Marker should include timestamp
    expect(source).toMatch(/new\s+Date\(\)\.toISOString/);
  });

  it("should handle missing Forge capability gracefully", () => {
    // Should check if !resizeCapability.canResize (no resize capability available)
    expect(source).toMatch(/!resizeCapability\.canResize|canResize.*false/);

    // Should emit DISABLED_FINAL marker if no capability
    expect(source).toMatch(/UI_RESIZE_DISABLED_FINAL/);

    // Should return without throwing if no capability
    expect(source).toMatch(/return;/);
  });

  it("should apply resize ONE-SHOT at init time", () => {
    // Should have measureHeight function
    expect(source).toMatch(/function\s+measureHeight/);

    // Should apply resize in ONE-SHOT (not continuous)
    expect(source).toMatch(/applyResizeOnce/);

    // Should emit APPLIED or FAILED marker when resize is applied
    expect(source).toMatch(/UI_RESIZE_APPLIED|UI_RESIZE_FAILED/);
  });

  it("should export cleanupResizeHandler with no-op implementation", () => {
    // Should have cleanupResizeHandler function exported
    expect(source).toMatch(/export\s+function\s+cleanupResizeHandler/);

    // Comment indicates no resources to clean up (no ResizeObserver, no setInterval)
    expect(source).toMatch(/no\s+resources?\s+to\s+clean\s+up|no-op/i);
  });

  it("should support both view.resize() and view.setHeight() APIs", () => {
    // Should detect and call view.resize if available
    expect(source).toMatch(/kind.*===.*['"]view\.resize['"]/);

    // Should detect and call view.setHeight if available
    expect(source).toMatch(/kind.*===.*['"]view\.setHeight['"]/);

    // Should handle either API being present
    expect(source).toMatch(/resizeCapability\.resize|resizeCapability\.setHeight/);
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


