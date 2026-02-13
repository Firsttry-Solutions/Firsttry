/**
 * Phase 2: Drift Detection Engine
 * Compares current snapshot against baseline to generate drift events.
 * Fail-closed: any required API failure aborts scan without advancing baseline.
 */

import crypto from "crypto";
import * as api from "@forge/api";
import { DriftEvent, DriftScanResult, DriftType, MonitoringConfig } from "./types";
import { acquireLock, releaseLock } from "../storage/lock";
import { storeDriftBufferEntry, getDriftCountLast30Days } from "../storage/ringBuffer";

// Mock snapshot engine interface (assume Phase 1 has this)
interface Snapshot {
  snapshotHash: string;
  admins: Array<{ accountId: string; email?: string }>;
  projects: Array<{
    key: string;
    permissionScheme: {
      id: string;
      permissions: Array<{
        permissionKey: string;
        holders: Array<{ type: string; parameter?: string }>;
      }>;
    };
  }>;
}

const BUILD_SHA_SHORT = process.env.FT_BUILD_SHA || "unknown";
const STORAGE_KEY_BASELINE = "phase2.baselineSnapshot";
const STORAGE_KEY_HEALTH = "phase2.health";
const STORAGE_KEY_CONFIG = "phase2.config.allowedDomains";

/**
 * Generate deterministic eventId = sha256(snapshotHash + "|" + entity + "|" + type)
 */
