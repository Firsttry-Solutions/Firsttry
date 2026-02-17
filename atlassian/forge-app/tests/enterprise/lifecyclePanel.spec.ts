/**
 * Lifecycle Panel Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildLifecyclePanelState, LifecyclePanelState } from "../../src/enterprise/lifecyclePanel";
import { getOrCreateInstallationId } from "../../src/enterprise/installation";

// Mock storage
const mockStorage: Map<string, any> = new Map();

vi.mock("@forge/api", () => ({
  storage: {
    get: (key: string) => Promise.resolve(mockStorage.get(key)),
    set: (key: string, value: any) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    },
  },
}));

describe("Lifecycle Panel", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  afterEach(() => {
    mockStorage.clear();
  });

  it("should build lifecycle panel state with installed tenant", async () => {
    const tenantKey = "test-tenant-123";
    const state = await buildLifecyclePanelState(tenantKey, {});

    expect(state).toHaveProperty("installationId");
    expect(state).toHaveProperty("tenantKeyHash16");
    expect(state).toHaveProperty("ledgerCreatedAtUtc");
    expect(state).toHaveProperty("oldestSegmentRetained");
    expect(state.retentionPolicy).toBe("8 segments");
  });

  it("should compute tenant key hash16", async () => {
    const tenantKey = "example-tenant";
    const state = await buildLifecyclePanelState(tenantKey, {});

    expect(state.tenantKeyHash16).toHaveLength(16);
    expect(/^[a-f0-9]+$/.test(state.tenantKeyHash16)).toBe(true);
  });

  it("should handle missing meta gracefully", async () => {
    const tenantKey = "missing-meta";
    mockStorage.delete(`ft:ledger:v1:missing-meta:meta`);

    const state = await buildLifecyclePanelState(tenantKey, {});

    expect(state.ledgerCreatedAtUtc).toBeNull();
    expect(state.oldestSegmentRetained).toBeNull();
  });

  it("should detect reset when meta missing but head exists", async () => {
    const tenantKey = "reset-test";
    const headKey = `ft:ledger:v1:reset-test:head`;
    mockStorage.set(headKey, JSON.stringify({ sequenceId: 1, observedAtUtc: "2025-01-01T00:00:00Z" }));

    const state = await buildLifecyclePanelState(tenantKey, {});

    expect(state.resetDetected).toBe(true);
    expect(state.resetMessage).toBeDefined();
  });

  it("should parse segments from meta", async () => {
    const tenantKey = "segments-test";
    const metaKey = `ft:ledger:v1:segments-test:meta`;
    mockStorage.set(
      metaKey,
      JSON.stringify({
        createdAtUtc: "2025-01-01T00:00:00Z",
        segments: [
          { id: "seg-1", count: 100 },
          { id: "seg-2", count: 200 },
        ],
      })
    );

    const state = await buildLifecyclePanelState(tenantKey, {});

    expect(state.ledgerCreatedAtUtc).toBe("2025-01-01T00:00:00Z");
    expect(state.oldestSegmentRetained).toBe("seg-1");
    expect(state.resetDetected).toBe(false);
  });
});
