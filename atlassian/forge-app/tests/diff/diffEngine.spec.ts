import { describe, it, expect } from "vitest";
import { generateDiff } from "../../src/diff/diffEngine";

describe("Diff Engine", () => {
  it("detects added global admins", () => {
    const prev = {
      schemaVersion: "1.0.0",
      globalAdmins: [{ accountId: "alice", email: "alice@example.com" }],
      projects: [],
    };
    const curr = {
      schemaVersion: "1.0.0",
      globalAdmins: [
        { accountId: "alice", email: "alice@example.com" },
        { accountId: "bob", email: "bob@example.com" },
      ],
      projects: [],
    };

    const result = generateDiff(prev, curr);

    expect(result.addedGlobalAdmins).toHaveLength(1);
    expect(result.addedGlobalAdmins[0].accountId).toBe("bob");
  });

  it("detects removed global admins", () => {
    const prev = {
      schemaVersion: "1.0.0",
      globalAdmins: [
        { accountId: "alice", email: "alice@example.com" },
        { accountId: "bob", email: "bob@example.com" },
      ],
      projects: [],
    };
    const curr = {
      schemaVersion: "1.0.0",
      globalAdmins: [{ accountId: "alice", email: "alice@example.com" }],
      projects: [],
    };

    const result = generateDiff(prev, curr);

    expect(result.removedGlobalAdmins).toHaveLength(1);
    expect(result.removedGlobalAdmins[0].accountId).toBe("bob");
  });

  it("fails on schema mismatch", () => {
    const prev = {
      schemaVersion: "1.0.0",
      globalAdmins: [],
      projects: [],
    };
    const curr = {
      schemaVersion: "2.0.0",
      globalAdmins: [],
      projects: [],
    };

    expect(() => generateDiff(prev, curr)).toThrow();
  });
});
