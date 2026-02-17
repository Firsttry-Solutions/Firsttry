/**
 * Change Timeline View (Ledger-Derived)
 * 
 * FT_PROOF_CHANGE_TIMELINE_v1
 * 
 * Extract timeline events from snapshot blocks.
 * Deterministic. No Date. Read-only analysis.
 */

import { storage } from "@forge/api";
import { sanitizeKey } from "../utils/sanitizeKey";

export type TimelineEventType =
  | "SNAPSHOT_APPENDED"
  | "DRIFT_OPENED"
  | "DRIFT_CLOSED"
  | "CERTIFICATION_COMPLETED";

export interface TimelineEvent {
  type: TimelineEventType;
  observedAtUtc: string;
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Get timeline of changes from ledger blocks
 *
 * Returns last 200 events sorted chronologically
 */
export async function getTimeline(tenantKey: string): Promise<TimelineEvent[]> {
  const headKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:head`;
  const events: TimelineEvent[] = [];

  try {
    const headData = await storage.get(headKey);
    if (!headData) {
      return [];
    }

    let current = typeof headData === "string" ? JSON.parse(headData) : headData;
    let collected = 0;
    const MAX_COLLECT = 200;
    let prevTotalChanges = 0;

    while (current && collected < MAX_COLLECT) {
      const observedAtUtc = current.observedAtUtc || null;
      const blockType = current.blockType || current.type || "SNAPSHOT";
      const totalChanges = current.totalChanges || 0;

      if (observedAtUtc) {
        // All snapshot blocks get a SNAPSHOT_APPENDED event
        events.push({
          type: "SNAPSHOT_APPENDED",
          observedAtUtc,
          description: `Snapshot appended (hash: ${current.snapshotHash?.slice(0, 8) || "?"}...)`,
          metadata: {
            blockType,
            totalChanges,
          },
        });

        // Detect drift state transitions
        if (prevTotalChanges === 0 && totalChanges > 0) {
          events.push({
            type: "DRIFT_OPENED",
            observedAtUtc,
            description: `Drift detected: ${totalChanges} changes from silence`,
            metadata: { changeCount: totalChanges },
          });
        } else if (prevTotalChanges > 0 && totalChanges === 0) {
          events.push({
            type: "DRIFT_CLOSED",
            observedAtUtc,
            description: "Drift resolved: All changes processed",
            metadata: { priorChangeCount: prevTotalChanges },
          });
        }

        // Detect certification blocks
        if (blockType === "CERTIFICATION" || current.isCertification) {
          events.push({
            type: "CERTIFICATION_COMPLETED",
            observedAtUtc,
            description: "Certification completed",
            metadata: {
              chainTipHash: current.chainTipHash?.slice(0, 8) || "?",
            },
          });
        }

        prevTotalChanges = totalChanges;
        collected++;
      }

      // Walk backwards
      if (current.previousBlockKey) {
        try {
          const parentData = await storage.get(current.previousBlockKey);
          if (parentData) {
            current = typeof parentData === "string" ? JSON.parse(parentData) : parentData;
          } else {
            break;
          }
        } catch (err) {
          console.error(`[timeline] Error reading block chain: ${err}`);
          break;
        }
      } else {
        break;
      }
    }
  } catch (err) {
    console.error(`[timeline] Error: ${err}`);
  }

  // Sort chronologically (reverse since we walk backwards)
  events.reverse();

  return events;
}
