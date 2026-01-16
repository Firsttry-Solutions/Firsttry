/**
 * Resolver: refreshNow
 * Called when user clicks "Refresh now" button.
 *
 * Logic:
 * 1. Resolve tenant key using unified resolveTenantKey()
 * 2. Call runCollection with mode="manual"
 * 3. Return updated snapshot
 * 4. Log TENANT_PROOF and SNAPSHOT_WRITE_PROOF
 */

import { resolveTenantKey } from "../security/resolveTenantKey";
import { runCollection } from "../status/runCollection";
import { createResolverErrorSnapshot } from "../status/statusStorage";

export async function refreshNow_resolver(req: any): Promise<any> {
  const context = req.context || req;
  
  let tenantKey: string;
  let tenantKeyHash: string;
  
  try {
    const tenantInfo = resolveTenantKey(context);
    tenantKey = tenantInfo.tenantKey;
    tenantKeyHash = tenantInfo.tenantKeyHash;
    // TENANT_PROOF: log on entry
    console.log(`TENANT_PROOF resolver=refreshNow tenantKeyHash=${tenantKeyHash} source=${tenantInfo.source}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[refreshNow] Tenant key resolution failed: ${errorMsg}`);
    // Fail-closed: return error snapshot instead of throwing
    return createResolverErrorSnapshot("UNKNOWN", "NO_TENANT_IDENTITY", errorMsg);
  }

  console.info(`[refreshNow] Manual refresh triggered for tenantKeyHash=${tenantKeyHash}`);

  try {
    const snapshot = await runCollection({
      tenantKey,
      mode: "manual",
    });

    console.info(
      `[refreshNow] Refresh complete: snapshotId=${snapshot.snapshotId}, health=${snapshot.computed.health}`
    );

    return snapshot;
  } catch (err) {
    console.error(
      `[refreshNow] Resolver error:`,
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
