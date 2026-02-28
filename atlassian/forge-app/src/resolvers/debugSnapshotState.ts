/**
 * Debug Snapshot State Resolver
 * 
 * PURPOSE: Expose snapshot state without relying on UI gadget
 * - Returns snapshot validity, ID, build info
 * - Used for testing and proof capture (step 3 of upgrade verification)
 * - Logs [FT_DEBUG_SNAPSHOT_STATE] marker for observability
 * 
 * DETERMINISTIC:
 * - Read-only snapshot inspection
 * - Returns exact state (valid/invalid/missing)
 * - No snapshot creation here (uses seed function if inline repair needed)
 */

import { storage } from "@forge/api";
import { FT_SNAPSHOT_LAST_KEY } from "../backbone/keys";
import { BACKEND_BUILD_SHA } from "../build/backend_build";
import { FT_RELEASE_VERSION } from "../release/release_version";
import { isValidSnapshot } from "../lifecycle/seedSnapshot";

/**
 * Debug endpoint: Returns snapshot state for testing/verification
 * 
 * Response:
 * {
 *   hasLastKey: boolean
 *   snapshotId?: string
 *   valid?: boolean
 *   validatorError?: string
 *   buildSha: string
 *   appVersion: string
 * }
 */
export async function debugSnapshotState_resolver(): Promise<{
  hasLastKey: boolean;
  snapshotId?: string;
  valid?: boolean;
  validatorError?: string;
  buildSha: string;
  appVersion: string;
}> {
  try {
    const snapshot = await storage.get(FT_SNAPSHOT_LAST_KEY);
    
    const result = {
      hasLastKey: !!snapshot,
      snapshotId: snapshot?.snapshotId || undefined,
      valid: snapshot ? isValidSnapshot(snapshot) : undefined,
      validatorError: (() => {
        if (!snapshot) return undefined;
        if (typeof snapshot.snapshotId !== 'string' || !snapshot.snapshotId.trim())
          return "missing or invalid snapshotId";
        if (typeof snapshot.createdAtUtc !== 'string' || !snapshot.createdAtUtc.trim())
          return "missing or invalid createdAtUtc";
        if (snapshot.schemaVersion !== "L0")
          return `wrong schemaVersion: ${snapshot.schemaVersion}`;
        if (typeof snapshot.data !== 'object' || snapshot.data === null)
          return "missing or invalid data";
        if (!snapshot.createdAtUtc.endsWith('Z'))
          return "invalid ISO timestamp (must end with Z)";
        return undefined;
      })(),
      buildSha: BACKEND_BUILD_SHA || "unknown",
      appVersion: FT_RELEASE_VERSION || "unknown"
    };

    console.log(JSON.stringify({
      marker: "[FT_DEBUG_SNAPSHOT_STATE]",
      hasLastKey: result.hasLastKey,
      valid: result.valid,
      snapshotId: result.snapshotId,
      validatorError: result.validatorError,
      buildSha: result.buildSha,
      appVersion: result.appVersion
    }));

    return result;
  } catch (err) {
    // AUDIT-ALLOW: Returns structured error response with valid=false
    const errorMsg = err instanceof Error ? err.message : String(err);
    
    console.error("[FT_DEBUG_SNAPSHOT_STATE] Error:", errorMsg);
    
    return {
      hasLastKey: false,
      valid: false,
      validatorError: `Error reading snapshot: ${errorMsg}`,
      buildSha: BACKEND_BUILD_SHA || "unknown",
      appVersion: FT_RELEASE_VERSION || "unknown"
    };
  }
}
