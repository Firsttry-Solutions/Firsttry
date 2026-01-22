/**
 * Resolver: getStatusSnapshot
 * Called on gadget load to fetch current snapshot.
 * 
 * BACKBONE NO-THROW CONTRACT:
 * - This resolver NEVER throws
 * - On any error: returns normalized error status with stable error_code and deterministic trace_id
 * - Emits single-line JSON log on failure with trace_id and ui_req_id
 *
 * IDENTITY/PROOF CONTRACT:
 * - Every response includes: envelopeKind, ui_build_sha, backend_build_sha, correlation_id, schema_version
 * - These fields prove deployment identity and round-trip through browser
 * - UI must render these fields in proof panel
 *
 * Logic:
 * 1. Resolve tenant key
 * 2. Read snapshot
 * 3. If null: create on-load snapshot with ERROR and store it
 * 4. Return snapshot NORMALIZED to GovernanceStatusV1 with identity/proof fields
 *
 * PHASE 2 FIX: Also exports getBuildInfo resolver so gadget can invoke both
 * resolvers from the same handler function.
 */

import { resolveTenantKey, resolveTenantKeyOrNull } from "../security/resolveTenantKey";
import { 
  getStatusSnapshot as readSnapshot, 
  putStatusSnapshot, 
  createNoSchedulerSnapshot,
  createResolverErrorSnapshot 
} from "../status/statusStorage";
import { normalizeStatusV1, EMPTY_STATUS_V1, safeStorageKey, GovernanceStatusV1 } from "../shared/statusSchema";
import { FT_BUILD_SHA } from "../shared/backend_build_meta";
import { FT_BUILD_TIME_UTC } from "../shared/build_meta";
// PHASE 2 FIX: Import getBuildInfo resolver to expose it alongside getStatusSnapshot
import { getBuildInfo_resolver } from "./getBuildInfo";
import {
  classifyError,
  generateTraceIdStable,
  generateTraceIdInstance,
  emitResolverErrorLog,
  extractUiReqId,
} from "./backbone_error_handling";

