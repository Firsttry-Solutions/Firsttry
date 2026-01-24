/**
 * Layer-0 Marketplace: App Installation Trigger Handler
 * 
 * Creates snapshot anchor on app install (idempotent).
 * - If snapshot exists: do nothing
 * - If missing: create anchor snapshot
 * - Write install marker to prove execution
 * - NO Jira API calls
 * - NO retries
 */

import { api } from "@forge/api";
import { FT_SNAPSHOT_LAST_KEY, FT_INSTALL_MARKER_KEY } from "../backbone/keys";

/**
 * Generate deterministic UUID
 */
function generateUUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
 * Create minimal L0 snapshot anchor with metadata declarations
 */
function createSnapshotAnchor(): any {
  const now = new Date().toISOString();
  const snapshotId = generateUUID();
  
  return {
    snapshotId,
    createdAtUtc: now,
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
        captureTrigger: "APP_INSTALLATION",
        appVersionAtCapture: "1.0.0-L0",
        note: "Snapshot created at app install time"
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
      note: "Jira governance evidence snapshot (export for full details).",
      createdAtUtc: now,
      snapshotId
    }
  };
}

/**
 * Main handler: Create snapshot anchor if missing
 */
export const handler = async (event: any) => {
  try {
    await api.asApp().requestStorage(async (storage) => {
      // Step 1: Check if snapshot exists
      const existing = await storage.get(FT_SNAPSHOT_LAST_KEY);
      
      if (existing && isValidSnapshot(existing)) {
        // Snapshot already exists - do nothing
        console.log(`[FT_INSTALLED] created=false snapshotId=${(existing as any).snapshotId}`);
        return;
      }
      
      // Step 2: Create snapshot anchor
      const snapshot = createSnapshotAnchor();
      await storage.set(FT_SNAPSHOT_LAST_KEY, snapshot);
      
      // Step 3: Write install marker
      const installMarker = {
        ranAtUtc: new Date().toISOString(),
        schemaVersion: "L0"
      };
      await storage.set(FT_INSTALL_MARKER_KEY, installMarker);
      
      // Log success
      console.log(`[FT_INSTALLED] created=true snapshotId=${snapshot.snapshotId}`);
    });
  } catch (err) {
    console.error("[FT_INSTALLED] Error during install:", err instanceof Error ? err.message : String(err));
    throw err;
  }
};
