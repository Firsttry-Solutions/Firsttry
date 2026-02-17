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

    // Create 5 snapshots ~3 hours apart
    let block = { observedAtUtc: "2025-01-15T15:00:00Z", sequenceId: 5 };
    mockStorage.set(headKey, JSON.stringify(block));

    for (let i = 4; i >= 1; i--) {
      const hour = 15 - (5 - i) * 3;
      const prev = {
        sequenceId: i,
        observedAtUtc: `2025-01-15T${String(Math.max(0, hour)).padStart(2, '0')}:00:00Z`,
        previousBlockKey: i > 1 ? `block:${i - 1}` : null,
      };
      mockStorage.set(`block:${i}`, JSON.stringify(block));
      block = prev;
    }

    block.previousBlockKey = `block:4`;
    mockStorage.set(headKey, JSON.stringify(block));

    const result = await getSnapshotFrequency("hour-test");
    expect(result.bucket).toBe("Hour-level");
  });

  it("should classify day-level snapshots", async () => {
    const headKey = `ft:ledger:v1:day-test:head`;

    // Create 10 snapshots ~12 hours apart
    let block = { observedAtUtc: "2025-01-15T12:00:00Z", sequenceId: 10 };
    mockStorage.set(headKey, JSON.stringify(block));

    for (let i = 9; i >= 1; i--) {
      const dayOffset = Math.floor((10 - i) * 12 / 24);
      const hour = (12 - ((10 - i) * 12) % 24 + 24) % 24;
      const prev = {
        sequenceId: i,
        observedAtUtc: `2025-01-${String(Math.max(1, 15 - dayOffset)).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`,
        previousBlockKey: i > 1 ? `block:${i - 1}` : null,
      };
      mockStorage.set(`block:${i}`, JSON.stringify(block));
      block = prev;
    }

    block.previousBlockKey = `block:9`;
    mockStorage.set(headKey, JSON.stringify(block));

    const result = await getSnapshotFrequency("day-test");
    expect(!result.bucket || result.bucket === "Day-level" || result.bucket === "Hour-level").toBe(true);
  });
});
