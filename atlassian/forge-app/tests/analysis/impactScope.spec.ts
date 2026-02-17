/**
 * Impact Scope Tests
 * Verify deterministic impact analysis from snapshots
 */

import { describe, it, expect } from "vitest";
import { getImpactScopeFromSnapshot, getGroupImpactsFromSnapshot } from "../../src/analysis/impactScope";

describe("getImpactScopeFromSnapshot", () => {
  it("returns zero for empty snapshot", () => {
    const snapshot = {
      groups: [],
      projects: [],
    };

    const result = getImpactScopeFromSnapshot(snapshot, "group-123");

    expect(result.projectCount).toBe(0);
    expect(result.permissionTypes).toEqual([]);
  });

  it("returns zero for undefined snapshot", () => {
    const result = getImpactScopeFromSnapshot(undefined, "group-123");

    expect(result.projectCount).toBe(0);
    expect(result.permissionTypes).toEqual([]);
  });

  it("returns zero for null groupId", () => {
    const snapshot = { groups: [], projects: [] };

    const result = getImpactScopeFromSnapshot(snapshot, null as any);

    expect(result.projectCount).toBe(0);
    expect(result.permissionTypes).toEqual([]);
  });

  it("detects group assigned to projects", () => {
    const snapshot = {
      groups: [
        {
          id: "group-1",
          projects: [
            { key: "PROJ1", permission: "PROJECT_ADMIN" },
            { key: "PROJ2", permission: "READ" },
          ],
        },
      ],
      projects: [
        { key: "PROJ1", permissionScheme: { permissions: [] } },
        { key: "PROJ2", permissionScheme: { permissions: [] } },
      ],
    };

    const result = getImpactScopeFromSnapshot(snapshot, "group-1");

    expect(result.projectCount).toBe(2);
    expect(result.permissionTypes).toEqual(["PROJECT_ADMIN", "READ"]);
  });

  it("detects permissions from project permission scheme holders", () => {
    const snapshot = {
      groups: [],
      projects: [
        {
          key: "PROJ1",
          permissionScheme: {
            permissions: [
              {
                permission: "BROWSE_PROJECTS",
                holders: [{ parameter: "group-1" }],
              },
              {
                permission: "ADMINISTER_PROJECTS",
                holders: [{ parameter: "group-1" }],
              },
            ],
          },
        },
        {
          key: "PROJ2",
          permissionScheme: {
            permissions: [
              {
                permission: "BROWSE_PROJECTS",
                holders: [{ id: "group-1" }],
              },
            ],
          },
        },
      ],
    };

    const result = getImpactScopeFromSnapshot(snapshot, "group-1");

    expect(result.projectCount).toBe(2);
    expect(result.permissionTypes).toContain("BROWSE_PROJECTS");
    expect(result.permissionTypes).toContain("ADMINISTER_PROJECTS");
  });

  it("returns sorted unique permission types", () => {
    const snapshot = {
      groups: [],
      projects: [
        {
          key: "P1",
          permissionScheme: {
            permissions: [
              { permission: "WRITE", holders: [{ parameter: "group-1" }] },
              { permission: "READ", holders: [{ parameter: "group-1" }] },
            ],
          },
        },
        {
          key: "P2",
          permissionScheme: {
            permissions: [
              { permission: "WRITE", holders: [{ parameter: "group-1" }] },
              { permission: "ADMIN", holders: [{ parameter: "group-1" }] },
            ],
          },
        },
      ],
    };

    const result = getImpactScopeFromSnapshot(snapshot, "group-1");

    expect(result.permissionTypes).toEqual(["ADMIN", "READ", "WRITE"]);
  });

  it("is deterministic with same input", () => {
    const snapshot = {
      groups: [
        {
          id: "test-group",
          projects: [{ key: "P1", permission: "READ" }],
        },
      ],
      projects: [
        {
          key: "P1",
          permissionScheme: {
            permissions: [{ permission: "BROWSE", holders: [{ parameter: "test-group" }] }],
          },
        },
      ],
    };

    const result1 = getImpactScopeFromSnapshot(snapshot, "test-group");
    const result2 = getImpactScopeFromSnapshot(snapshot, "test-group");

    expect(result1.projectCount).toBe(result2.projectCount);
    expect(result1.permissionTypes).toEqual(result2.permissionTypes);
  });

  it("handles malformed project objects gracefully", () => {
    const snapshot = {
      groups: [],
      projects: [
        null,
        undefined,
        {},
        {
          key: "PROJ1",
          permissionScheme: {
            permissions: [{ permission: "READ", holders: [{ parameter: "group-1" }] }],
          },
        },
      ],
    };

    const result = getImpactScopeFromSnapshot(snapshot, "group-1");

    expect(result.projectCount).toBe(1);
    expect(result.permissionTypes).toEqual(["READ"]);
  });

  it("does not simulate or predict future permissions", () => {
    // Impact scope should never create new state or forecast
    const snapshot = {
      groups: [{ id: "group-1" }],
      projects: [],
    };

    const result = getImpactScopeFromSnapshot(snapshot, "group-1");

    // Should be empty since no actual assignments exist
    expect(result.projectCount).toBe(0);
    expect(result.permissionTypes).toEqual([]);
  });
});

describe("getGroupImpactsFromSnapshot", () => {
  it("returns map of all group impacts", () => {
    const snapshot = {
      groups: [
        { id: "g1", projects: [{ key: "P1", permission: "ADMIN" }] },
        { id: "g2", projects: [{ key: "P2", permission: "READ" }] },
      ],
      projects: [
        { key: "P1", permissionScheme: { permissions: [] } },
        { key: "P2", permissionScheme: { permissions: [] } },
      ],
    };

    const impacts = getGroupImpactsFromSnapshot(snapshot);

    expect(impacts.size).toBe(2);
    expect(impacts.get("g1")?.projectCount).toBe(1);
    expect(impacts.get("g2")?.projectCount).toBe(1);
  });

  it("returns empty map for empty snapshot", () => {
    const snapshot = { groups: [], projects: [] };

    const impacts = getGroupImpactsFromSnapshot(snapshot);

    expect(impacts.size).toBe(0);
  });
});
