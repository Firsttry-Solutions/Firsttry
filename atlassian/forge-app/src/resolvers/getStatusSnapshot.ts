/**
 * Resolver: getStatusSnapshot
 * Called on gadget load to fetch current snapshot.
 *
 * Logic:
 * 1. Resolve tenant key
 * 2. Read snapshot
 * 3. If null: create on-load snapshot with ERROR and store it
 * 4. Return snapshot NORMALIZED to GovernanceStatusV1
 */

import { resolveTenantIdentity } from "../core/tenant_identity";
import { 
  getStatusSnapshot as readSnapshot, 
  putStatusSnapshot, 
  createNoSchedulerSnapshot,
  createResolverErrorSnapshot 
} from "../status/statusStorage";
import { normalizeStatusV1, EMPTY_STATUS_V1, safeStorageKey, GovernanceStatusV1 } from "../shared/statusSchema";

export async function getStatusSnapshot_resolver(request: any, context: any): Promise<GovernanceStatusV1> {
  const tenantId = resolveTenantIdentity(context);
  const backendBuild = process.env.BUILD_SHA || "unknown";
  const uiBuild = "UI_v2.14.0";

  if (!tenantId) {
    console.error("[getStatusSnapshot] No tenant identity resolved");
    // Fail-closed: return normalized error state instead of throwing
    const errorStatus = EMPTY_STATUS_V1("UNKNOWN", backendBuild, uiBuild);
    errorStatus.health = "ERROR";
    errorStatus.degradedReason = "Could not resolve tenant context";
    return normalizeStatusV1(errorStatus, "UNKNOWN", backendBuild, uiBuild);
  }

  const tenantKey = tenantId.tenantKey;
  const tenantAri = tenantId.ari || tenantKey;
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
