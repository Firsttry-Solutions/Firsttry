/**
 * Resolver: getSnapshotVariant
 * Fetches snapshot by variant selection (latest | seed)
 * 
 * PURPOSE: A2-ui and A5 implementation
 * - A5: Allows UI to select snapshot variant
 * - A2-ui: Exposes build info + snapshot metadata for display
 * 
 * BACKBONE NO-THROW CONTRACT:
 * - This resolver NEVER throws
 * - On any error: returns normalized error envelope with safe message
 * - Emits single-line JSON log on failure with trace_id and ui_req_id
 * 
 * FAIL-CLOSED BEHAVIOR:
 * - If variant not recognized: returns NO_DATA with safe message
 * - If snapshot key missing in storage: returns NO_DATA (not error)
 * - If seed unavailable but requested: returns NO_DATA with "Seed snapshot not available"
 */

import { resolveTenantKeyOrNull } from "../security/resolveTenantKey";
import { storage } from "@forge/api";
import {
  classifyError,
  generateTraceIdStable,
  generateTraceIdInstance,
  emitResolverErrorLog,
  extractUiReqId,
} from "./backbone_error_handling";
import { FT_BUILD_SHA } from "../shared/backend_build_meta";

/**
 * SnapshotVariant response - always structured, never throws
 */
export interface SnapshotVariantResponse {
  ok: boolean;
  status: "AVAILABLE" | "NO_DATA" | "ERROR";
  variant?: "latest" | "seed";
  snapshotId?: string;
  createdAtUtc?: string;
  schemaVersion?: string;
  buildSha?: string;
  buildTimeUtc?: string;
  error?: {
    code: string;
    message: string;
    trace_id_stable?: string;
  };
  meta?: {
    ui_req_id: string;
    backend_build_sha: string;
    now_iso: string;
  };
}

export async function getSnapshotVariant_resolver(req: any): Promise<SnapshotVariantResponse> {
  // BACKBONE NO-THROW CONTRACT: This resolver NEVER throws.
  // It always returns SnapshotVariantResponse shape with ok flag.
  
  try {
    const uiReqId = extractUiReqId(req);
    const payload = req.payload || req;
    const variant: string = payload?.variant || "latest";
    const now_iso = new Date().toISOString();

    // Validate variant
    if (variant !== "latest" && variant !== "seed") {
      return {
        ok: false,
        status: "ERROR",
        error: {
          code: "INVALID_VARIANT",
          message: `Variant must be 'latest' or 'seed', got: ${variant}`
        },
        meta: {
          ui_req_id: uiReqId || "(none)",
          backend_build_sha: FT_BUILD_SHA,
          now_iso
        }
      };
    }

    // Safe tenant resolution (non-throwing)
    let tenantPresent = false;
    try {
      const tenantInfo = resolveTenantKeyOrNull(req.context || req);
      if (tenantInfo) {
        tenantPresent = true;
        console.log(`[getSnapshotVariant] Tenant resolved: ${tenantInfo.tenantKeyHash}`);
      }
    } catch (e) {
      // Ignore tenant resolution errors
      console.log(`[getSnapshotVariant] Tenant resolution failed (safe to continue)`);
    }

    // Determine storage key based on variant
    const storageKey = variant === "seed" ? "ft:snapshot:seed:v1" : "ft:snapshot:last:v1";

    let snapshotData: any = null;
    try {
      snapshotData = await storage.get(storageKey);
    } catch (storageErr) {
      // Storage access failed - return NO_DATA (not an error)
      console.log(`[getSnapshotVariant] Storage read failed for key '${storageKey}': ${storageErr instanceof Error ? storageErr.message : String(storageErr)}`);
      return {
        ok: true,  // Not an error - just no data available
        status: "NO_DATA",
        variant: variant as "latest" | "seed",
        error: {
          code: "NO_SNAPSHOT_STORED",
          message: variant === "seed" ? "Seed snapshot not available" : "Latest snapshot not available"
        },
        meta: {
          ui_req_id: uiReqId || "(none)",
          backend_build_sha: FT_BUILD_SHA,
          now_iso
        }
      };
    }

    // If no snapshot stored at key
    if (!snapshotData) {
      return {
        ok: true,  // Not an error - just no data available
        status: "NO_DATA",
        variant: variant as "latest" | "seed",
        error: {
          code: "NO_SNAPSHOT_STORED",
          message: variant === "seed" ? "Seed snapshot not available" : "Latest snapshot not available"
        },
        meta: {
          ui_req_id: uiReqId || "(none)",
          backend_build_sha: FT_BUILD_SHA,
          now_iso
        }
      };
    }

    // Extract snapshot metadata for A2-ui display
    const snapshotId = snapshotData?.data?.snapshotId || snapshotData?.snapshotId || null;
    const createdAtUtc = snapshotData?.data?.createdAtUtc || snapshotData?.createdAtUtc || null;
    const schemaVersion = snapshotData?.data?.schemaVersion || snapshotData?.schemaVersion || null;
    const buildSha = snapshotData?.meta?.backend_build_sha;

    // Get build time from snapshot if available
    let buildTimeUtc = null;
    try {
      const buildInfoSnap = snapshotData?.data?.buildInfo || snapshotData?.buildInfo;
      if (buildInfoSnap) {
        buildTimeUtc = buildInfoSnap.FT_BUILD_TIME_UTC || buildInfoSnap.buildTimeUtc || null;
      }
    } catch (e) {
      // Ignore extraction errors
    }

    // Validate minimum required fields for AVAILABLE status
    if (!snapshotId || !createdAtUtc) {
      console.log(`[getSnapshotVariant] Snapshot missing required fields: snapshotId=${!!snapshotId}, createdAtUtc=${!!createdAtUtc}`);
      return {
        ok: true,  // Not an error - just invalid snapshot
        status: "NO_DATA",
        variant: variant as "latest" | "seed",
        error: {
          code: "INVALID_SNAPSHOT",
          message: "Stored snapshot missing required fields"
        },
        meta: {
          ui_req_id: uiReqId || "(none)",
          backend_build_sha: FT_BUILD_SHA,
          now_iso
        }
      };
    }

    // Success case: return snapshot metadata
    return {
      ok: true,
      status: "AVAILABLE",
      variant: variant as "latest" | "seed",
      snapshotId,
      createdAtUtc,
      schemaVersion,
      buildSha,
      buildTimeUtc: buildTimeUtc || undefined,
      meta: {
        ui_req_id: uiReqId || "(none)",
        backend_build_sha: FT_BUILD_SHA,
        now_iso
      }
    };

  } catch (err) {
    // CATCH-ALL: Ensure we never throw. Extract error details and return error payload.
    const errorCode = classifyError(err, "getSnapshotVariant");
    const traceIdStable = generateTraceIdStable(errorCode, err, FT_BUILD_SHA);
    const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    const uiReqId = extractUiReqId(req);

    // Emit single-line JSON log (includes both trace IDs)
    emitResolverErrorLog(
      traceIdStable,
      traceIdInstance,
      errorCode,
      errorMsg,
      FT_BUILD_SHA,
      uiReqId,
      "getSnapshotVariant"
    );
    
    // Return structured error (never throw)
    return {
      ok: false,
      status: "ERROR",
      error: {
        code: errorCode,
        message: errorMsg.substring(0, 200),
        trace_id_stable: traceIdStable
      },
      meta: {
        ui_req_id: uiReqId || "(none)",
        backend_build_sha: FT_BUILD_SHA,
        now_iso: new Date().toISOString()
      }
    };
  }
}
