/**
 * Resolver: getStatusSnapshot
 * Called on gadget load to fetch current snapshot.
 *
 * Logic:
 * 1. Resolve tenant key
 * 2. Read snapshot
 * 3. If null: create on-load snapshot with ERROR and store it
 * 4. Return snapshot NORMALIZED to GovernanceStatusV1
 *
 * PHASE 2 FIX: Also exports getBuildInfo resolver so gadget can invoke both
 * resolvers from the same handler function.
 */

import { resolveTenantIdentity } from "../core/tenant_identity";
import { 
  getStatusSnapshot as readSnapshot, 
  putStatusSnapshot, 
  createNoSchedulerSnapshot,
  createResolverErrorSnapshot 
} from "../status/statusStorage";
import { normalizeStatusV1, EMPTY_STATUS_V1, safeStorageKey, GovernanceStatusV1 } from "../shared/statusSchema";
import { FT_BUILD_SHA, FT_BUILD_TIME_UTC } from "../shared/build_meta";
// PHASE 2 FIX: Import getBuildInfo resolver to expose it alongside getStatusSnapshot
import { getBuildInfo_resolver } from "./getBuildInfo";

export async function getStatusSnapshot_resolver(req: any): Promise<GovernanceStatusV1> {
  const context = req.context || req;
  const tenantId = resolveTenantIdentity(context);
  const backendBuild = process.env.BUILD_SHA || "unknown";
  const uiBuild = "UI_v2.14.0";

  // Log backend build identifiers for deployment reconciliation
  console.log("[govdash-backend-build]", { BUILD_SHA: backendBuild, FT_BUILD_SHA, FT_BUILD_TIME_UTC, env: process.env.FORGE_ENV || process.env.NODE_ENV });
  console.log("[BUILDINFO_CALLED] Backend build snapshot request");
  console.log(`BUILDINFO_PROOF FT_BUILD_SHA=${FT_BUILD_SHA} FT_BUILD_TIME_UTC=${FT_BUILD_TIME_UTC}`);

  if (!tenantId) {
    console.error("[getStatusSnapshot] No tenant identity resolved");
    // Fail-closed: return normalized error state instead of throwing
    const errorStatus = EMPTY_STATUS_V1("UNKNOWN", backendBuild, uiBuild);
    errorStatus.health = "ERROR";
    errorStatus.degradedReason = "Could not resolve tenant context";
    return normalizeStatusV1(errorStatus, "UNKNOWN", backendBuild, uiBuild);
  }

  const tenantKey = tenantId.tenantKey;
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

    // CRITICAL: Normalize the snapshot to GovernanceStatusV1
    // This guarantees UI never receives malformed data
    return normalizeStatusV1(snapshot, tenantAri, backendBuild, uiBuild);
  } catch (err) {
    console.error(
      `[getStatusSnapshot] Resolver error:`,
      err instanceof Error ? err.message : String(err)
    );
    // Fail-closed: return normalized error state instead of throwing
    const errorStatus = EMPTY_STATUS_V1(tenantAri, backendBuild, uiBuild);
    errorStatus.health = "ERROR";
    errorStatus.degradedReason = err instanceof Error ? err.message : String(err);
    return normalizeStatusV1(errorStatus, tenantAri, backendBuild, uiBuild);
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
