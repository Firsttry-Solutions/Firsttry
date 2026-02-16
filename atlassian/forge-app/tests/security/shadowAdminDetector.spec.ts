import { describe, it, expect } from "vitest";
import { detectShadowAdmins } from "../../src/security/shadowAdminDetector";

describe("Shadow Admin Detector", () => {
  it("detects global admins", () => {
    const snapshot = {
      schemaVersion: "1.0.0",
      globalAdmins: [{ accountId: "alice", email: "alice@example.com" }],
      projects: [],
      privilegeContext: "READ_ONLY",
    };

    const findings = detectShadowAdmins(snapshot);

    expect(findings).toHaveLength(1);
    expect(findings[0].accountId).toBe("alice");
    expect(findings[0].reasonCodes).toContain("GLOBAL_ADMIN");
  });

  it("deduplicates by accountId", () => {
    const snapshot = {
      schemaVersion: "1.0.0",
      globalAdmins: [{ accountId: "alice", email: "alice@example.com" }],
      projects: [
        {
          key: "PROJ1",
          permissionScheme: {
            permissions: [
              {
                permissionKey: "ADMINISTER_PROJECTS",
                holders: [{ parameter: "alice" }],
              },
            ],
          },
        },
      ],
      privilegeContext: "READ_ONLY",
    };

    const findings = detectShadowAdmins(snapshot);

    // Should have only one entry for alice (deduped)
    const aliceFindings = findings.filter((f) => f.accountId === "alice");
    expect(aliceFindings).toHaveLength(1);
    expect(aliceFindings[0].reasonCodes).toContain("GLOBAL_ADMIN");
  });

  it("returns empty for clean snapshot", () => {
    const snapshot = {
      schemaVersion: "1.0.0",
      globalAdmins: [],
      projects: [],
      privilegeContext: "READ_ONLY",
    };

    const findings = detectShadowAdmins(snapshot);

    expect(findings).toHaveLength(0);
  });
});
