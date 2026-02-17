/**
 * Snapshot Frequency Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSnapshotFrequency } from "../../src/enterprise/snapshotFrequency";

const mockStorage: Map<string, any> = new Map();

vi.mock("@forge/api", () => ({
  storage: {
    get: (key: string) => Promise.resolve(mockStorage.get(key)),
  },
}));

describe("Snapshot Frequency", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("should return null when no data", async () => {
    const result = await getSnapshotFrequency("new-tenant");
    expect(result.avgHours).toBeNull();
    expect(result.bucket).toBeNull();
  });

  it("should classify hour-level snapshots", async () => {
    const headKey = `ft:ledger:v1:hour-test:head`;

    // Create simple chain: 3 hours apart over 3 snapshots
    // Oldest: 2025-01-15T09:00:00Z
    // Middle: 2025-01-15T12:00:00Z (3 hours later)
    // Head:   2025-01-15T15:00:00Z (3 hours later)
    
    const oldBlock = {
      sequenceId: 1,
      observedAtUtc: "2025-01-15T09:00:00Z",
    };

    const midBlock = {
      sequenceId: 2,
      observedAtUtc: "2025-01-15T12:00:00Z",
      previousBlockKey: "block:1",
    };

    const headBlock = {
      sequenceId: 3,
      observedAtUtc: "2025-01-15T15:00:00Z",
      previousBlockKey: "block:2",
    };

    mockStorage.set("block:1", JSON.stringify(oldBlock));
    mockStorage.set("block:2", JSON.stringify(midBlock));
    mockStorage.set(headKey, JSON.stringify(headBlock));

    const result = await getSnapshotFrequency("hour-test");
    expect(result.avgHours).toBeLessThanOrEqual(6);
    expect(result.bucket).toBe("Hour-level");
  });

  it("should classify day-level snapshots", async () => {
    const headKey = `ft:ledger:v1:day-test:head`;

    // Create simple chain: 12 hours apart (Day-level: <= 36h avg)
    // Oldest: 2025-01-14T12:00:00Z
    // Middle: 2025-01-15T00:00:00Z (12 hours later)
    // Head:   2025-01-15T12:00:00Z (12 hours later)
    
    const oldBlock = {
      sequenceId: 1,
      observedAtUtc: "2025-01-14T12:00:00Z",
    };

    const midBlock = {
      sequenceId: 2,
      observedAtUtc: "2025-01-15T00:00:00Z",
      previousBlockKey: "block:1",
    };

    const headBlock = {
      sequenceId: 3,
      observedAtUtc: "2025-01-15T12:00:00Z",
      previousBlockKey: "block:2",
    };

    mockStorage.set("block:1", JSON.stringify(oldBlock));
    mockStorage.set("block:2", JSON.stringify(midBlock));
    mockStorage.set(headKey, JSON.stringify(headBlock));

    const result = await getSnapshotFrequency("day-test");
    expect(result.bucket).toBe("Day-level");
  });
});
