/**
 * STEP 11 Smoke Test: Universal Packet Generation
 * Tests createUniversalPacket output without deployment
 *
 * FT_PROOF_LOCAL_PACKET_SMOKE_v1: Smoke test for packet generation
 */

import { describe, it, expect } from "vitest";
import { createUniversalPacket } from "../../../src/export/auditor/packer";

describe("Auditor Packer - Smoke Test", () => {
  // Minimal fake snapshot for smoke test
  const fakeSnapshot = {
    schemaVersion: "1.0.0",
    siteId: "ari:cloud:jira::site/00000000-0000-0000-0000-000000000000",
    buildShaShort: "abc12345",
    buildUtc: "2026-02-16T18:52:51Z",
    privilegeContext: "READ_ONLY",
    ruleSetVersion: "v1.0.0",
    globalAdmins: [
      {
        accountId: "AAAAAAAAAAAAAAAAAAAAAAA",
        email: "admin@example.com",
      },
    ],
    projects: [
      {
        key: "TEST",
        permissionScheme: {
          permissions: [
            {
              permissionKey: "BROWSE_PROJECTS",
              holders: [{ type: "atlassian-group-access-user" }],
            },
          ],
        },
      },
    ],
    meta: {
      buildUtc: "2026-02-16T18:52:51Z",
      publicExposure: false,
    },
  };

  it("should generate valid HTML packet", async () => {
    const htmlContent = await createUniversalPacket({
      snapshot: fakeSnapshot,
    });

    expect(htmlContent).toBeDefined();
    expect(typeof htmlContent).toBe("string");
    expect(htmlContent.length).toBeGreaterThan(0);
  });

  it("should include DOCTYPE in generated HTML", async () => {
    const htmlContent = await createUniversalPacket({
      snapshot: fakeSnapshot,
    });

    expect(htmlContent).toContain("<!DOCTYPE html>");
  });

  it("should include verification UI in HTML", async () => {
    const htmlContent = await createUniversalPacket({
      snapshot: fakeSnapshot,
    });

    expect(htmlContent).toContain("Verify Internal Consistency");
  });

  it("should include report title in HTML", async () => {
    const htmlContent = await createUniversalPacket({
      snapshot: fakeSnapshot,
    });

    expect(htmlContent).toContain("FirstTry Auditor Evidence Report");
  });

  it("should contain embedded evidence JSON", async () => {
    const htmlContent = await createUniversalPacket({
      snapshot: fakeSnapshot,
    });

    expect(htmlContent).toContain("evidence");
  });

  it("should contain manifest with hash", async () => {
    const htmlContent = await createUniversalPacket({
      snapshot: fakeSnapshot,
    });

    expect(htmlContent).toContain("manifest");
    expect(htmlContent).toContain("evidenceSha256");
  });
});
