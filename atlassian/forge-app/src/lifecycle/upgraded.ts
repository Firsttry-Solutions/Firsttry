/**
 * App Upgrade Trigger Handler
 * 
 * PHASE: Deterministic Seed-First-Snapshot on Upgrade
 * 
 * Purpose:
 * - Ensures app upgrades ensure snapshot is valid (create if missing, repair if invalid)
 * - Calls the same seed function as install handler
 * - Provides proof markers [FT_UPGRADED_TRIGGER_*] for observability
 * 
 * Trigger: avi:forge:upgraded:app
 * Function: seedFirstSnapshotIfMissingOrRepair()
 * 
 * Result: Snapshot is seeded/repaired on upgrade, dashboard works immediately
 */

import { BACKEND_BUILD_SHA } from "../build/backend_build";
import { FT_RELEASE_VERSION } from "../release/release_version";
import { seedFirstSnapshotIfMissingOrRepair } from "./seedSnapshot";

/**
 * Main handler: Wired to avi:forge:upgraded:app trigger
 * 
 * Runs on: app upgrade (forge install --upgrade)
 * 
 * Flow:
 * 1. Log trigger start with proof markers
 * 2. Call seedFirstSnapshotIfMissingOrRepair()
 * 3. Log result (action: CREATED, SKIPPED_VALID, REPAIRED_INVALID, or FAILED)
 * 4. Return (upgrade complete)
 * 
 * Proof Markers:
 * - [FT_UPGRADED_TRIGGER_START]: Trigger fired, upgrade handler started
 * - [FT_SEED_RESULT]: Seed function result (action + snapshotId)
 * - [FT_UPGRADED_TRIGGER_END]: Trigger complete
 */
export const handler = async (event: any) => {
  const startTs = new Date().toISOString();
  
  console.log(JSON.stringify({
    marker: "[FT_UPGRADED_TRIGGER_START]",
    trigger: "avi:forge:upgraded:app",
    ts: startTs,
    buildSha: BACKEND_BUILD_SHA,
    releaseVersion: FT_RELEASE_VERSION,
    event: JSON.stringify(event || {})
  }));
  
  try {
    const result = await seedFirstSnapshotIfMissingOrRepair();
    
    // Log seed result (marker name same as installed handler for consistency)
    console.log(JSON.stringify({
      marker: "[FT_SEED_RESULT]",
      action: result.action,
      snapshotId: result.snapshotId,
      ran: result.ran,
      reason: result.reason || undefined,
      buildSha: result.buildSha,
      releaseVersion: result.releaseVersion
    }));
    
    const endTs = new Date().toISOString();
    console.log(JSON.stringify({
      marker: "[FT_UPGRADED_TRIGGER_END]",
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
      marker: "[FT_UPGRADED_TRIGGER_END]",
      action: "FAILED",
      ran: false,
      ts: new Date().toISOString(),
      error: errorMsg,
      buildSha: BACKEND_BUILD_SHA,
      releaseVersion: FT_RELEASE_VERSION
    }));
    
    console.error("[FT_UPGRADED] Fatal error during upgrade handler:", errorMsg);
    throw err;
  }
};