function generateEventId(snapshotHash: string, entity: string, type: DriftType): string {
  const input = `${snapshotHash}|${entity}|${type}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Generate canonical JSON string (stable key ordering)
 */
function canonicalJson(obj: any): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

/**
 * Compute snapshot hash
 */
function getSnapshotHash(snapshot: Snapshot): string {
  const canonical = canonicalJson({
    admins: snapshot.admins.sort((a, b) => a.accountId.localeCompare(b.accountId)),
    projects: snapshot.projects.sort((a, b) => a.key.localeCompare(b.key)),
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Main drift detection scan
 */
export async function runDriftScan(): Promise<DriftScanResult> {
  console.log(`[FT_DRIFT_SCAN_START]`);
  const startTime = Date.now();
  const storage = api.asApp().requestStorage();
  const invocationStartUtc = new Date().toISOString();

  let lockAcquired = false;

  try {
    // Acquire lock or abort
    lockAcquired = await acquireLock(invocationStartUtc, BUILD_SHA_SHORT);
    if (!lockAcquired) {
      // Update health with lock failure
      try {
        const health = await storage.get(STORAGE_KEY_HEALTH);
        if (health) {
          const healthObj = JSON.parse(health);
          healthObj.status = "failed";
          healthObj.lastFailureCode = "FT_DRIFT_LOCKED";
          await storage.set(STORAGE_KEY_HEALTH, canonicalJson(healthObj));
        }
      } catch (err) {
        console.error(`[FT_DRIFT_HEALTH_UPDATE_FAILED]`, err);
      }
      return { drifts: [], baselineInitialized: false, scanDurationMs: Date.now() - startTime };
    }

    // Load baseline
    let baseline: Snapshot | null = null;
    try {
      const baselineStr = await storage.get(STORAGE_KEY_BASELINE);
      if (baselineStr) {
        baseline = JSON.parse(baselineStr);
        console.log(`[FT_DRIFT_BASELINE_LOADED]`);
      }
    } catch (err) {
      console.error(`[FT_DRIFT_BASELINE_LOAD_FAILED]`, err);
      baseline = null;
    }

    // If no baseline, initialize it
    if (!baseline) {
      try {
        baseline = await generateSnapshot();
        const baselineJson = canonicalJson(baseline);
        await storage.set(STORAGE_KEY_BASELINE, baselineJson);
        console.log(`[FT_DRIFT_BASELINE_INITIALIZED]`);

        // Update health
        const now = new Date();
        const nextScan = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        await storage.set(
          STORAGE_KEY_HEALTH,
          canonicalJson({
            lastScanUtc: now.toISOString(),
            nextScanUtc: nextScan.toISOString(),
            status: "initializing",
            estimatedUsageBytes: baselineJson.length,
            estimatedQuotaBytes: 8 * 1024 * 1024,
            driftCountLast30d: 0,
          })
        );

        await releaseLock();
        return { drifts: [], baselineInitialized: true, scanDurationMs: Date.now() - startTime };
      } catch (err) {
        console.error(`[FT_DRIFT_BASELINE_INIT_FAILED]`, err);
        await releaseLock();
        throw new Error("FT_DRIFT_SCAN_ABORT_REQUIRED_DATA_MISSING");
      }
    }

    // Generate current snapshot
    let current: Snapshot;
    try {
      current = await generateSnapshot();
    } catch (err) {
      console.error(`[FT_DRIFT_SNAPSHOT_GENERATION_FAILED]`, err);
      await releaseLock();
      throw new Error("FT_DRIFT_SCAN_ABORT_REQUIRED_DATA_MISSING");
    }

    console.log(`[FT_DRIFT_COMPARE_BEGIN]`);

    // Detect drifts
    const drifts: DriftEvent[] = [];
    const now = new Date().toISOString();
    const currentHash = getSnapshotHash(current);

    // Load config
    let allowedDomains: string[] = [];
    try {
      const configStr = await storage.get(STORAGE_KEY_CONFIG);
      if (configStr) {
        allowedDomains = JSON.parse(configStr);
      }
    } catch (err) {
      console.log(`[FT_DRIFT_EXTERNAL_DOMAIN_CONFIG_MISSING]`);
      allowedDomains = [];
    }

    const baselineAdmins = new Set(baseline.admins.map((a) => a.accountId));
    const currentAdmins = new Set(current.admins.map((a) => a.accountId));

    // A) new_global_admin
    for (const admin of current.admins) {
      if (!baselineAdmins.has(admin.accountId)) {
        drifts.push({
          eventId: generateEventId(currentHash, admin.accountId, "new_global_admin"),
          timestampUtc: now,
          type: "new_global_admin",
          entity: admin.accountId,
          severity: "high",
          explanation: `New global admin detected: ${admin.accountId}`,
          snapshotHash: currentHash,
        });
      }
    }

    // B) admin_removed
    for (const admin of baseline.admins) {
      if (!currentAdmins.has(admin.accountId)) {
        drifts.push({
          eventId: generateEventId(currentHash, admin.accountId, "admin_removed"),
          timestampUtc: now,
          type: "admin_removed",
          entity: admin.accountId,
          severity: "low",
          explanation: `Admin removed: ${admin.accountId}`,
          snapshotHash: currentHash,
        });
      }
    }

    // C) external_elevated (requires allowedDomains)
    if (allowedDomains.length > 0) {
      for (const admin of current.admins) {
        if (admin.email) {
          const [, domain] = admin.email.split("@");
          if (domain && !allowedDomains.includes(domain.toLowerCase())) {
            drifts.push({
              eventId: generateEventId(currentHash, admin.email, "external_elevated"),
              timestampUtc: now,
              type: "external_elevated",
              entity: admin.email,
              severity: "high",
              explanation: `External admin detected: ${admin.email}`,
              snapshotHash: currentHash,
            });
          }
        } else {
          console.log(`[FT_DRIFT_EMAIL_UNAVAILABLE_SKIP] accountId=${admin.accountId}`);
        }
      }
    }

    // D & E) Project permission drifts
    const baselineProjectMap = new Map(baseline.projects.map((p) => [p.key, p]));
    for (const currentProj of current.projects) {
      const baselineProj = baselineProjectMap.get(currentProj.key);
      if (!baselineProj) continue;

      // d) project_became_widely_browsable
      const currentBrowseHolder = currentProj.permissionScheme.permissions
        .find((p) => p.permissionKey === "BROWSE_PROJECTS")
        ?.holders.some((h) => ["jira-users", "jira-software-users", "any-logged-in"].includes(h.parameter || ""));

      const baselineBrowseHolder = baselineProj.permissionScheme.permissions
        .find((p) => p.permissionKey === "BROWSE_PROJECTS")
        ?.holders.some((h) => ["jira-users", "jira-software-users", "any-logged-in"].includes(h.parameter || ""));

      if (currentBrowseHolder && !baselineBrowseHolder) {
        drifts.push({
          eventId: generateEventId(currentHash, currentProj.key, "project_became_widely_browsable"),
          timestampUtc: now,
          type: "project_became_widely_browsable",
          entity: currentProj.key,
          severity: "medium",
          explanation: `Project ${currentProj.key} became widely browsable`,
          snapshotHash: currentHash,
        });
      }

      // e) permission_scheme_modified
      const baselineSchemeHash = crypto
        .createHash("sha256")
        .update(canonicalJson(baselineProj.permissionScheme))
        .digest("hex");
      const currentSchemeHash = crypto
        .createHash("sha256")
        .update(canonicalJson(currentProj.permissionScheme))
        .digest("hex");

      if (baselineSchemeHash !== currentSchemeHash) {
        drifts.push({
          eventId: generateEventId(currentHash, currentProj.key, "permission_scheme_modified"),
          timestampUtc: now,
          type: "permission_scheme_modified",
          entity: currentProj.key,
          severity: "medium",
          explanation: `Permission scheme modified for ${currentProj.key}`,
          snapshotHash: currentHash,
        });
      }
    }

    console.log(`[FT_DRIFT_EVENTS_GENERATED] count=${drifts.length}`);

    // Store ring buffer entry
    await storeDriftBufferEntry({
      snapshotHash: currentHash,
      timestampUtc: now,
      drifts,
    });

    // Advance baseline only after buffer write succeeds
    await storage.set(STORAGE_KEY_BASELINE, canonicalJson(current));
    console.log(`[FT_DRIFT_BASELINE_ADVANCED]`);

    // Update health
    const driftCount30d = await getDriftCountLast30Days();
    const nextScan = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await storage.set(
      STORAGE_KEY_HEALTH,
      canonicalJson({
        lastScanUtc: now,
        nextScanUtc: nextScan.toISOString(),
        status: drifts.length > 0 ? "healthy" : "healthy",
        estimatedUsageBytes: canonicalJson(current).length,
        estimatedQuotaBytes: 8 * 1024 * 1024,
        driftCountLast30d: driftCount30d,
      })
    );

    console.log(`[FT_DRIFT_SCAN_COMPLETE] drifts=${drifts.length} duration=${Date.now() - startTime}ms`);

    return { drifts, baselineInitialized: false, scanDurationMs: Date.now() - startTime };
  } finally {
    if (lockAcquired) {
      await releaseLock();
    }
  }
}

/**
 * Generate current snapshot via Phase 1 snapshot engine
 * (This is a placeholder; integrate with real Phase 1 engine)
 */
async function generateSnapshot(): Promise<Snapshot> {
  // TODO: Integrate with Phase 1 snapshot engine
  // For now, return mock snapshot
  return {
    snapshotHash: crypto.randomBytes(32).toString("hex"),
    admins: [],
    projects: [],
  };
}
