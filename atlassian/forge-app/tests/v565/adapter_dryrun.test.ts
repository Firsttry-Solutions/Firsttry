import { describe, it, expect, vi, beforeEach } from "vitest";
import { storage } from "@forge/api";
import { enqueueSnapshotMaster } from "../../src/jobs/v565/snapshotMasterEnqueueAdapter";

describe("v5.6.5 adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock storage.get to return the probe value after set (simulates real KV store)
    (storage.set as any).mockResolvedValue(undefined);
    (storage.get as any).mockResolvedValue({ schemaVersion: "5.6.5", t: "2026-01-01T00:00:00.000Z" });
    (storage.delete as any).mockResolvedValue(undefined);
  });

  it("dryRun does not throw", async () => {
    await expect(enqueueSnapshotMaster({
      jobId: "00000000-0000-0000-0000-000000000000",
      executionContext: "APP",
      trigger: "MANUAL_UI",
      dryRun: true
    })).resolves.toBeUndefined();
  });
});
