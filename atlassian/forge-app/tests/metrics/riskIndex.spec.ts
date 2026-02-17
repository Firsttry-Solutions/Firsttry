/**
 * Risk Index Tests
 * Verify deterministic risk scoring formula
 */

import { describe, it, expect } from "vitest";
import { calculateRiskIndex } from "../../../src/metrics/riskIndex";

describe("calculateRiskIndex", () => {
  it("returns score 100 when snapshot has no risk factors", () => {
    const snapshot = {
      groups: [],
      projects: [],
      diffSummary: { unresolved: 0 },
    };

    const result = calculateRiskIndex(snapshot);

    expect(result.score).toBe(100);
    expect(result.breakdown.shadowAdmins).toBe(0);
    expect(result.breakdown.publicProjects).toBe(0);
    expect(result.breakdown.unresolvedDrifts).toBe(0);
  });

  it("calculates penalties correctly from multiple risk factors", () => {
    const snapshot = {
      groups: [{ name: "shadow-admins", members: [{ id: "u1" }, { id: "u2" }] }],
      projects: [{ isPublic: true }, { isPublic: false }],
      diffSummary: { unresolved: 3 },
    };

    const result = calculateRiskIndex(snapshot);

    // Penalties: (2 * 5) + (1 * 2) + (3 * 3) = 10 + 2 + 9 = 21
    // Score: 100 - 21 = 79
    expect(result.score).toBe(79);
    expect(result.breakdown.shadowAdmins).toBe(2);
    expect(result.breakdown.publicProjects).toBe(1);
    expect(result.breakdown.unresolvedDrifts).toBe(3);
    expect(result.breakdown.penalties.shadowAdmins).toBe(10);
    expect(result.breakdown.penalties.publicProjects).toBe(2);
    expect(result.breakdown.penalties.unresolvedDrifts).toBe(9);
  });

  it("caps score at 0 when penalties exceed 100", () => {
    const snapshot = {
      groups: [{ name: "shadow", members: Array(30).fill({ id: "u" }) }],
      projects: Array(30).fill({ isPublic: true }),
      diffSummary: { unresolved: 50 },
    };

    const result = calculateRiskIndex(snapshot);

    // Penalties: (30 * 5) + (30 * 2) + (50 * 3) = 150 + 60 + 150 = 360
    // Score: max(0, 100 - 360) = 0
    expect(result.score).toBe(0);
  });

  it("returns 0 for null or undefined snapshot", () => {
    const result1 = calculateRiskIndex(null);
    const result2 = calculateRiskIndex(undefined);

    expect(result1.score).toBe(100);
    expect(result2.score).toBe(100);
  });

  it("ignores non-public projects", () => {
    const snapshot = {
      groups: [],
      projects: [
        { isPublic: false },
        { isPublic: undefined },
        { isPublic: false },
      ],
      diffSummary: { unresolved: 0 },
    };

    const result = calculateRiskIndex(snapshot);

    expect(result.breakdown.publicProjects).toBe(0);
    expect(result.score).toBe(100);
  });

  it("is deterministic with same input", () => {
    const snapshot = {
      groups: [{ name: "shadow-team", members: [{ id: "u1" }] }],
      projects: [{ isPublic: true }],
      diffSummary: { unresolved: 2 },
    };

    const result1 = calculateRiskIndex(snapshot);
    const result2 = calculateRiskIndex(snapshot);

    expect(result1.score).toBe(result2.score);
    expect(JSON.stringify(result1.breakdown)).toBe(
      JSON.stringify(result2.breakdown)
    );
  });

  it("case-insensitive shadow admin detection", () => {
    const snapshot1 = {
      groups: [{ name: "SHADOW-ADMINS", members: [{ id: "u1" }] }],
      projects: [],
      diffSummary: { unresolved: 0 },
    };

    const snapshot2 = {
      groups: [{ name: "Shadow Team", members: [{ id: "u1" }] }],
      projects: [],
      diffSummary: { unresolved: 0 },
    };

    const result1 = calculateRiskIndex(snapshot1);
    const result2 = calculateRiskIndex(snapshot2);

    expect(result1.breakdown.shadowAdmins).toBe(1);
    expect(result2.breakdown.shadowAdmins).toBe(1);
  });
});
