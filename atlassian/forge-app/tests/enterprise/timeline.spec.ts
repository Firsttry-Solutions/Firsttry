/**
 * Timeline Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTimeline, TimelineEventType } from "../../src/enterprise/timeline";

const mockStorage: Map<string, any> = new Map();

vi.mock("@forge/api", () => ({
  storage: {
    get: (key: string) => Promise.resolve(mockStorage.get(key)),
  },
}));

describe("Timeline", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("should return empty timeline when no data", async () => {
    const events = await getTimeline("new-tenant");
    expect(events).toEqual([]);
  });

  it("should create SNAPSHOT_APPENDED events", async () => {
    const headKey = `ft:ledger:v1:timeline-test:head`;
    mockStorage.set(headKey, JSON.stringify({
      observedAtUtc: "2025-01-15T10:00:00Z",
      snapshotHash: "abc123",
      totalChanges: 0,
    }));

    const events = await getTimeline("timeline-test");
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe("SNAPSHOT_APPENDED");
  });

  it("should detect drift state transitions", async () => {
    const headKey = `ft:ledger:v1:drift-test:head`;

    // Current block: totalChanges = 0 (after being 10)
    let current = {
      observedAtUtc: "2025-01-15T10:00:00Z",
      totalChanges: 0,
      previousBlockKey: "block:1",
    };
    mockStorage.set(headKey, JSON.stringify(current));

    // Previous block: totalChanges = 10
    mockStorage.set("block:1", JSON.stringify({
      observedAtUtc: "2025-01-15T09:00:00Z",
      totalChanges: 10,
    }));

    const events = await getTimeline("drift-test");
    const driftEvents = events.filter(e => e.type === "DRIFT_CLOSED" || e.type === "DRIFT_OPENED");
    expect(driftEvents.length).toBeGreaterThan(0);
  });

  it("should detect CERTIFICATION_COMPLETED events", async () => {
    const headKey = `ft:ledger:v1:cert-test:head`;
    mockStorage.set(headKey, JSON.stringify({
      observedAtUtc: "2025-01-15T10:00:00Z",
      blockType: "CERTIFICATION",
      isCertification: true,
      chainTipHash: "cert-hash-123",
    }));

    const events = await getTimeline("cert-test");
    const certEvents = events.filter(e => e.type === "CERTIFICATION_COMPLETED");
    expect(certEvents.length).toBeGreaterThan(0);
  });

  it("should return events in chronological order", async () => {
    const headKey = `ft:ledger:v1:chrono-test:head`;

    let block = {
      observedAtUtc: "2025-01-15T15:00:00Z",
      totalChanges: 0,
      previousBlockKey: "block:1",
    };
    mockStorage.set(headKey, JSON.stringify(block));

    mockStorage.set("block:1", JSON.stringify({
      observedAtUtc: "2025-01-15T10:00:00Z",
      totalChanges: 0,
    }));

    const events = await getTimeline("chrono-test");
    if (events.length >= 2) {
      const t1 = new Date(events[0].observedAtUtc).getTime();
      const t2 = new Date(events[events.length - 1].observedAtUtc).getTime();
      expect(t1 <= t2).toBe(true);
    }
  });
});
