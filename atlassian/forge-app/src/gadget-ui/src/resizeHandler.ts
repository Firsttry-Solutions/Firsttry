/**
 * Native Forge Bridge Resize Handler (No iframe-resizer)
 *
 * Implements ONE-SHOT gadget iframe height resizing using Forge bridge.
 * This is deterministic, fail-closed, and safe for Jira dashboard gadgets.
 *
 * CAPABILITY DETECTION:
 * - Detects view.resize() OR view.setHeight() at init time only
 * - Emits [UI_RESIZE_CAPS_FINAL] marker with result
 * - If neither available: emit [UI_RESIZE_DISABLED_FINAL], log once, stop
 *
 * HEIGHT APPLICATION:
 * - One-shot measure using scrollHeight / clientHeight
 * - Clamp to [200, 2000] px
 * - Call detected API
 * - Emit [UI_RESIZE_APPLIED] or [UI_RESIZE_FAILED] marker
 *
 * POST-RENDER REMEASURE:
 * - Single bounded re-measure via rAF x2 (post-render)
 * - Emit [UI_RESIZE_POST_RENDER_DONE] marker
 *
 * CSP COMPLIANCE:
 * - No inline styles, no DOM style= attributes
 * - No polling loops, no MutationObserver
 * - No setInterval, no continuous observers
 */

import { view } from "@forge/bridge";

let resizeCapability: {
  kind: "view.resize" | "view.setHeight" | "none";
  canResize: boolean;
  setHeight?: (h: number) => Promise<void> | void;
  resize?: () => Promise<void> | void;
} = { kind: "none", canResize: false };

let lastAppliedHeight = 0;
let resizeFailed = false;
let resizeApplied = false;
const MIN_HEIGHT = 200;
const MAX_HEIGHT = 2000;

/**
 * Detect resize capability from Forge bridge view object.
 * Returns capability descriptor with exactly one resize method.
 */
function detectResizeCapability(): {
  kind: "view.resize" | "view.setHeight" | "none";
  canResize: boolean;
  setHeight?: (h: number) => Promise<void> | void;
  resize?: () => Promise<void> | void;
} {
  const hasResize = typeof (view as any)?.resize === "function";
  const hasSetHeight = typeof (view as any)?.setHeight === "function";

  if (hasResize) {
    return { kind: "view.resize", canResize: true, resize: (view as any).resize };
  } else if (hasSetHeight) {
    return { kind: "view.setHeight", canResize: true, setHeight: view.setHeight };
  } else {
    return { kind: "none", canResize: false };
  }
}

/**
 * Measure desired height using layout metrics.
 * Clamps to [MIN_HEIGHT, MAX_HEIGHT].
 */
function measureHeight(): number {
  const scrollH = document.documentElement.scrollHeight;
  const clientH = document.documentElement.clientHeight;
  const bodyH = document.body.scrollHeight;
  const measured = Math.max(scrollH, clientH, bodyH);
  return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, measured));
}

/**
 * Apply resize ONE-SHOT at init time.
 * Emits [UI_RESIZE_APPLIED] or [UI_RESIZE_FAILED] marker.
 */
async function applyResizeOnce(): Promise<void> {
  if (!resizeCapability.canResize) return;

  try {
    const height = measureHeight();

    if (resizeCapability.kind === "view.resize") {
      // Try to call view.resize(height); if it fails, call without args once
      try {
        await (resizeCapability.resize as any)(height);
      } catch (argErr) {
        if ((argErr as any)?.message?.includes("argument")) {
          // Function doesn't accept arguments, try calling without args
          await (resizeCapability.resize as any)();
        } else {
          throw argErr;
        }
      }
    } else if (resizeCapability.kind === "view.setHeight") {
      await resizeCapability.setHeight!(height);
    }

    lastAppliedHeight = height;
    resizeApplied = true;
    console.log("[UI_RESIZE_APPLIED]", JSON.stringify({ height, kind: resizeCapability.kind, ts: new Date().toISOString() }));
  } catch (err) {
    resizeFailed = true;
    console.log("[UI_RESIZE_FAILED]", JSON.stringify({ kind: resizeCapability.kind, err: String(err), ts: new Date().toISOString() }));
  }
}

/**
 * Initialize native resize handling via Forge bridge.
 * ONE-SHOT at boot, plus one bounded post-render remeasure.
 * 
 * FAIL-CLOSED: Never throws. Always returns successfully.
 */
export async function initResizeHandler(): Promise<void> {
  try {
    // ====================================================================
    // CAPABILITY DETECTION: Determine which resize function is available
    // ====================================================================
    resizeCapability = detectResizeCapability();

    // ====================================================================
    // BOOT-TIME PROOF MARKER: UI_RESIZE_CAPS_FINAL
    // ====================================================================
    console.log("[UI_RESIZE_CAPS_FINAL]", JSON.stringify({
      canResize: resizeCapability.canResize,
      kind: resizeCapability.kind,
      ts: new Date().toISOString(),
    }));

    // If no resize capability, emit disabled marker and stop
    if (!resizeCapability.canResize) {
      console.log("[UI_RESIZE_DISABLED_FINAL]", JSON.stringify({
        reason: "NO_SUPPORTED_RESIZE_API",
        ts: new Date().toISOString(),
      }));
      // Set window marker for gate verification
      (window as any).__FT_RESIZE = {
        canResize: false,
        kind: "none",
        lastHeight: 0,
        applied: false,
        failed: false,
        ts: new Date().toISOString(),
      };
      return;
    }

    // ====================================================================
    // ONE-SHOT HEIGHT APPLICATION AT INIT
    // ====================================================================
    await applyResizeOnce();

    // ====================================================================
    // BOUNDED POST-RENDER REMEASURE (ONE-SHOT via rAF x2)
    // ====================================================================
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        if (resizeCapability.canResize) {
          const newHeight = measureHeight();
          if (newHeight !== lastAppliedHeight) {
            await applyResizeOnce();
          }
        }
        console.log("[UI_RESIZE_POST_RENDER_DONE]", JSON.stringify({ ts: new Date().toISOString() }));
      });
    });

  } catch (err) {
    console.error("[RESIZE_HANDLER] Initialization failed:", err);
    resizeFailed = true;
  } finally {
    // ====================================================================
    // SET WINDOW MARKER FOR DEVTOOLS GATE VERIFICATION
    // ====================================================================
    (window as any).__FT_RESIZE = {
      canResize: resizeCapability.canResize,
      kind: resizeCapability.kind,
      lastHeight: lastAppliedHeight,
      applied: resizeApplied,
      failed: resizeFailed,
      ts: new Date().toISOString(),
    };
  }
}

/**
 * Cleanup (no-op now - no continuous observers)
 */
export function cleanupResizeHandler(): void {
  // No resources to clean up: no ResizeObserver, no setInterval
}
