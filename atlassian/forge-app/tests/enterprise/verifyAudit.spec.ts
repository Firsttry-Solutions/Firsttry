/**
 * Verify Audit Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getVerifyAudit, recordWindowVerify, recordFullVerify } from "../../src/enterprise/verifyAudit";

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

describe("Verify Audit", () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it("should return null state when uninitialized", async () => {
    const audit = await getVerifyAudit("new-tenant");
    expect(audit.lastFullVerifyAtUtc).toBeNull();
    expect(audit.lastWindowVerifyAtUtc).toBeNull();
    expect(audit.lastWindowStatus).toBeNull();
  });

  it("should record window verify status", async () => {
    await recordWindowVerify("test-tenant", "2025-01-15T10:00:00Z", "OK_VERIFIED");
    const audit = await getVerifyAudit("test-tenant");

    expect(audit.lastWindowVerifyAtUtc).toBe("2025-01-15T10:00:00Z");
    expect(audit.lastWindowStatus).toBe("OK_VERIFIED");
  });

  it("should record full verify status", async () => {
    await recordFullVerify("test-tenant", "2025-01-15T11:00:00Z");
    const audit = await getVerifyAudit("test-tenant");

    expect(audit.lastFullVerifyAtUtc).toBe("2025-01-15T11:00:00Z");
  });

  it("should preserve both timestamps independently", async () => {
    await recordWindowVerify("test-tenant", "2025-01-15T10:00:00Z", "FAIL_MISMATCH");
    await recordFullVerify("test-tenant", "2025-01-15T11:00:00Z");

    const audit = await getVerifyAudit("test-tenant");
    expect(audit.lastWindowVerifyAtUtc).toBe("2025-01-15T10:00:00Z");
    expect(audit.lastFullVerifyAtUtc).toBe("2025-01-15T11:00:00Z");
  });
});
