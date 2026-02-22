import { describe, it, expect } from "vitest";
import * as fs from "fs";

describe("v5.6.5 meta persistence wiring (static)", () => {
  it("stores job meta separately and does not overwrite it with status", () => {
    const adapter = fs.readFileSync("src/jobs/v565/snapshotMasterEnqueueAdapter.ts", "utf8");
    const jobStatus = fs.readFileSync("src/jobs/v565/jobStatus.ts", "utf8");
    const constants = fs.readFileSync("src/v565/constants.ts", "utf8");

    expect(constants.includes("JOB_META_PREFIX")).toBe(true);
    expect(jobStatus.includes("setJobMeta")).toBe(true);
    expect(jobStatus.includes("JOB_META_PREFIX")).toBe(true);

    expect(adapter.includes("setJobMeta(")).toBe(true);
    expect(adapter.includes("abortIfMasterFailed(jobId)")).toBe(true);

    // Ensure adapter is not writing executionContext/trigger into JOB_STATUS_PREFIX record anymore
    expect(adapter.includes("executionContext")).toBe(true);
    expect(adapter.includes("trigger")).toBe(true);
    expect(adapter.includes("JOB_STATUS_PREFIX")).toBe(false);
  });
});
