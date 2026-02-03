/**
 * DEVTOOLS GATE: Jira Gadget-Safe Resize Verification
 * 
 * Paste this entire script into the browser DevTools console (F12).
 * It checks that the resize capability was correctly detected and applied.
 * 
 * Output: Single line with FT_RESIZE_STATUS=PASS|FAIL and details.
 */

(function() {
  console.log("[FT_RESIZE_GATE_START]");

  const resize = window.__FT_RESIZE;

  if (!resize) {
    console.log("FT_RESIZE_STATUS=FAIL reason=NO_WINDOW_MARKER canResize=false kind=unknown applied=false failed=false height=0");
    return {
      status: "FAIL",
      reason: "window.__FT_RESIZE not set",
      canResize: false,
      kind: "unknown",
      applied: false,
      failed: false,
      height: 0,
    };
  }

  // Verify the marker has expected shape
  const hasCanResize = typeof resize.canResize === "boolean";
  const hasKind = typeof resize.kind === "string";
  const hasApplied = typeof resize.applied === "boolean";
  const hasFailed = typeof resize.failed === "boolean";
  const hasLastHeight = typeof resize.lastHeight === "number";
  const hasTs = typeof resize.ts === "string";

  if (!hasCanResize || !hasKind || !hasApplied || !hasFailed || !hasLastHeight || !hasTs) {
    console.log(
      `FT_RESIZE_STATUS=FAIL reason=INVALID_MARKER_SHAPE canResize=${resize.canResize} kind=${resize.kind} applied=${resize.applied} failed=${resize.failed} height=${resize.lastHeight}`
    );
    return {
      status: "FAIL",
      reason: "Invalid window.__FT_RESIZE shape",
      ...resize,
    };
  }

  // Verify logic: 
  // - If canResize=true: either applied=true OR failed=true (but not both)
  // - If canResize=false: applied=false AND failed=false
  // - If canResize=true and applied=true: lastHeight must be in [200, 2000]

  const logicValid =
    (resize.canResize && (resize.applied || resize.failed) && !(resize.applied && resize.failed)) ||
    (!resize.canResize && !resize.applied && !resize.failed);

  const heightValid =
    resize.applied === false || (resize.lastHeight >= 200 && resize.lastHeight <= 2000);

  const pass = logicValid && heightValid;

  if (pass) {
    console.log(
      `FT_RESIZE_STATUS=PASS canResize=${resize.canResize} kind=${resize.kind} applied=${resize.applied} failed=${resize.failed} height=${resize.lastHeight}`
    );
  } else {
    const failReason = !logicValid
      ? "LOGIC_VIOLATED"
      : !heightValid
      ? "HEIGHT_OUT_OF_BOUNDS"
      : "UNKNOWN";
    console.log(
      `FT_RESIZE_STATUS=FAIL reason=${failReason} canResize=${resize.canResize} kind=${resize.kind} applied=${resize.applied} failed=${resize.failed} height=${resize.lastHeight}`
    );
  }

  return {
    status: pass ? "PASS" : "FAIL",
    canResize: resize.canResize,
    kind: resize.kind,
    applied: resize.applied,
    failed: resize.failed,
    height: resize.lastHeight,
    ts: resize.ts,
  };
})();
