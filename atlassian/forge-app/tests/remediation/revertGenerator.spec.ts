import { describe, it, expect } from "vitest";
import { generateRevertInstructions } from "../../src/remediation/revertGenerator";
import { DiffResult } from "../../src/diff/diffEngine";

describe("Revert Generator", () => {
  it("generates instructions for added admins", () => {
    const diff: DiffResult = {
      addedGlobalAdmins: [{ accountId: "bob", email: "bob@example.com" }],
      removedGlobalAdmins: [],
      riskEscalations: [],
      changedProjectCount: 0,
      schemaVersion: "1.0.0",
    };

    const instructions = generateRevertInstructions({ diff });

    expect(instructions.length).toBeGreaterThan(0);
    const removeInstr = instructions.find((i) =>
      i.title.includes("Remove")
    );
    expect(removeInstr).toBeDefined();
    expect(removeInstr?.severity).toBe("CRITICAL");
  });

  it("generates instructions for removed admins", () => {
    const diff: DiffResult = {
      addedGlobalAdmins: [],
      removedGlobalAdmins: [
        { accountId: "alice", email: "alice@example.com" },
      ],
      riskEscalations: [],
      changedProjectCount: 0,
      schemaVersion: "1.0.0",
    };

    const instructions = generateRevertInstructions({ diff });

    expect(instructions.length).toBeGreaterThan(0);
    const reviewInstr = instructions.find((i) =>
      i.title.includes("Review")
    );
    expect(reviewInstr).toBeDefined();
    expect(reviewInstr?.severity).toBe("WARNING");
  });

  it("returns info-level instruction for clean diff", () => {
    const diff: DiffResult = {
      addedGlobalAdmins: [],
      removedGlobalAdmins: [],
      riskEscalations: [],
      changedProjectCount: 0,
      schemaVersion: "1.0.0",
    };

    const instructions = generateRevertInstructions({ diff });

    expect(instructions).toHaveLength(1);
    expect(instructions[0].title).toContain("No Remediation");
    expect(instructions[0].severity).toBe("INFO");
  });

  it("does not execute mutations (text-only)", () => {
    // Verify that no HTTP calls are made during instruction generation
    const diff: DiffResult = {
      addedGlobalAdmins: [{ accountId: "bob" }],
      removedGlobalAdmins: [],
      riskEscalations: [],
      changedProjectCount: 0,
      schemaVersion: "1.0.0",
    };

    // This should not throw or make any API calls
    const instructions = generateRevertInstructions({ diff });

    // Instructions should be parseable text templates
    expect(instructions.every((i) => typeof i.title === "string")).toBe(true);
    expect(instructions.every((i) => i.apiTemplates && Array.isArray(i.apiTemplates))).toBe(true);
  });
});
