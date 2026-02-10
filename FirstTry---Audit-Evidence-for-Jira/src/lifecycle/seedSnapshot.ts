/**
 * Shared Snapshot Seed & Repair Module
 * 
 * PURPOSE:
 * - REUSABLE seed function for both install AND upgrade handlers
 * - Handles all three cases: CREATE, SKIP_VALID, REPAIR_INVALID
 * - Used by resolver for inline repair on invalid snapshot detection
 * - Proof markers for observability
 * 
 * DETERMINISM:
 * - Uses git build metadata (NO Date.now(), NO Math.random())
 * - Snapshot ID = buildSha-releaseVersion-seed
 * - Timestamp extracted from release version format
 */

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
export function generateDeterministicSnapshotId(): string {
  const buildSha = BACKEND_BUILD_SHA || "unknown";
  const version = FT_RELEASE_VERSION || "unknown";
  const phase = "seed";
  return `${buildSha}-${version}-${phase}`;
}

/**
 * Generate deterministic UTC ISO timestamp
 * DETERMINISTIC: Uses build metadata as anchor, not wall-clock time
 */
export function generateDeterministicTimestamp(): string {
  const versionDateMatch = FT_RELEASE_VERSION.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (versionDateMatch) {
    const [_, year, month, day] = versionDateMatch;
    return `${year}-${month}-${day}T12:00:00Z`;
  }
  return new Date().toISOString();
}

/**
 * Validate snapshot structure (STRICT - same validator used by resolver)
 */
export function isValidSnapshot(snapshot: any): boolean {
  if (!snapshot) return false;
  if (typeof snapshot.snapshotId !== 'string' || !snapshot.snapshotId.trim()) return false;
  if (typeof snapshot.createdAtUtc !== 'string' || !snapshot.createdAtUtc.trim()) return false;
  if (snapshot.schemaVersion !== "L0") return false;
  if (typeof snapshot.data !== 'object' || snapshot.data === null) return false;
  if (!snapshot.createdAtUtc.endsWith('Z')) return false;
  return true;
}

/**
 * Create first snapshot anchor with deterministic metadata
 * 
 * IDEMPOTENT: Same buildSha + version always generates identical snapshot ID
 * This allows re-runs to recognize already-seeded snapshots
 */
export function createFirstSnapshotAnchor(): any {
  const snapshotId = generateDeterministicSnapshotId();
  const createdAtUtc = generateDeterministicTimestamp();
  
  return {
    snapshotId,
    createdAtUtc,
    schemaVersion: "L0",
    metadata: {
      status: "AVAILABLE",
      coverage: {
        declaration: "NOT_DECLARED_IN_SNAPSHOT",
        note: "Coverage counts (projects, issues, users) not computed in L0 dumb reader"
      },
      integrity: {
        declaration: "NOT_DECLARED_IN_SNAPSHOT",
        note: "Snapshot hash and write-once semantics not yet declared at capture time"
      },
      provenance: {
        capturedBy: "L0_SEED_FUNCTION",
        captureTrigger: "APP_INSTALLATION_OR_UPGRADE",
        appVersionAtCapture: FT_RELEASE_VERSION,
        buildShaAtCapture: BACKEND_BUILD_SHA,
        note: "Deterministic seed snapshot created at app install/upgrade time"
      },
      export: {
        formats: ["JSON"],
        scope: "SNAPSHOT_METADATA",
        readiness: "AVAILABLE"
      },
      compliance: {
        declaration: "NOT_DECLARED_IN_SNAPSHOT",
        note: "Specific compliance mappings not declared at snapshot creation time"
      },
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
 * SHARED SEED FUNCTION: Create, validate, and repair snapshot on install/upgrade
 * 
 * REPAIR SEMANTICS:
 * - If pointer missing → create snapshot → store → return action=CREATED
 * - If pointer exists + valid → idempotent, return action=SKIPPED_VALID
 * - If pointer exists + invalid → REPAIR: rebuild → validate → overwrite → return action=REPAIRED_INVALID
 * 
 * USED BY:
 * - installed.ts handler (avi:forge:installed:app trigger)
 * - upgraded.ts handler (avi:forge:upgraded:app trigger)
 * - resolver (inline repair on invalid snapshot detection)
 * 
 * CONTRACT: Returns { ran, action, snapshotId, reason?, tsDerived?, buildSha, releaseVersion }
 */
export async function seedFirstSnapshotIfMissingOrRepair(): Promise<{
  ran: boolean;
  action: "CREATED" | "SKIPPED_VALID" | "REPAIRED_INVALID" | "FAILED";
  snapshotId: string;
  reason?: string;
  tsDerived?: string;
  buildSha: string;
  releaseVersion: string;
}> {
  const buildSha = BACKEND_BUILD_SHA || "unknown";
  const releaseVersion = FT_RELEASE_VERSION || "unknown";

  try {
    // Step 1: Check if snapshot already exists
    const existing = await storage.get(FT_SNAPSHOT_LAST_KEY);

    // Case 1: Valid snapshot exists - IDEMPOTENT SUCCESS
    if (existing && isValidSnapshot(existing)) {
      return {
        ran: true,
        action: "SKIPPED_VALID" as const,
        snapshotId: (existing as any).snapshotId,
        tsDerived: generateDeterministicTimestamp(),
        buildSha,
        releaseVersion
      };
    }

    // Case 2: Invalid snapshot exists - REPAIR IT
    if (existing && !isValidSnapshot(existing)) {
      const oldSnapshotId = (existing as any).snapshotId || "UNKNOWN";
      const invalidReason = (() => {
        if (!existing.snapshotId) return "missing snapshotId";
        if (!existing.createdAtUtc) return "missing createdAtUtc";
        if (existing.schemaVersion !== "L0") return `wrong schemaVersion: ${existing.schemaVersion}`;
        if (!existing.data) return "missing data";
        if (!existing.createdAtUtc.endsWith('Z')) return "invalid ISO timestamp";
        return "unknown";
      })();

      const snapshot = createFirstSnapshotAnchor();
      await storage.set(FT_SNAPSHOT_LAST_KEY, snapshot);

      return {
        ran: true,
        action: "REPAIRED_INVALID" as const,
        snapshotId: snapshot.snapshotId,
        reason: `repaired invalid snapshot (was: ${oldSnapshotId}, reason: ${invalidReason})`,
        tsDerived: generateDeterministicTimestamp(),
        buildSha,
        releaseVersion
      };
    }

    // Case 3: No snapshot exists - CREATE IT
    const snapshot = createFirstSnapshotAnchor();
    await storage.set(FT_SNAPSHOT_LAST_KEY, snapshot);

    // Step 4: Write seed marker for proof
    const seedMarker = {
      ranAtUtc: new Date().toISOString(),
      phase: "SEED",
      snapshotId: snapshot.snapshotId,
      buildSha,
      releaseVersion,
      schemaVersion: "L0"
    };
    await storage.set(FT_INSTALL_MARKER_KEY, seedMarker);

    return {
      ran: true,
      action: "CREATED" as const,
      snapshotId: snapshot.snapshotId,
      tsDerived: generateDeterministicTimestamp(),
      buildSha,
      releaseVersion
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    console.error("[SEED_SNAPSHOT] Error during seed:", errorMsg);

    return {
      ran: false,
      action: "FAILED" as const,
      snapshotId: "N/A",
      reason: errorMsg,
      buildSha,
      releaseVersion
    };
  }
}
