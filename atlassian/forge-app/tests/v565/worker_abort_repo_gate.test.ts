import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";

describe("v5.6.5 worker abort repo gate", () => {
  it("enforces abortIfMasterFailed(jobId) in all discovered candidates", () => {
    const out = execFileSync("bash", ["tools/v565_worker_abort_repo_gate.sh"], { encoding: "utf8" });
    expect(out.includes("PASS: repo worker abort gate")).toBe(true);
  });
});
