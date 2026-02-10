/**
 * Authoritative Operational State Resolver
 * 
 * Single source of truth for all operational metrics:
 * - Build info (UI and backend SHAs)
 * - Tenant identity (with or without error)
 * - Storage probe (can write/read)
 * - Scheduler status (configured, last fired)
 * - Snapshots (count, latest ID, times)
 * - Export availability
 * 
 * NEVER returns "unknown" for build SHAs - uses explicit error codes instead.
 * ALWAYS performs storage probe write+read to verify connectivity.
 */

import { storage } from "@forge/api";
import { resolveTenantKey } from "../security/resolveTenantKey";
import { UI_GIT_SHA } from "../gadget-ui/src/ui_build_meta";
import { FT_BUILD_SHA } from "../shared/backend_build_meta";
import { FT_BUILD_TIME_UTC } from "../shared/build_meta";

export interface OperationalState {
  nowUtc: string;
  build: {
    uiBuildSha: string;
    backendBuildSha: string;
    backendBuildTimeUtc: string;
    mismatch: boolean;
  };
  tenant: {
    tenantPresent: boolean;
    tenantKeyHash?: string;
    tenantKeySource?: string;
    errorCode?: string;
    errorMessage?: string;
  };
  storageProbe: {
    canWrite: boolean;
    canRead: boolean;
    lastProbeUtc: string;
    errorCode?: string;
    errorMessage?: string;
  };
  scheduler: {
    configured: boolean;
    lastFiredUtc?: string;
    lastRunResult?: string;
    errorCode?: string;
    errorMessage?: string;
  };
  snapshots: {
    count: number;
    latestId?: string;
    latestAtUtc?: string;
    lastSuccessUtc?: string;
    lastError?: {
      timeUtc: string;
      stage: string;
      code: string;
      message: string;
    };
  };
  export: {
    enabled: boolean;
    reasonDisabled?: string;
  };
}

/**
 * Hash tenant key for privacy-safe display
 */
function hashTenantKey(tenantKey: string): string {
  try {
    const crypto = require("crypto");
    return crypto
      .createHash("sha256")
      .update(tenantKey)
      .digest("hex")
      .substring(0, 16);
  } catch (_) {
    return `hash_${tenantKey.substring(0, 8)}`;
  }
}

/**
 * Storage key helpers
 */
function getStoragePrefix(tenantKeyHash: string): string {
  return `t/${tenantKeyHash}`;
}

/**
 * Perform storage probe: write nonce, read it back, clean up
 */
