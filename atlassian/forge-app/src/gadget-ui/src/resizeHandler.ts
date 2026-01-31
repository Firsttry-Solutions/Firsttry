/**
 * Native Forge Bridge Resize Handler (No iframe-resizer)
 *
 * Implements gadget iframe height resizing using Forge bridge
 * without any runtime style injection or unsafe-inline CSP violations.
 *
 * APPROACH: Use ResizeObserver on document.documentElement to detect
 * content height changes, then call Forge bridge to request resize.
 *
 * CAPABILITY DETECTION:
 * - First tries view.resize(height) if available
 * - Falls back to view.setHeight(height) if available
 * - If neither, logs warning and continues (fail-closed, never throws)
 *
 * CSP COMPLIANCE:
 * - No inline styles, no style mutation, no unsafe-inline usage
 * - Uses only ResizeObserver (native API) + @forge/bridge (CSP-safe import)
 */

import { view } from "@forge/bridge";

let resizeObserver: ResizeObserver | null = null;
let lastHeight = 0;
const RESIZE_DEBOUNCE_MS = 200;
let resizeTimeout: NodeJS.Timeout | null = null;
let warningLogged = false;
let resizeFuncType: "resize" | "setHeight" | "none" = "none";

/**
 * Initialize native resize handling via Forge bridge.
 * Call this once after React app mounts.
 * 
 * FAIL-CLOSED: Never throws. Always returns successfully.
 */
export async function initResizeHandler(): Promise<void> {
  try {
    // ====================================================================
    // CAPABILITY DETECTION: Determine which resize function is available
    // ====================================================================
    const hasResize = typeof (view as any)?.resize === "function";
    const hasSetHeight = typeof (view as any)?.setHeight === "function";

    if (hasResize) {
      resizeFuncType = "resize";
    } else if (hasSetHeight) {
      resizeFuncType = "setHeight";
    } else {
      resizeFuncType = "none";
    }

    // ====================================================================
    // BOOT-TIME PROOF MARKER: UI_RESIZE_CAPS
    // ====================================================================
    const resizeCaps = {
      marker: "UI_RESIZE_CAPS",
      hasResize,
      hasSetHeight,
      resizeFuncType,
      viewKeys: Object.keys(view).slice(0, 20),
      ts: new Date().toISOString(),
    };
    console.log("[UI_RESIZE_CAPS]", JSON.stringify(resizeCaps));

    // If no resize capability, log once and continue (fail-closed)
    if (resizeFuncType === "none") {
      console.warn("[RESIZE_HANDLER] No Forge view resize capability found. Resize disabled.");
      warningLogged = true;
      return; // Gadget continues to work without resize
    }

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

    console.log("[RESIZE_HANDLER] Native Forge bridge resize initialized", {
      funcType: resizeFuncType,
    });
  } catch (err) {
    console.error("[RESIZE_HANDLER] Failed to initialize:", err);
    // Non-fatal: gadget continues to work even if resize fails
  }
}

/**
 * Request Forge bridge to resize iframe to fit content.
 * This is CSP-safe: no inline styles, just native bridge call.
 * 
 * FAIL-CLOSED: Never throws. Logs warning only once if resize not available.
 */
async function requestResize(): Promise<void> {
  try {
    // If no resize capability detected, skip (fail-closed)
    if (resizeFuncType === "none") {
      if (!warningLogged) {
        console.warn("[RESIZE_HANDLER] Resize disabled: no Forge capability found");
        warningLogged = true;
      }
      return;
    }

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
      // Use capability detection: prefer view.resize, fallback to view.setHeight
      if (resizeFuncType === "resize") {
        await (view as any).resize(height);
      } else if (resizeFuncType === "setHeight") {
        await view.setHeight(height);
      }

      console.log("[RESIZE_HANDLER] Resized to", { height, method: resizeFuncType });
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