export async function getStatusSnapshot_resolver(req: any): Promise<GovernanceStatusV1> {
  // BACKBONE NO-THROW CONTRACT: This resolver NEVER throws.
  // It always returns GovernanceStatusV1 shape, even on failure.
  
  const uiReqId = extractUiReqId(req);
  const context = req.context || req;
  let tenantKey: string;
  let tenantKeyHash: string;
  let tenantStatus: "OK" | "MISSING" | "UNKNOWN" = "UNKNOWN";
  
  // FT_STATUS_ENTRY: Proof that resolver was invoked
  console.log(`FT_STATUS_ENTRY ${JSON.stringify({
    marker: "FT_STATUS_ENTRY",
    resolver: "getStatusSnapshot",
    ui_req_id: uiReqId || "ui_missing",
    backend_build_sha: FT_BUILD_SHA,
    ts: new Date().toISOString()
  })}`);
  
  
  try {
    const tenantInfo = resolveTenantKey(context);
    tenantKey = tenantInfo.tenantKey;
    tenantKeyHash = tenantInfo.tenantKeyHash;
    tenantStatus = "OK";
    // TENANT_PROOF: log on entry
    console.log("TENANT_PROOF", JSON.stringify({
      resolver: "getStatusSnapshot",
      tenantKeyHash,
      source: tenantInfo.source,
      ts: new Date().toISOString()
    }));
  } catch (err) {
    // Tenant resolution failed - return error status instead of throwing
    const errorCode = classifyError(err, "getStatusSnapshot");
    const traceIdStable = generateTraceIdStable(errorCode, err, FT_BUILD_SHA);
    const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack || "" : "";

    // FT_STATUS_ERR: Tenant resolution failed
    console.log(`FT_STATUS_ERR ${JSON.stringify({
      marker: "FT_STATUS_ERR",
      resolver: "getStatusSnapshot",
      ui_req_id: uiReqId || "ui_missing",
      backend_build_sha: FT_BUILD_SHA,
      ts: new Date().toISOString(),
      error_name: err instanceof Error ? err.name : "Unknown",
      error_message: errorMsg.substring(0, 2000),
      error_stack: errorStack.substring(0, 2000)
    })}`);

    emitResolverErrorLog(
      traceIdStable,
      traceIdInstance,
      errorCode,
      errorMsg,
      FT_BUILD_SHA,
      uiReqId,
      "getStatusSnapshot"
    );

    tenantStatus = "MISSING";
    const errorStatus = EMPTY_STATUS_V1("UNKNOWN", FT_BUILD_SHA, "UI_v2.14.0");
    errorStatus.health = "ERROR";
    errorStatus.degradedReason = "Could not resolve tenant context";
    // CRITICAL: Populate identity/proof fields in error response
    return normalizeStatusV1(errorStatus, "UNKNOWN", FT_BUILD_SHA, "UI_v2.14.0");
  }

  const backendBuild = FT_BUILD_SHA || "ERROR_MISSING";
  const uiBuild = "UI_v2.14.0";
  const tenantAri = tenantKey;
  console.info(`[getStatusSnapshot] Resolving snapshot for ${tenantKey}`);

  try {
    let snapshot = await readSnapshot(tenantKey);

    if (!snapshot) {
      // Create on-load snapshot
      snapshot = createNoSchedulerSnapshot(tenantKey);
      await putStatusSnapshot(snapshot);
      console.info(`[getStatusSnapshot] No snapshot found; created on-load snapshot for ${tenantKey}`);
    }

    // SNAPSHOT_WRITE_VERIFICATION: read back after write to confirm persistence
    // This catches tenant key mismatches immediately
    const readBack = await readSnapshot(tenantKey);
    if (!readBack) {
      throw new Error(`SNAPSHOT_VERIFICATION_FAILED: snapshot not readable after write for ${tenantKey}`);
    }
    console.log("SNAPSHOT_WRITE_PROOF", JSON.stringify({
      tenantKeyHash,
      snapshotId: snapshot.snapshotId,
      verified: true,
      ts: new Date().toISOString()
    }));

    // CRITICAL: Normalize the snapshot to GovernanceStatusV1 with identity/proof contract
    // This guarantees UI never receives malformed data AND gets proof fields
    
    // FT_STATUS_OK: Resolver executed successfully
    console.log(`FT_STATUS_OK ${JSON.stringify({
      marker: "FT_STATUS_OK",
      resolver: "getStatusSnapshot",
      ui_req_id: uiReqId || "ui_missing",
      backend_build_sha: FT_BUILD_SHA,
      backend_build_time_utc: FT_BUILD_TIME_UTC,
      ts: new Date().toISOString()
    })}`);
    
    // Normalize and populate identity/proof fields
    const normalized = normalizeStatusV1(snapshot, tenantAri, backendBuild, uiBuild);
    // Explicit assignment to ensure proof fields are set
    normalized.envelopeKind = "FT_DASH_ENVELOPE_V1";
    normalized.backend_build_sha = FT_BUILD_SHA;
    normalized.backend_build_time_utc = FT_BUILD_TIME_UTC;
    normalized.schemaVersion = "v1"; // STRICT: enforce new contract version
    
    return normalized;
  } catch (err) {
    // Error reading or storing snapshot - return error status instead of throwing
    const errorCode = classifyError(err, "getStatusSnapshot");
    const traceIdStable = generateTraceIdStable(errorCode, err, FT_BUILD_SHA);
    const traceIdInstance = generateTraceIdInstance(traceIdStable, err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack || "" : "";

    // FT_STATUS_ERR: Snapshot operation failed
    console.log(`FT_STATUS_ERR ${JSON.stringify({
      marker: "FT_STATUS_ERR",
      resolver: "getStatusSnapshot",
      ui_req_id: uiReqId || "ui_missing",
      backend_build_sha: FT_BUILD_SHA,
      ts: new Date().toISOString(),
      error_name: err instanceof Error ? err.name : "Unknown",
      error_message: errorMsg.substring(0, 2000),
      error_stack: errorStack.substring(0, 2000)
    })}`);

    emitResolverErrorLog(
      traceIdStable,
      traceIdInstance,
      errorCode,
      errorMsg,
      FT_BUILD_SHA,
      uiReqId,
      "getStatusSnapshot"
    );

    const errorStatus = EMPTY_STATUS_V1(tenantAri, backendBuild, uiBuild);
    errorStatus.health = "ERROR";
    errorStatus.degradedReason = err instanceof Error ? err.message : String(err);
    // CRITICAL: Populate identity/proof fields in error response
    const normalized = normalizeStatusV1(errorStatus, tenantAri, backendBuild, uiBuild);
    normalized.backend_build_sha = FT_BUILD_SHA;
    normalized.backend_build_time_utc = FT_BUILD_TIME_UTC;
    normalized.schemaVersion = "v1";
    return normalized;
  }
}

/**
 * PHASE 2 FIX: Re-export getBuildInfo_resolver so it's available from the same handler
 * This allows the gadget UI to invoke('getBuildInfo') without requiring a separate function definition.
 * 
 * How it works:
 * - Manifest specifies: resolver.function = "get-status-snapshot-fn"
 * - Handler file (resolvers/getStatusSnapshot.ts) exports BOTH getStatusSnapshot_resolver and getBuildInfo_resolver
 * - Forge registers both under the same function handler
 * - UI can invoke both 'getStatusSnapshot' and 'getBuildInfo' from the gadget context
 */
export { getBuildInfo_resolver };
