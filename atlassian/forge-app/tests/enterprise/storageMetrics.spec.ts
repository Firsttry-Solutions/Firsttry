/**
 * Storage Metrics Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getStorageMetrics, StorageMetrics } from "../../src/enterprise/storageMetrics";

const mockStorage: Map<string, any> = new Map();

vi.mock("@forge/api", () => ({
  storage: {
    get: (key: string) => Promise.resolve(mockStorage.get(key)),
  },
}));

describe("Storage Metrics", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("should return zero metrics when no data", async () => {
    const result = await getStorageMetrics("empty-tenant");
    expect(result.totalBlocks).toBe(0);
    expect(result.segmentsRetained).toBe(0);
    expect(result.estimatedSizeBytes).toBe(0);
    expect(result.retentionPolicy).toBe(8);
  });

  it("should count segments from meta", async () => {
    const metaKey = `ft:ledger:v1:storage-test:meta`;
    mockStorage.set(
      metaKey,
      JSON.stringify({
        segments: [
          { id: "seg-1", count: 100 },
          { id: "seg-2", count: 200 },
          { id: "seg-3", count: 150 },
        ],
      })
    );

    const result = await getStorageMetrics("storage-test");
    expect(result.segmentsRetained).toBe(3);
    expect(result.totalBlocks).toBe(450);
  });

  it("should estimate size from sampled blocks", async () => {
    const metaKey = `ft:ledger:v1:size-test:meta`;
    const headKey = `ft:ledger:v1:size-test:head`;

    mockStorage.set(
      metaKey,
      JSON.stringify({
        segments: [{ id: "seg-1", count: 1000 }],
      })
    );

    const blockData = { sequenceId: 1000, observedAtUtc: "2025-01-01T00:00:00Z" };
    mockStorage.set(headKey, JSON.stringify(blockData));

    const result = await getStorageMetrics("size-test");
    expect(result.totalBlocks).toBe(1000);
    expect(result.estimatedSizeBytes).toBeGreaterThan(0);
  });

  it("should handle missing meta gracefully", async () => {
    const metaKey = `ft:ledger:v1:no-meta:meta`;
    mockStorage.delete(metaKey);

    const result = await getStorageMetrics("no-meta");
    expect(result.segmentsRetained).toBe(0);
    expect(result.totalBlocks).toBe(0);
  });
});
