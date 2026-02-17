/**
 * Storage Growth Metrics
 * 
 * FT_PROOF_STORAGE_GROWTH_VISIBILITY_v1
 * 
 * Compute storage telemetry deterministically from stored blocks.
 * No Date. Deterministic extrapolation from sampled blocks.
 */

import { storage } from "@forge/api";
import { sanitizeKey } from "../utils/sanitizeKey";

export interface StorageMetrics {
  totalBlocks: number;
  segmentsRetained: number;
  estimatedSizeBytes: number;
  retentionPolicy: 8;
}

/**
 * Get storage growth metrics
 * 
 * Read metadata to count segments and blocks
 * Sample last 200 blocks to extrapolate size
 */
export async function getStorageMetrics(tenantKey: string): Promise<StorageMetrics> {
  const metaKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:meta`;
  let segmentsRetained = 0;
  let totalBlocks = 0;

  try {
    const metaData = await storage.get(metaKey);
    if (metaData) {
      try {
        const meta = typeof metaData === "string" ? JSON.parse(metaData) : metaData;

        if (Array.isArray(meta.segments)) {
          segmentsRetained = meta.segments.length;

          // Sum block counts across segments
          for (const seg of meta.segments) {
            if (typeof seg.count === "number") {
              totalBlocks += seg.count;
            }
          }
        }
      } catch (err) {
        console.error(`[storageMetrics] Meta parse error: ${err}`);
      }
    }
  } catch (err) {
    console.error(`[storageMetrics] Meta read error: ${err}`);
  }

  // Estimate size from last 200 blocks
  let estimatedSizeBytes = 0;

  try {
    const headKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:head`;
    const headData = await storage.get(headKey);

    if (headData) {
      let current = typeof headData === "string" ? JSON.parse(headData) : headData;
      let sampled = 0;
      let totalSampledBytes = 0;
      const MAX_SAMPLE = 200;

      while (current && sampled < MAX_SAMPLE) {
        // Estimate bytes as JSON string length
        const blockJson = JSON.stringify(current);
        totalSampledBytes += blockJson.length;

        if (current.previousBlockKey) {
          try {
            const parentData = await storage.get(current.previousBlockKey);
            if (parentData) {
              current = typeof parentData === "string" ? JSON.parse(parentData) : parentData;
              sampled++;
            } else {
              break;
            }
          } catch (err) {
            break;
          }
        } else {
          break;
        }
      }

      if (sampled > 0 && totalBlocks > 0) {
        const avgBytesPerBlock = totalSampledBytes / sampled;
        estimatedSizeBytes = Math.round(avgBytesPerBlock * totalBlocks);
      }
    }
  } catch (err) {
    console.error(`[storageMetrics] Size estimation error: ${err}`);
  }

  return {
    totalBlocks,
    segmentsRetained,
    estimatedSizeBytes,
    retentionPolicy: 8,
  };
}
