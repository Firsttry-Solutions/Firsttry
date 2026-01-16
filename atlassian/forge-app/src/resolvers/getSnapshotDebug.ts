/**
 * Resolver: getSnapshotDebug
 * 
 * PHASE 2 IMPLEMENTATION:
 * Returns debug/proof panel data showing actual storage state and snapshot metadata.
 * Called after refreshNow to display proof of persistence.
 *
 * Key difference from getStatusSnapshot:
 * - Returns raw storage debug info (not normalized status)
 * - Shows snapshotCount, timestamps, storage state
 * - Used by UI proof panel for marketplace evidence
 * - Logs TENANT_PROOF on entry
 * - Logs SNAPSHOT_READ_PROOF after reading
 *
 * Fail-closed: Returns error object if tenant identity cannot be resolved.
 */

import { resolveTenantKey } from "../security/resolveTenantKey";
import { getStatusSnapshot, listEvidenceSnapshotMeta } from "../status/statusStorage";

export interface SnapshotDebugInfo {
  ok: boolean;
  tenantKeyHash?: string;
  snapshotCount?: number;
  lastSnapshotAtUtc?: string;
  lastSnapshotId?: string;
  storageState?: "EMPTY" | "NON_EMPTY";
  lastAttemptAtUtc?: string;
  lastSuccessAtUtc?: string;
  failures7d?: number;
  checksCompletedLifetime?: number;
  error?: { name: string; message: string };
}

export async function getSnapshotDebug_resolver(req: any): Promise<SnapshotDebugInfo> {
  const context = req.context || req;
  
  let tenantKey: string;
  let tenantKeyHash: string;
  
  try {
    const tenantInfo = resolveTenantKey(context);
    tenantKey = tenantInfo.tenantKey;
    tenantKeyHash = tenantInfo.tenantKeyHash;
    // TENANT_PROOF: log on entry
    console.log("TENANT_PROOF", JSON.stringify({
      resolver: "getSnapshotDebug",
      tenantKeyHash,
      source: tenantInfo.source,
      ts: new Date().toISOString()
    }));
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[getSnapshotDebug] Tenant key resolution failed: ${errorMsg}`);
    return {
      ok: false,
      error: { name: "NO_TENANT_IDENTITY", message: errorMsg },
    };
  }

  console.info(`[getSnapshotDebug] Resolving debug info for tenantKeyHash=${tenantKeyHash}`);

  try {
    // Read current status snapshot
    const snapshot = await getStatusSnapshot(tenantKey);

    if (!snapshot) {
      // No snapshot written yet
      console.log("SNAPSHOT_READ_PROOF", JSON.stringify({
        tenantKeyHash,
        snapshotCount: 0,
        storageState: "EMPTY",
        ts: new Date().toISOString()
      }));
      return {
        ok: true,
        tenantKeyHash,
        snapshotCount: 0,
        lastSnapshotAtUtc: null,
        lastSnapshotId: null,
        storageState: "EMPTY",
        lastAttemptAtUtc: null,
        lastSuccessAtUtc: null,
        failures7d: 0,
        checksCompletedLifetime: 0,
      };
    }

    // Extract debug fields from snapshot
    const snapshotCount = snapshot.storage?.snapshotCountRetained ?? 0;
    const lastSnapshotAtUtc = snapshot.storage?.lastSnapshotIso ?? null;
    const lastAttemptAtUtc = snapshot.scheduler?.lastAttemptIso ?? null;
    const lastSuccessAtUtc = snapshot.scheduler?.lastSuccessIso ?? null;
    const failures7d = snapshot.scheduler?.failures7d ?? 0;
    const checksCompletedLifetime = snapshot.checks?.length ?? 0;

    // SNAPSHOT_READ_PROOF: log proof of read
    const storageState = snapshotCount > 0 ? "NON_EMPTY" : "EMPTY";
    console.log("SNAPSHOT_READ_PROOF", JSON.stringify({
      tenantKeyHash,
      snapshotCount,
      storageState,
      ts: new Date().toISOString()
    }));

    return {
      ok: true,
      tenantKeyHash,
      snapshotCount,
      lastSnapshotAtUtc: lastSnapshotAtUtc || undefined,
      lastSnapshotId: snapshot.snapshotId,
      storageState,
      lastAttemptAtUtc: lastAttemptAtUtc || undefined,
      lastSuccessAtUtc: lastSuccessAtUtc || undefined,
      failures7d,
      checksCompletedLifetime,
    };
  } catch (err) {
    console.error(
      `[getSnapshotDebug] Resolver error:`,
      err instanceof Error ? err.message : String(err)
    );
    return {
      ok: false,
      tenantKeyHash,
      error: {
        name: err instanceof Error ? err.name : "UNKNOWN_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Hash tenant key for privacy (show hashed value in logs, not raw key)
 */
function hashTenantKey(tenantKey: string): string {
  // Use simple hash for display purposes (not cryptographic)
  let hash = 0;
  for (let i = 0; i < tenantKey.length; i++) {
    const char = tenantKey.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `hash_${Math.abs(hash).toString(16).substring(0, 8)}`;
}
