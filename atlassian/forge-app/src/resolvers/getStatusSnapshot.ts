/**
 * Resolver: getStatusSnapshot
 * Called on gadget load to fetch current snapshot.
 *
 * Logic:
 * 1. Resolve tenant key
 * 2. Read snapshot
 * 3. If null: create on-load snapshot with ERROR and store it
 * 4. Return snapshot
 */

import { resolveTenantIdentity } from "../core/tenant_identity";
import { 
  getStatusSnapshot as readSnapshot, 
  putStatusSnapshot, 
  createNoSchedulerSnapshot,
  createResolverErrorSnapshot 
} from "../status/statusStorage";

export async function getStatusSnapshot_resolver(request: any, context: any): Promise<any> {
  const tenantId = resolveTenantIdentity(context);

  if (!tenantId) {
    console.error("[getStatusSnapshot] No tenant identity resolved");
    // Fail-closed: return error snapshot instead of throwing
    return createResolverErrorSnapshot("UNKNOWN", "NO_TENANT_IDENTITY", "Could not resolve tenant context");
  }

  const tenantKey = tenantId.tenantKey;
  console.info(`[getStatusSnapshot] Resolving snapshot for ${tenantKey}`);

  try {
    let snapshot = await readSnapshot(tenantKey);

    if (!snapshot) {
      // Create on-load snapshot
      snapshot = createNoSchedulerSnapshot(tenantKey);
      await putStatusSnapshot(snapshot);
      console.info(`[getStatusSnapshot] No snapshot found; created on-load snapshot for ${tenantKey}`);
    }

    return snapshot;
  } catch (err) {
    console.error(
      `[getStatusSnapshot] Resolver error:`,
      err instanceof Error ? err.message : String(err)
    );
    // Fail-closed: return error snapshot instead of throwing
    return createResolverErrorSnapshot(
      tenantKey,
      "RESOLVER_ERROR",
      err instanceof Error ? err.message : String(err)
    );
  }
}
