/**
 * Layer-0 Marketplace: App Installation Trigger Handler
 * 
 * PHASE: Deterministic Seed-First-Snapshot on Install
 * 
 * Purpose:
 * - Ensures new app installs NEVER show NO_SNAPSHOT on first load
 * - Seeds snapshot automatically on install (idempotent)
 * - Uses deterministic identifiers (git SHA + release version)
 * - NO Jira mutations (read-only + Forge storage writes only)
 * - GATED by enforceDashEnvelopeV1Invariant (contract compliance)
 * 
 * Logic:
 * - Check if snapshot pointer (FT_SNAPSHOT_LAST_KEY) exists
 * - If exists: do nothing (idempotent, already seeded)
 * - If missing: call seedFirstSnapshotIfMissingOrRepair()
 *   - Generates snapshot using deterministic build metadata
 *   - Stores in Forge storage (read-only Jira APIs only)
 *   - Writes install marker for proof
 * - Result: ft_getDashboardState_v1 immediately returns AVAILABLE + renders UI
 * 
 * Determinism:
 * - Uses BACKEND_BUILD_SHA (git short SHA from build)
 * - Uses FT_RELEASE_VERSION (manually bumped version marker)
 * - NO Date.now(), NO Math.random(), NO wall-clock time
 * - Snapshot ID = deterministic hash(buildSha + version + install)
 * - Created time = placeholder timestamp (will be updated by resolver on live calls)
 */

import { BACKEND_BUILD_SHA } from "../build/backend_build";
import { FT_RELEASE_VERSION } from "../release/release_version";
import { seedFirstSnapshotIfMissingOrRepair } from "./seedSnapshot";

/**
 * Backward compatibility alias
 * New code should use seedFirstSnapshotIfMissingOrRepair from seedSnapshot.ts
 */
export async function seedFirstSnapshotIfMissing() {
  return seedFirstSnapshotIfMissingOrRepair();
}

/**
 * Main handler: Wired to avi:forge:installed:app trigger
 * 
 * Runs on: app install (NOT upgrade - use upgraded.ts handler for upgrades)
 * 
 * Flow:
 * 1. Call seedFirstSnapshotIfMissingOrRepair()
 * 2. Log result
 * 3. Return (install complete)
 * 
 * Result: Dashboard gadget will render AVAILABLE on first load
 * (ft_getDashboardState_v1 will find snapshot + return okEnvelope)
 */
export const handler = async (event: any) => {
  const startTs = new Date().toISOString();
  
  console.log(JSON.stringify({
    marker: "[FT_INSTALLED_TRIGGER_START]",
    trigger: event?.trigger || "avi:forge:installed:app",
    ts: startTs,
    buildSha: BACKEND_BUILD_SHA,
    releaseVersion: FT_RELEASE_VERSION
  }));
  
  try {
    const result = await seedFirstSnapshotIfMissingOrRepair();
    
    const endTs = new Date().toISOString();
    console.log(JSON.stringify({
      marker: "[FT_INSTALLED_TRIGGER_END]",
      action: result.action,
      snapshotId: result.snapshotId,
      ran: result.ran,
      ts: endTs,
      buildSha: result.buildSha,
      releaseVersion: result.releaseVersion
    }));
    
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    
    console.log(JSON.stringify({
      marker: "[FT_INSTALLED_TRIGGER_END]",
      action: "FAILED",
      ran: false,
      ts: new Date().toISOString(),
      error: errorMsg,
      buildSha: BACKEND_BUILD_SHA,
      releaseVersion: FT_RELEASE_VERSION
    }));
    
    console.error("[FT_INSTALLED] Fatal error during install handler:", errorMsg);
    throw err;
  }
};
 * 
 * Runs on: app install (NOT upgrade - use upgraded.ts handler for upgrades)
 * 
 * Flow:
 * 1. Call seedFirstSnapshotIfMissingOrRepair()
 * 2. Log result
 * 3. Return (install complete)
 * 
 * Result: Dashboard gadget will render AVAILABLE on first load
 * (ft_getDashboardState_v1 will find snapshot + return okEnvelope)
 */
export const handler = async (event: any) => {
  const startTs = new Date().toISOString();
  
  console.log(JSON.stringify({
    marker: "[FT_INSTALLED_TRIGGER_START]",
    trigger: event?.trigger || "avi:forge:installed:app",
    ts: startTs,
    buildSha: BACKEND_BUILD_SHA,
    releaseVersion: FT_RELEASE_VERSION
  }));
  
  try {
    const result = await seedFirstSnapshotIfMissingOrRepair();
    
    const endTs = new Date().toISOString();
    console.log(JSON.stringify({
      marker: "[FT_INSTALLED_TRIGGER_END]",
      action: result.action,
      snapshotId: result.snapshotId,
      ran: result.ran,
      ts: endTs,
      buildSha: result.buildSha,
      releaseVersion: result.releaseVersion
    }));
    
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    
    console.log(JSON.stringify({
      marker: "[FT_INSTALLED_TRIGGER_END]",
      action: "FAILED",
      ran: false,
      ts: new Date().toISOString(),
      error: errorMsg,
      buildSha: BACKEND_BUILD_SHA,
      releaseVersion: FT_RELEASE_VERSION
    }));
    
    console.error("[FT_INSTALLED] Fatal error during install handler:", errorMsg);
    throw err;
  }
};
