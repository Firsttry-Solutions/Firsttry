/**
 * Context Diff Tests
 * Verify deterministic pattern matching and context calculation
 */

import { describe, it, expect } from "vitest";
import { generateDiff } from "../../../src/diff/diffEngine";

describe("generateDiff with Context", () => {
  const baseSnapshot = {
    schemaVersion: "1.0",
    globalAdmins: [],
    projects: [],
  };

  it("returns empty context when no changes detected", () => {
    const snapshot1 = { ...baseSnapshot };
    const snapshot2 = { ...baseSnapshot };

    const result = generateDiff(snapshot1, snapshot2);

    expect(result.context).toBeDefined();
    expect(result.context?.projectCountAffected).toBe(0);
    expect(result.context?.confidentialMatchCount).toBe(0);
    expect(result.context?.matchedPatterns).toEqual([]);
  });

  it("detects HR pattern in project name", () => {
    const snapshot1 = { ...baseSnapshot, projects: [] };
    const snapshot2 = {
      ...baseSnapshot,
      projects: [{ key: "HR001", name: "HR System Update", description: "" }],
    };

    const result = generateDiff(snapshot1, snapshot2);

    expect(result.context?.matchedPatterns).toContain("HR");
    expect(result.context?.confidentialMatchCount).toBeGreaterThan(0);
  });

  it("detects PAY pattern in project key", () => {
    const snapshot1 = { ...baseSnapshot, projects: [] };
    const snapshot2 = {
      ...baseSnapshot,
      projects: [{ key: "PAYROLL", name: "Finance", description: "" }],
    };

    const result = generateDiff(snapshot1, snapshot2);

    expect(result.context?.matchedPatterns).toContain("PAY");
  });

  it("detects SEC pattern in project description", () => {
    const snapshot1 = { ...baseSnapshot, projects: [] };
    const snapshot2 = {
      ...baseSnapshot,
      projects: [
        {
          key: "PROJ001",
          name: "Project One",
          description: "Security team internal",
        },
      ],
    };

    const result = generateDiff(snapshot1, snapshot2);

    expect(result.context?.matchedPatterns).toContain("SEC");
  });

  it("is case-insensitive for pattern matching", () => {
    const snapshot1 = { ...baseSnapshot, projects: [] };
    const snapshot2 = {
      ...baseSnapshot,
      projects: [
        {
          key: "hr_test",
          name: "pay_module",
          description: "sec_audit",
        },
      ],
    };

    const result = generateDiff(snapshot1, snapshot2);

    expect(result.context?.matchedPatterns).toContain("HR");
    expect(result.context?.matchedPatterns).toContain("PAY");
    expect(result.context?.matchedPatterns).toContain("SEC");
  });

  it("returns sorted unique patterns", () => {
    const snapshot1 = { ...baseSnapshot, projects: [] };
    const snapshot2 = {
      ...baseSnapshot,
      projects: [
        {
          key: "SEC",
          name: "HR Stuff",
          description: "PAY RULES SEC",
        },
      ],
    };

    const result = generateDiff(snapshot1, snapshot2);

    // Should contain all 3 patterns, sorted
    expect(result.context?.matchedPatterns).toEqual(["HR", "PAY", "SEC"]);
  });

  it("counts changed projects in projectCountAffected", () => {
    const snapshot1 = {
      ...baseSnapshot,
      projects: [
        { key: "P1", name: "Project One", description: "" },
        { key: "P2", name: "Project Two", description: "" },
      ],
    };
    const snapshot2 = {
      ...baseSnapshot,
      projects: [
        { key: "P1", name: "Project One", description: "Updated" },
        { key: "P2", name: "Project Two", description: "" },
      ],
    };

    const result = generateDiff(snapshot1, snapshot2);

    // P1 changed (description updated), P2 unchanged
    expect(result.context?.projectCountAffected).toBe(1);
  });

  it("is deterministic with same input", () => {
    const snapshot1 = { ...baseSnapshot };
    const snapshot2 = {
      ...baseSnapshot,
      projects: [{ key: "HR_PROJ", name: "HR System", description: "" }],
    };

    const result1 = generateDiff(snapshot1, snapshot2);
    const result2 = generateDiff(snapshot1, snapshot2);

    expect(result1.context?.matchedPatterns).toEqual(result2.context?.matchedPatterns);
    expect(result1.context?.projectCountAffected).toBe(result2.context?.projectCountAffected);
    expect(result1.context?.confidentialMatchCount).toBe(
      result2.context?.confidentialMatchCount
    );
  });

  it("handles projects with null fields gracefully", () => {
    const snapshot1 = { ...baseSnapshot, projects: [] };
    const snapshot2 = {
      ...baseSnapshot,
      projects: [
        { key: null, name: null, description: null },
        { key: "HR01", name: "Test", description: undefined },
      ],
    };

    const result = generateDiff(snapshot1, snapshot2);

    expect(result.context?.matchedPatterns).toContain("HR");
    // Should not crash on null/undefined fields
    expect(result.context?.projectCountAffected).toBeGreaterThanOrEqual(0);
  });
});