async function probeStorage(): Promise<{
  canWrite: boolean;
  canRead: boolean;
  errorCode?: string;
  errorMessage?: string;
}> {
  const probeKey = `__probe_${Date.now()}`;
  const probeValue = { nonce: Math.random().toString(36) };

  try {
    // Attempt write
    await storage.set(probeKey, probeValue);

    // Attempt read
    const readBack = await storage.get(probeKey);
    const canRead =
      readBack &&
      typeof readBack === "object" &&
      (readBack as any).nonce === probeValue.nonce;

    // Clean up
    try {
      await storage.delete(probeKey);
    } catch (_) {
      // Ignore cleanup errors
    }

    return {
      canWrite: true,
      canRead
    };
  } catch (err) {
    return {
      canWrite: false,
      canRead: false,
      errorCode: "STORAGE_PROBE_FAILED",
      errorMessage:
        err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Get operational state - comprehensive system health
 */
export async function getOperationalState_resolver(
  req: any
): Promise<OperationalState> {
  const nowUtc = new Date().toISOString();

  // ========== BUILD INFO ==========
  const uiBuildSha = UI_GIT_SHA || "ERROR_BUILD_SHA_MISSING";
  const backendBuildSha = FT_BUILD_SHA || "ERROR_BUILD_SHA_MISSING";
  const backendBuildTimeUtc = FT_BUILD_TIME_UTC || "ERROR_TIME_MISSING";
  const buildMismatch = uiBuildSha !== backendBuildSha;

  // ========== TENANT IDENTITY ==========
  let tenantPresent = false;
  let tenantKeyHash: string | undefined;
  let tenantKeySource: string | undefined;
  let tenantErrorCode: string | undefined;
  let tenantErrorMessage: string | undefined;

  try {
    const tenantInfo = resolveTenantKey(req.context || req);
    tenantPresent = true;
    tenantKeyHash = hashTenantKey(tenantInfo.tenantKey);
    tenantKeySource = tenantInfo.source;
  } catch (err) {
    tenantPresent = false;
    tenantErrorCode = "TENANT_KEY_ERROR";
    tenantErrorMessage =
      err instanceof Error ? err.message : String(err);
  }

  // ========== STORAGE PROBE ==========
  const probeResult = await probeStorage();

  // ========== SCHEDULER STATUS ==========
  // Scheduler is configured if we have scheduledTrigger in manifest
  // (hardcoded as true since we know manifest has scheduledTrigger)
  const schedulerConfigured = true;
  let lastFiredUtc: string | undefined;
  let lastRunResult: string | undefined;
  let schedulerErrorCode: string | undefined;
  let schedulerErrorMessage: string | undefined;

  if (tenantPresent && tenantKeyHash) {
    const prefix = getStoragePrefix(tenantKeyHash);
    // Use colons instead of slashes to comply with Forge storage key pattern: ^(?!\s+$)[a-zA-Z0-9:._\s-#]+$
    const lastFiredKey = `${prefix}:scheduler:lastFiredUtc`;
    const lastRunResultKey = `${prefix}:scheduler:lastRunResult`;

    try {
      const fired = await storage.get(lastFiredKey);
      if (typeof fired === "string") {
        lastFiredUtc = fired;
      }

      const result = await storage.get(lastRunResultKey);
      if (typeof result === "string") {
        lastRunResult = result;
      }
    } catch (err) {
      schedulerErrorCode = "SCHEDULER_STATE_READ_FAILED";
      schedulerErrorMessage =
        err instanceof Error ? err.message : String(err);
    }
  }

  // ========== SNAPSHOTS ==========
  let snapshotCount = 0;
  let latestId: string | undefined;
  let latestAtUtc: string | undefined;
  let lastSuccessUtc: string | undefined;
  let lastError: any | undefined;

  if (tenantPresent && tenantKeyHash) {
    const prefix = getStoragePrefix(tenantKeyHash);

    try {
      const countObj = await storage.get(`${prefix}:snapshots:count`);
      if (typeof countObj === "number") {
        snapshotCount = countObj;
      }

      const latestIdObj = await storage.get(`${prefix}:snapshots:latestId`);
      if (typeof latestIdObj === "string") {
        latestId = latestIdObj;
      }

      const latestAtUtcObj = await storage.get(
        `${prefix}:snapshots:latestAtUtc`
      );
      if (typeof latestAtUtcObj === "string") {
        latestAtUtc = latestAtUtcObj;
      }

      const lastSuccessUtcObj = await storage.get(
        `${prefix}:snapshots:lastSuccessUtc`
      );
      if (typeof lastSuccessUtcObj === "string") {
        lastSuccessUtc = lastSuccessUtcObj;
      }

      const lastErrorObj = await storage.get(`${prefix}:snapshots:lastError`);
      if (lastErrorObj && typeof lastErrorObj === "object") {
        lastError = lastErrorObj;
      }
    } catch (err) {
      console.error(
        `[getOperationalState] Failed to read snapshot metadata: ${err}`
      );
    }
  }

  // ========== EXPORT AVAILABILITY ==========
  const exportEnabled = snapshotCount > 0;
  const reasonDisabled = snapshotCount === 0 ? "No snapshots yet" : undefined;

  return {
    nowUtc,
    build: {
      uiBuildSha,
      backendBuildSha,
      backendBuildTimeUtc,
      mismatch: buildMismatch
    },
    tenant: {
      tenantPresent,
      tenantKeyHash,
      tenantKeySource,
      errorCode: tenantErrorCode,
      errorMessage: tenantErrorMessage
    },
    storageProbe: {
      canWrite: probeResult.canWrite,
      canRead: probeResult.canRead,
      lastProbeUtc: nowUtc,
      errorCode: probeResult.errorCode,
      errorMessage: probeResult.errorMessage
    },
    scheduler: {
      configured: schedulerConfigured,
      lastFiredUtc,
      lastRunResult,
      errorCode: schedulerErrorCode,
      errorMessage: schedulerErrorMessage
    },
    snapshots: {
      count: snapshotCount,
      latestId,
      latestAtUtc,
      lastSuccessUtc,
      lastError
    },
    export: {
      enabled: exportEnabled,
      reasonDisabled
    }
  };
}
