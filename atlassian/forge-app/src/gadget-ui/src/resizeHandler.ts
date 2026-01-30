/**
 * Native Forge Bridge Resize Handler (No iframe-resizer)
 *
 * Implements gadget iframe height resizing using Forge bridge
 * without any runtime style injection or unsafe-inline CSP violations.
 *
 * APPROACH: Use ResizeObserver on document.documentElement to detect
 * content height changes, then call Forge bridge to request resize.
 */

import { view } from "@forge/bridge";

let resizeObserver: ResizeObserver | null = null;
let lastHeight = 0;
const RESIZE_DEBOUNCE_MS = 200;
let resizeTimeout: NodeJS.Timeout | null = null;

/**
 * Initialize native resize handling via Forge bridge.
 * Call this once after React app mounts.
 */
export async function initResizeHandler(): Promise<void> {
  try {
    // Measure initial height
    await requestResize();

    // Set up ResizeObserver to detect future height changes
    resizeObserver = new ResizeObserver(() => {
      // Debounce resize requests
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(async () => {
        await requestResize();
      }, RESIZE_DEBOUNCE_MS);
    });

    resizeObserver.observe(document.documentElement);

    console.log("[RESIZE_HANDLER] Native Forge bridge resize initialized");
  } catch (err) {
    console.error("[RESIZE_HANDLER] Failed to initialize:", err);
    // Non-fatal: gadget continues to work even if resize fails
  }
}

/**
 * Request Forge bridge to resize iframe to fit content.
 * This is CSP-safe: no inline styles, just native bridge call.
 */
async function requestResize(): Promise<void> {
  try {
    // Get current document height
    const height = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      document.documentElement.clientHeight
    );

    // Only call bridge if height changed
    if (height !== lastHeight) {
      lastHeight = height;

      // Call Forge bridge to request resize (CSP-safe)
      await view.setHeight(height);

      console.log("[RESIZE_HANDLER] Resized to", { height });
    }
  } catch (err) {
    // Silently fail: resize is not critical to functionality
    if ((err as any)?.code !== "BRIDGE_NOT_AVAILABLE") {
      console.warn("[RESIZE_HANDLER] Resize request failed:", err);
    }
  }
}

/**
 * Cleanup resize observer.
 */
export function cleanupResizeHandler(): void {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
    resizeTimeout = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
}
