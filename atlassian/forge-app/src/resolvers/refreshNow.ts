/**
 * Resolver: refreshNow
 * Called when user clicks "Refresh now" button.
 *
 * Logic:
 * 1. Resolve tenant key
 * 2. Call runCollection with mode="manual"
 * 3. Return updated snapshot
 */

import { resolveTenantIdentity } from "../core/tenant_identity";
import { runCollection } from "../status/runCollection";
import { createResolverErrorSnapshot } from "../status/statusStorage";

export async function refreshNow_resolver(request: any, context: any): Promise<any> {
  const tenantId = resolveTenantIdentity(context);

  if (!tenantId) {
    console.error("[refreshNow] No tenant identity resolved");
    // Fail-closed: return error snapshot instead of throwing
    return createResolverErrorSnapshot("UNKNOWN", "NO_TENANT_IDENTITY", "Could not resolve tenant context");
  }

  const tenantKey = tenantId.tenantKey;
  console.info(`[refreshNow] Manual refresh triggered for ${tenantKey}`);

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
