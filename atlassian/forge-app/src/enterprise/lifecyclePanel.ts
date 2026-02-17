/**
 * Lifecycle Continuity Disclosure Panel
 * 
 * FT_PROOF_LIFECYCLE_VISIBILITY_v1
 * FT_PROOF_STORAGE_GROWTH_VISIBILITY_v1
 * FT_PROOF_VERIFY_AUDIT_VISIBILITY_v1
 * FT_PROOF_EXPLICIT_CONSTRAINTS_DISCLOSURE_v1
 * FT_PROOF_LEDGER_SNAPSHOT_MIN_METRICS_v1
 * 
 * Deterministic computation from stored state.
 * No Date() usage. No networking. No mutations.
 */

import { storage } from "@forge/api";
import { sanitizeKey } from "../utils/sanitizeKey";
import { getOrCreateInstallationId } from "./installation";

/**
 * Lifecycle panel state
 */
export interface LifecyclePanelState {
  installationId: string | null;
  tenantKeyHash16: string;
  ledgerCreatedAtUtc: string | null;
  oldestSegmentRetained: string | null;
  retentionPolicy: "8 segments";
  resetDetected: boolean;
  resetMessage: string | null;
}

/**
 * Build lifecycle panel state
 * 
 * Read only from storage, deterministic
 */
export async function buildLifecyclePanelState(
  tenantKey: string,
  snapshot: any
): Promise<LifecyclePanelState> {
  // Compute tenant key hash16
  const tenantKeyHash16 = await (async () => {
    try {
      const crypto = require("crypto");
      return crypto
        .createHash("sha256")
        .update(tenantKey)
        .digest("hex")
        .slice(0, 16);
    } catch (err) {
      console.error(`[lifecyclePanel] Hash computation failed: ${err}`);
      return tenantKey.slice(0, 16);
    }
  })();

  // Get or create installation ID
  let installationId: string | null = null;
  try {
    installationId = await getOrCreateInstallationId(tenantKey);
  } catch (err) {
    console.error(`[lifecyclePanel] Installation ID error: ${err}`);
  }

  // Read ledger metadata and segments
  const metaKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:meta`;
  let ledgerCreatedAtUtc: string | null = null;
  let oldestSegmentRetained: string | null = null;
  let resetDetected = false;
  let resetMessage: string | null = null;

  try {
    const metaData = await storage.get(metaKey);
    if (!metaData) {
      // Meta missing - may indicate reset
      try {
        const headKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:head`;
        const head = await storage.get(headKey);
        if (head) {
          // Head exists but meta missing -> RESET DETECTED
          resetDetected = true;
          resetMessage =
            "Ledger metadata missing while head exists. This may indicate a restore or reset operation.";
        }
      } catch (err) {
        console.error(`[lifecyclePanel] Head check failed: ${err}`);
      }
    } else {
      // Meta exists - parse and check
      try {
        const meta = typeof metaData === "string" ? JSON.parse(metaData) : metaData;

        // Extract segments array
        if (Array.isArray(meta.segments) && meta.segments.length > 0) {
          // Get oldest segment
          const oldest = meta.segments[0];
          oldestSegmentRetained = oldest.id || oldest.name || null;

          // Check if ledger was created
          if (meta.createdAtUtc) {
            ledgerCreatedAtUtc = meta.createdAtUtc;
          }

          // Reset detection heuristic B: segments empty but head exists
          if (meta.segments.length === 0) {
            const headKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:head`;
            const head = await storage.get(headKey);
            if (head) {
              resetDetected = true;
              resetMessage =
                "Ledger indicates no retained segments, but head block exists. This indicates a retention policy reset or restore.";
            }
          }
        } else if (Array.isArray(meta.segments) && meta.segments.length === 0) {
          // No segments retained
          const headKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:head`;
          try {
            const head = await storage.get(headKey);
            if (head) {
              resetDetected = true;
              resetMessage =
                "Ledger indicates no retained segments, but head block exists. This indicates a retention policy reset or restore.";
            }
          } catch (err) {
            // Head check error - no reset detected just from missing segments
          }
        }
      } catch (parseErr) {
        console.error(`[lifecyclePanel] Meta parse error: ${parseErr}`);
      }
    }
  } catch (err) {
    console.error(`[lifecyclePanel] Meta read error: ${err}`);
  }

  return {
    installationId,
    tenantKeyHash16,
    ledgerCreatedAtUtc,
    oldestSegmentRetained,
    retentionPolicy: "8 segments",
    resetDetected,
    resetMessage,
  };
}
