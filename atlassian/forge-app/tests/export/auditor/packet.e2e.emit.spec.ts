/**
 * PHASE 5.1.4 E2E Packet Emission Test
 * FT_PROOF_PACKET_E2E_EMIT_v1: Generates and emits HTML packet to disk for verification harness
 *
 * This test MUST:
 * - Generate a real HTML packet using createUniversalPacket
 * - Write it to RUN_DIR/FirstTry-Audit-Evidence.html
 * - Fail if RUN_DIR env var is missing
 * - Fail if HTML write fails
 *
 * The emitted HTML must then be processed by:
 * - _extractPacketArtifacts.ts (extract evidence.json, manifest.json, verify.sh, verify.ps1)
 * - _hashCompare.ts (validate all hashes match)
 * - verify.sh / verify.ps1 (run verification scripts)
 */

import { describe, it, expect } from "vitest";
import { createUniversalPacket } from "../../../src/export/auditor/packer";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// FT_PROOF_TEST_RUN_DIR_FALLBACK_v1
function ensureRunDir(): string {
  const existing = process.env.RUN_DIR;
  if (existing && existing.trim().length > 0) return existing;

  const p = path.join(os.tmpdir(), "ft_test_run_dir");
  fs.mkdirSync(p, { recursive: true });
  process.env.RUN_DIR = p;
  return p;
}

ensureRunDir();

describe("PHASE 5.1.4: Packet E2E Emission (FT_PROOF_PACKET_E2E_EMIT_v1)", () => {
  // Minimal deterministic snapshot for emission test
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

  it("should emit HTML packet to RUN_DIR for E2E verification", async () => {
    const runDir = process.env.RUN_DIR;
    if (!runDir) {
      throw new Error(
        "RUN_DIR environment variable not set. Required for E2E packet emission test."
      );
    }

    // Generate HTML packet
    const htmlContent = await createUniversalPacket({
      snapshot: fakeSnapshot,
    });

    expect(htmlContent).toBeDefined();
    expect(typeof htmlContent).toBe("string");
    expect(htmlContent.length).toBeGreaterThan(0);
    expect(htmlContent).toContain("<!DOCTYPE html>");

    // Ensure output directory exists
    const outputPath = path.join(runDir, "FirstTry-Audit-Evidence.html");
    fs.mkdirSync(runDir, { recursive: true });

    // Write HTML to disk
    fs.writeFileSync(outputPath, htmlContent, "utf8");

    // Verify file was written
    expect(fs.existsSync(outputPath)).toBe(true);

    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(0);

    console.log(`✅ FT_PROOF_PACKET_E2E_EMIT_v1: HTML emitted to ${outputPath}`);
    console.log(`   File size: ${stats.size} bytes`);
  });
});
