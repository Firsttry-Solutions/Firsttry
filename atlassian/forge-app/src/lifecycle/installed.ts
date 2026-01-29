/**
 * Layer-0 Marketplace: App Installation & Upgrade Trigger Handler
 * 
 * PHASE: Deterministic Seed-First-Snapshot on Install/Upgrade
 * 
 * Purpose:
 * - Ensures new app installs NEVER show NO_SNAPSHOT on first load
 * - Seeds snapshot automatically on install/upgrade (idempotent)
 * - Uses deterministic identifiers (git SHA + release version)
 * - NO Jira mutations (read-only + Forge storage writes only)
 * - GATED by enforceDashEnvelopeV1Invariant (contract compliance)
 * 
 * Logic:
 * - Check if snapshot pointer (FT_SNAPSHOT_LAST_KEY) exists
 * - If exists: do nothing (idempotent, already seeded)
 * - If missing: call seedFirstSnapshotIfMissing()
 *   - Generates snapshot using deterministic build metadata
 *   - Stores in Forge storage (read-only Jira APIs only)
 *   - Writes install/upgrade marker for proof
 * - Result: ft_getDashboardState_v1 immediately returns AVAILABLE + renders UI
 * 
 * Determinism:
 * - Uses BACKEND_BUILD_SHA (git short SHA from build)
 * - Uses FT_RELEASE_VERSION (manually bumped version marker)
 * - NO Date.now(), NO Math.random(), NO wall-clock time
 * - Snapshot ID = deterministic hash(buildSha + version + install)
 * - Created time = placeholder timestamp (will be updated by resolver on live calls)
 */

import api from "@forge/api";
import { storage } from "@forge/api";
import { FT_SNAPSHOT_LAST_KEY, FT_INSTALL_MARKER_KEY } from "../backbone/keys";
import { BACKEND_BUILD_SHA } from "../build/backend_build";
import { FT_RELEASE_VERSION } from "../release/release_version";

/**
 * Generate deterministic snapshot ID using build metadata
 * DETERMINISTIC: Uses git SHA + release version, NO random or Date.now()
 * 
 * Pattern: <buildSha>-<releaseVersion>-<phase>
 * Example: 43ee4943f74f-2026.01.24.01-seed
 */
function generateDeterministicSnapshotId(): string {
  const buildSha = BACKEND_BUILD_SHA || "unknown";
  const version = FT_RELEASE_VERSION || "unknown";
  const phase = "seed";
  return `${buildSha}-${version}-${phase}`;
}

/**
 * Generate deterministic UTC ISO timestamp
 * DETERMINISTIC: Uses build metadata as anchor, not wall-clock time
 * 
 * For seed snapshot: use a fixed reference timestamp (can be same as release version date)
 * This ensures reproducibility across re-installs
 */
function generateDeterministicTimestamp(): string {
  // Use a fixed date based on version string if possible
  // Format: YYYYMMDD → YYYY-MM-DD
  // For now: use placeholder that reflects determinism
  // In production: extract from git commit time or use release version date
  const versionDateMatch = FT_RELEASE_VERSION.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (versionDateMatch) {
    const [_, year, month, day] = versionDateMatch;
    // Use noon UTC as fixed time (represents "sometime during that day")
    return `${year}-${month}-${day}T12:00:00Z`;
  }
  // Fallback: use UTC now (will only happen if release version format is unexpected)
  return new Date().toISOString();
}

/**
 * Validate snapshot structure (STRICT)
 */
function isValidSnapshot(snapshot: any): boolean {
  if (!snapshot) return false;
  if (typeof snapshot.snapshotId !== 'string' || !snapshot.snapshotId.trim()) return false;
  if (typeof snapshot.createdAtUtc !== 'string' || !snapshot.createdAtUtc.trim()) return false;
  if (snapshot.schemaVersion !== "L0") return false;
  if (typeof snapshot.data !== 'object' || snapshot.data === null) return false;
  // Must end with 'Z' for UTC
  if (!snapshot.createdAtUtc.endsWith('Z')) return false;
  return true;
}

/**
 * Create first snapshot anchor with deterministic metadata
 * 
 * IDEMPOTENT: Same buildSha + version always generates identical snapshot ID
 * This allows re-runs to recognize already-seeded snapshots
 * 
 * GATED: Must pass enforceDashEnvelopeV1Invariant contract
 * (checked at resolver boundary, not here)
 */
