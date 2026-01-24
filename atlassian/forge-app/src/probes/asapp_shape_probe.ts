/**
 * Traffic-independent probe that proves:
 * 1. Production is running the latest code (via FT_RELEASE_VERSION)
 * 2. @forge/api is properly imported with asApp() available
 * 3. Safe asApp() call check without side effects
 */

import api from "@forge/api";
import { FT_RELEASE_VERSION } from "../release/release_version";

// Try to access FT_BUILD_SHA; if it doesn't exist, use UNSET
let buildSha = "UNSET";
try {
  const buildMeta = require("../shared/backend_build_meta");
  buildSha = buildMeta?.FT_BUILD_SHA || "UNSET";
} catch (_) {
  // OK to fail; probe is traffic-independent anyway
}

export function asappShapeProbe(): void {
  try {
    // Log 1: Probe metadata and API shape
    console.log(JSON.stringify({
      marker: "[FT_ASAPP_PROBE] PROBE",
      release: FT_RELEASE_VERSION,
      buildSha,
      apiType: typeof api,
      hasAsApp: Boolean((api as any)?.asApp),
      keysSample: Object.keys(api as any).slice(0, 25),
      ts: new Date().toISOString(),
    }));

    // Log 2: Safe asApp() call attempt (no side effects)
    const asAppMethod = (api as any)?.asApp;
    let asAppResult: string;
    let asAppError: string | null = null;

    if (!asAppMethod) {
      asAppResult = "MISSING";
    } else if (typeof asAppMethod !== "function") {
      asAppResult = `NOT_FUNCTION (${typeof asAppMethod})`;
    } else {
      try {
        const instance = asAppMethod();
        asAppResult = instance ? "CALLABLE" : "NULL_RETURN";
      } catch (e) {
        asAppError = (e as any)?.message || String(e);
        asAppResult = "THREW";
      }
    }

    console.log(JSON.stringify({
      marker: "[FT_ASAPP_PROBE] RESULT",
      release: FT_RELEASE_VERSION,
      asAppResult,
      asAppError,
      ts: new Date().toISOString(),
    }));
  } catch (e) {
    // Probe must never crash
    console.error(JSON.stringify({
      marker: "[FT_ASAPP_PROBE] ERROR",
      message: (e as any)?.message || String(e),
      ts: new Date().toISOString(),
    }));
  }
}
