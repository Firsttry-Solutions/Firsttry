/**
 * Restore Detection Heuristic
 * 
 * FT_PROOF_RESTORE_HEURISTIC_v1
 * 
 * Detects possible restore/reset operations based on ledger block patterns.
 * Deterministic. No Date. Read-only.
 */

import { storage } from "@forge/api";
import { sanitizeKey } from "../utils/sanitizeKey";

export interface RestoreDetectionResult {
  suspected: boolean;
  reason: string | null;
}

/**
 * Detect possible restore operation using three heuristics
 * 
 * Reads last 200 snapshot blocks (walk backwards from head)
 * No full scans, no Date usage, deterministic
 */
export async function detectPossibleRestore(tenantKey: string): Promise<RestoreDetectionResult> {
  const headKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:head`;

  try {
    const headData = await storage.get(headKey);
    if (!headData) {
      return { suspected: false, reason: null };
    }

    let head: any;
    try {
      head = typeof headData === "string" ? JSON.parse(headData) : headData;
    } catch (err) {
      console.error(`[restoreHeuristic] Head parse failed: ${err}`);
      return { suspected: false, reason: null };
    }

    // Collect last 200 blocks walking backwards
    const blocks: any[] = [];
    let current = head;
    let depth = 0;
    const MAX_DEPTH = 200;

    while (current && depth < MAX_DEPTH) {
      blocks.push(current);

      // Try to read parent
      if (current.previousBlockKey) {
        try {
          const parentData = await storage.get(current.previousBlockKey);
          if (parentData) {
            current = typeof parentData === "string" ? JSON.parse(parentData) : parentData;
            depth++;
          } else {
            break;
          }
        } catch (err) {
          console.error(`[restoreHeuristic] Error reading block chain: ${err}`);
          break;
        }
      } else {
        break;
      }
    }

    if (blocks.length === 0) {
      return { suspected: false, reason: null };
    }

    // Insufficient data check
    if (blocks.length < 10) {
      return { suspected: false, reason: null };
    }

    // HEURISTIC A: Hash appears >= 3 segments (6 months) old
    if (blocks.length >= 60) {
      // Last 60 blocks ~= 3-6 months
      const currentHash = head.snapshotHash || head.blockHash;
      const oldBlocks = blocks.slice(60);

      for (const oldBlock of oldBlocks) {
        if (oldBlock.snapshotHash === currentHash || oldBlock.blockHash === currentHash) {
          return {
            suspected: true,
            reason: `Hash collision detected: identical snapshot hash found ${Math.floor(blocks.length / 20)} segments ago. This may indicate a restore operation.`,
          };
        }
      }
    }

    // HEURISTIC B: Zero-change run followed by large change
    if (blocks.length >= 50) {
      const lastChanges = blocks.slice(0, 50).map((b) => b.totalChanges || 0);

      // Check if median is 0
      const sorted = [...lastChanges].sort((a, b) => a - b);
      const median =
        sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];

      if (median === 0) {
        // Check for spike
        for (const change of lastChanges) {
          if (change >= 1000) {
            return {
              suspected: true,
              reason: `Large change spike detected (${change} changes) after period of quiescence. This may indicate restored state being updated.`,
            };
          }
        }
      }
    }

    // HEURISTIC C: Post-rollover spike
    if (blocks.length >= 25) {
      const last20 = blocks.slice(0, 20).map((b) => b.totalChanges || 0);
      const median20 = (() => {
        const s = [...last20].sort((a, b) => a - b);
        return s.length % 2 === 0
          ? (s[s.length / 2 - 1] + s[s.length / 2]) / 2
          : s[Math.floor(s.length / 2)];
      })();

      // Check if block right after segment boundary has spike
      const checkpoint = blocks[21] || blocks[20];
      if (checkpoint && checkpoint.totalChanges) {
        if (checkpoint.totalChanges >= 5 * median20) {
          return {
            suspected: true,
            reason: `Snapshot count spike after segment transition (${checkpoint.totalChanges} vs median ${Math.floor(median20)}). This may indicate resume from backup.`,
          };
        }
      }
    }

    return { suspected: false, reason: null };
  } catch (err) {
    console.error(`[restoreHeuristic] Error: ${err}`);
    return { suspected: false, reason: null };
  }
}
