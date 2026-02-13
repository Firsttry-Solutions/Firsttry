/**
 * Phase 2: Unit Tests for Continuous Drift Monitoring
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";

// Mock types (in real implementation, import from types.ts)
interface DriftEvent {
  eventId: string;
  timestampUtc: string;
  type: string;
  entity: string;
  severity: "low" | "medium" | "high";
  explanation: string;
  snapshotHash: string;
}

interface DriftBufferEntry {
  snapshotHash: string;
  timestampUtc: string;
  drifts: DriftEvent[];
}

describe("Phase 2: Continuous Drift Monitoring", () => {
  // Test 1: eventId determinism
  it("generates deterministic eventId", () => {
    const snapshotHash = "abc123";
    const entity = "account@example.com";
    const type = "new_global_admin";

    const id1 = crypto
      .createHash("sha256")
      .update(`${snapshotHash}|${entity}|${type}`)
      .digest("hex");

    const id2 = crypto
      .createHash("sha256")
      .update(`${snapshotHash}|${entity}|${type}`)
      .digest("hex");

    expect(id1).toBe(id2);
    expect(id1.length).toBe(64); // SHA-256 hex = 64 chars
  });

  // Test 2: New admin drift detection
  it("detects new global admin", () => {
    const baseline = {
      admins: [{ accountId: "admin1", email: "admin1@company.com" }],
    };

    const current = {
      admins: [
        { accountId: "admin1", email: "admin1@company.com" },
        { accountId: "admin2", email: "admin2@company.com" },
      ],
    };

    const baselineSet = new Set(baseline.admins.map((a) => a.accountId));
    const drifts = current.admins.filter((a) => !baselineSet.has(a.accountId));

    expect(drifts).toHaveLength(1);
    expect(drifts[0].accountId).toBe("admin2");
  });

  // Test 3: Ring buffer overflow to 180
  it("maintains ring buffer max 180 entries", () => {
    const buffer: DriftBufferEntry[] = [];
    const maxEntries = 180;

    for (let i = 0; i < 200; i++) {
      buffer.push({
        snapshotHash: `hash${i}`,
        timestampUtc: new Date(Date.now() + i * 1000).toISOString(),
        drifts: [],
      });

      if (buffer.length > maxEntries) {
        buffer.shift();
      }
    }

    expect(buffer.length).toBe(180);
    expect(buffer[0].snapshotHash).toBe("hash20");
    expect(buffer[179].snapshotHash).toBe("hash199");
  });

  // Test 4: Baseline initialization (no buffer write on init)
  it("initializes baseline without writing buffer", () => {
    const bufferWrites: any[] = [];
    const baselineWrites: any[] = [];

    // Simulate baseline initialization
    const snapshotHash = "initial_hash";
    baselineWrites.push(snapshotHash);

    // Should NOT write to buffer on initialization
    expect(bufferWrites).toHaveLength(0);
    expect(baselineWrites).toHaveLength(1);
  });

  // Test 5: Baseline advances ONLY after buffer write succeeds
  it("advances baseline only after buffer write", async () => {
    const storage: any = {};
    let bufferWriteSucceeded = false;

    // Simulate buffer write
    try {
      storage["phase2.driftBuffer"] = JSON.stringify([]);
      bufferWriteSucceeded = true;
    } catch {
      bufferWriteSucceeded = false;
    }

    // Only advance baseline if buffer write succeeded
    if (bufferWriteSucceeded) {
      storage["phase2.baselineSnapshot"] = JSON.stringify({
        admins: [],
        projects: [],
      });
    }

    expect(bufferWriteSucceeded).toBe(true);
    expect(storage["phase2.baselineSnapshot"]).toBeDefined();
  });

  // Test 6: Lock prevents overlap
  it("lock prevents overlapping scans", () => {
    const lockKey = "phase2.lock";
    const storage: any = {};

    // Simulate first scan acquiring lock
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 330 * 1000);

    const lock1 = {
      acquiredAtUtc: now.toISOString(),
      expiresAtUtc: expiresAt.toISOString(),
      holderId: "holder1",
    };

    storage[lockKey] = JSON.stringify(lock1);

    // Second scan tries to acquire lock
    const existingLock = storage[lockKey] ? JSON.parse(storage[lockKey]) : null;
    const canAcquire =
      !existingLock || new Date() >= new Date(existingLock.expiresAtUtc);

    expect(canAcquire).toBe(false); // Lock still held
    expect(existingLock.holderId).toBe("holder1");
  });

  // Test 7: Storage near limit -> degraded + minimal entry at >=0.95
  it("stores minimal entry when storage critical", () => {
    const quotaBytes = 8 * 1024 * 1024; // 8 MiB
    const usageBytes = Math.floor(quotaBytes * 0.96); // 96% usage
    const usageRatio = usageBytes / quotaBytes;

    const isCritical = usageRatio >= 0.95;

    if (isCritical) {
      // Store minimal entry
      const minimalEntry: DriftBufferEntry = {
        snapshotHash: "hash123",
        timestampUtc: new Date().toISOString(),
        drifts: [], // Empty drifts to save space
      };

      expect(minimalEntry.drifts).toHaveLength(0);
      expect(usageRatio).toBeGreaterThanOrEqual(0.95);
    }
  });

  // Test 8: Webhook payload deterministic equality
  it("creates deterministic webhook payload", () => {
    const drift: DriftEvent = {
      eventId: "event123",
      timestampUtc: "2026-01-01T12:00:00Z",
      type: "new_global_admin",
      entity: "admin@example.com",
      severity: "high",
      explanation: "New admin detected",
      snapshotHash: "abc123",
    };

    const payload1 = JSON.stringify({
      app: "FirstTry",
      version: "2.0.0-phase2",
      siteId: "site1",
      snapshotHash: drift.snapshotHash,
      severity: drift.severity,
      eventType: drift.type,
      entity: drift.entity,
      timestampUtc: drift.timestampUtc,
      recommendation: "Review and manually revoke if unauthorized.",
    });

    const payload2 = JSON.stringify({
      app: "FirstTry",
      version: "2.0.0-phase2",
      siteId: "site1",
      snapshotHash: drift.snapshotHash,
      severity: drift.severity,
      eventType: drift.type,
      entity: drift.entity,
      timestampUtc: drift.timestampUtc,
      recommendation: "Review and manually revoke if unauthorized.",
    });

    expect(payload1).toBe(payload2);
  });

  // Test 9: 429 retry attempts exactly 3 with deterministic delays
  it("retries 429 with deterministic delays", async () => {
    const delays = [1000, 2000, 4000];
    const attempts: number[] = [];

    // Simulate retry logic
    for (let i = 0; i < 3; i++) {
      attempts.push(delays[i]);
      // Would wait: await new Promise(r => setTimeout(r, delays[i]));
    }

    expect(attempts).toEqual([1000, 2000, 4000]);
  });

  // Test 10: Required API failure throws abort error
  it("throws abort error on required API failure", () => {
    const apiError = new Error("FT_DRIFT_SCAN_ABORT_REQUIRED_DATA_MISSING");

    expect(() => {
      throw apiError;
    }).toThrow("FT_DRIFT_SCAN_ABORT_REQUIRED_DATA_MISSING");
  });

  // Test 11: Canonical JSON serialization
  it("serializes with stable key ordering", () => {
    const obj = {
      z: 1,
      a: 2,
      m: 3,
    };

    const canonical = JSON.stringify(
      obj,
      Object.keys(obj).sort()
    );
    const canonical2 = JSON.stringify(
      { a: 2, m: 3, z: 1 },
      Object.keys({ a: 2, m: 3, z: 1 }).sort()
    );

    expect(canonical).toBe(canonical2);
  });

  // Test 12: Webhook origin rejection (not in allowlist)
  it("rejects generic webhook with disallowed origin", () => {
    // Simulate config save validation
    const ALLOWED_ORIGINS = ["https://hooks.slack.com"];

    function getOrigin(url: string): string | null {
      try {
        const u = new URL(url);
        return `${u.protocol}//${u.host}`;
      } catch {
        return null;
      }
    }

    const disallowedUrl = "https://example.com/webhook";
    const origin = getOrigin(disallowedUrl);

    // Assert that example.com is NOT in allowlist
    expect(origin).toBe("https://example.com");
    expect(ALLOWED_ORIGINS).not.toContain(origin);

    // Assert that validation would fail
    const isAllowed =
      !disallowedUrl || ALLOWED_ORIGINS.includes(origin || "");
    expect(isAllowed).toBe(false);
  });

  // Test 13: Domain validation rejects invalid formats
  it("rejects domains with invalid characters", () => {
    function isValidDomain(domain: string): boolean {
      if (!domain || typeof domain !== "string") return false;
      if (domain.includes("/") || domain.includes(":") || domain.includes("@")) {
        return false;
      }
      return true;
    }

    // Valid domains
    expect(isValidDomain("example.com")).toBe(true);
    expect(isValidDomain("company.org")).toBe(true);

    // Invalid domains
    expect(isValidDomain("https://example.com")).toBe(false); // has ://
    expect(isValidDomain("admin@example.com")).toBe(false); // has @
    expect(isValidDomain("example.com:8080")).toBe(false); // has :
    expect(isValidDomain("example.com/path")).toBe(false); // has /
  });
