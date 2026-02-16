#!/usr/bin/env node

/**
 * STEP 11 Smoke Test: Local Packet Generation
 * Tests createUniversalPacket without deployment
 * Generates FirstTry-Audit-Evidence.html to verify functionality
 *
 * FT_PROOF_LOCAL_PACKET_SMOKE_v1: Smoke test for packet generation
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { register } from "ts-node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..", "..");

// Register TypeScript loader for ESM
register({
  esm: true,
  experimentalEsm: true,
});

const runDir = process.argv[2] || "/tmp";

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

async function main() {
  console.log("[FT_PROOF_LOCAL_PACKET_SMOKE_v1]", {
    marker: "FT_PROOF_LOCAL_PACKET_SMOKE_v1",
  });
  console.log("Starting smoke test...");
  console.log("Run directory:", runDir);

  try {
    // Dynamically import the packer module
    const packerPath = path.join(projectRoot, "dist", "export", "auditor", "packer.js");
    const { createUniversalPacket } = await import(packerPath);

    // Generate packet
    console.log("Generating universal packet...");
    const htmlContent = await createUniversalPacket({
      snapshot: fakeSnapshot,
    });

    console.log("✅ Packet generated successfully");
    console.log("HTML size:", htmlContent.length, "bytes");

    // Write to file
    const outputPath = path.join(runDir, "FirstTry-Audit-Evidence.html");
    fs.writeFileSync(outputPath, htmlContent, "utf-8");
    console.log("✅ Written to:", outputPath);

    // Verify file
    const stats = fs.statSync(outputPath);
    console.log("✅ File verified:", stats.size, "bytes");

    // Quick sanity checks
    if (!htmlContent.includes("<!DOCTYPE html>")) {
      throw new Error("HTML does not have DOCTYPE");
    }
    console.log("✅ HTML structure valid");

    if (!htmlContent.includes("INTERNAL CONSISTENCY VERIFIED")) {
      throw new Error("HTML missing verification UI");
    }
    console.log("✅ Verification UI present");

    if (!htmlContent.includes("FirstTry Auditor Evidence Report")) {
      throw new Error("HTML missing report title");
    }
    console.log("✅ Report title present");

    console.log("");
    console.log("✅ SMOKE TEST PASSED");
    console.log("Open in browser:", outputPath);
    process.exit(0);
  } catch (error) {
    console.error("❌ SMOKE TEST FAILED:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