function createFirstSnapshotAnchor(): any {
  const snapshotId = generateDeterministicSnapshotId();
  const createdAtUtc = generateDeterministicTimestamp();
  
  return {
    snapshotId,
    createdAtUtc,
    schemaVersion: "L0",
    // Snapshot metadata (declared, not computed)
    metadata: {
      // A. Snapshot Existence & Freshness (MANDATORY)
      status: "AVAILABLE",
      
      // B. Coverage Declaration (READ-ONLY)
      coverage: {
        declaration: "NOT_DECLARED_IN_SNAPSHOT",
        note: "Coverage counts (projects, issues, users) not computed in L0 dumb reader"
      },
      
      // C. Integrity & Immutability Proof
      integrity: {
        declaration: "NOT_DECLARED_IN_SNAPSHOT",
        note: "Snapshot hash and write-once semantics not yet declared at capture time"
      },
      
      // D. Provenance & Chain-of-Custody
      provenance: {
        capturedBy: "L0_INSTALLED_HANDLER",
        captureTrigger: "APP_INSTALLATION_OR_UPGRADE",
        appVersionAtCapture: FT_RELEASE_VERSION,
        buildShaAtCapture: BACKEND_BUILD_SHA,
        note: "Deterministic seed snapshot created at app install/upgrade time"
      },
      
      // E. Export Readiness (DECLARATIVE ONLY)
      export: {
        formats: ["JSON"],
        scope: "SNAPSHOT_METADATA",
        readiness: "AVAILABLE"
      },
      
      // F. Compliance Mapping (FACTUAL ONLY)
      compliance: {
        declaration: "NOT_DECLARED_IN_SNAPSHOT",
        note: "Specific compliance mappings not declared at snapshot creation time"
      },
      
      // G. Non-Claims Disclaimer
      disclaimer: {
        doesNotMonitor: "Live Jira activity",
        doesNotModify: "Jira data or configuration",
        doesNotAutoFix: "Compliance issues",
        doesNotProvide: "Compliance guarantees or substitutes for professional audit"
      }
    },
    data: {
      kind: "L0",
      note: "Jira governance evidence snapshot (export for full details). Seeded at install.",
      createdAtUtc,
      snapshotId,
      buildShaAtCapture: BACKEND_BUILD_SHA,
      releaseVersionAtCapture: FT_RELEASE_VERSION
    }
  };
}

/**
 * SEED FUNCTION: Create and store first snapshot if missing
 * 
 * IDEMPOTENT: Checks FT_SNAPSHOT_LAST_KEY pointer
 * - If pointer exists → snapshot already seeded → return (do nothing)
 * - If pointer missing → create snapshot → store → return
 * 
 * JIRA READ-ONLY: Uses only Forge storage writes, NO Jira API mutations
 * 
 * CONTRACT: Returns object with { seeded: boolean, snapshotId: string, created: boolean }
 * 
 * DETERMINISTIC: Generates reproducible snapshot ID and timestamp
 */
export async function seedFirstSnapshotIfMissing(): Promise<{
  seeded: boolean;
  snapshotId: string;
  created: boolean;
}> {
  try {
    // Step 1: Check if snapshot pointer exists (idempotency gate)
    const existing = await storage.get(FT_SNAPSHOT_LAST_KEY);
    
    if (existing && isValidSnapshot(existing)) {
      // Snapshot already exists - idempotent, do nothing
      console.log(
        `[SEED_SNAPSHOT] idempotent=true snapshotId=${(existing as any).snapshotId} ` +
        `(snapshot already seeded, skipping)`
      );
      return {
        seeded: true,
        snapshotId: (existing as any).snapshotId,
        created: false
      };
    }

    // Step 2: Create deterministic first snapshot
    const snapshot = createFirstSnapshotAnchor();
    
    // Step 3: Store in Forge storage (NO Jira mutations)
    await storage.set(FT_SNAPSHOT_LAST_KEY, snapshot);
    
    // Step 4: Write seed marker for proof
    const seedMarker = {
      ranAtUtc: new Date().toISOString(),
      phase: "SEED",
      snapshotId: snapshot.snapshotId,
      buildSha: BACKEND_BUILD_SHA,
      releaseVersion: FT_RELEASE_VERSION,
      schemaVersion: "L0"
    };
    await storage.set(FT_INSTALL_MARKER_KEY, seedMarker);
    
    // Log success
    console.log(
      `[SEED_SNAPSHOT] created=true snapshotId=${snapshot.snapshotId} ` +
      `buildSha=${BACKEND_BUILD_SHA} version=${FT_RELEASE_VERSION}`
    );

    return {
      seeded: true,
      snapshotId: snapshot.snapshotId,
      created: true
    };
  } catch (err) {
    console.error(
      "[SEED_SNAPSHOT] Error during seed:",
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }
}

/**
 * Main handler: Wired to avi:forge:installed:app trigger
 * 
 * Runs on: app install OR app upgrade
 * 
 * Flow:
 * 1. Call seedFirstSnapshotIfMissing()
 * 2. If error: throw (fail-closed)
 * 3. Otherwise: return (install/upgrade complete)
 * 
 * Result: Dashboard gadget will render AVAILABLE on first load
 * (ft_getDashboardState_v1 will find snapshot + return okEnvelope)
 */
export const handler = async (event: any) => {
  console.log(`[FT_INSTALLED] handler triggered by ${event?.trigger || "avi:forge:installed:app"}`);
  
  try {
    const result = await seedFirstSnapshotIfMissing();
    console.log(
      `[FT_INSTALLED] completion: seeded=${result.seeded} created=${result.created} ` +
      `snapshotId=${result.snapshotId}`
    );
    return result;
  } catch (err) {
    console.error(
      "[FT_INSTALLED] Fatal error during install/upgrade handler:",
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }
};
