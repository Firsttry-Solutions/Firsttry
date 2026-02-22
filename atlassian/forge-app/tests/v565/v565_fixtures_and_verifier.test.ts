import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { execFileSync } from "child_process";

// Import the EXISTING canonical serializer — src/canonicalize.ts
// This is the same serializer used by the export/hashing pipeline today.
import { canonicalizeToJSON } from "../../src/canonicalize";

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

describe("v5.6.5 canonical fixtures + verifier", () => {
  it("generates fixtures from canonical serializer and verifier passes", () => {
    const outDir = path.join(process.cwd(), "tools", "fixtures");
    fs.mkdirSync(outDir, { recursive: true });

    // Build a minimal payload object matching the canonical serializer's expected input
    const payloadObj = { schemaVersion: "5.6.5", type: "GENESIS" };

    // MUST: use canonical serializer output — not raw JSON.stringify
    const payloadCanonical = canonicalizeToJSON(payloadObj);
    expect(typeof payloadCanonical).toBe("string");
    expect(payloadCanonical.includes('"schemaVersion"')).toBe(true);

    const publicHash = sha256Hex(payloadCanonical);

    const shaOnly = {
      schemaVersion: "5.6.5",
      publicHashAlgo: "sha256",
      tenantTagHashAlgo: "hmac-sha256",
      hashingMode: "SHA256_ONLY",
      tenantTagPresent: false,
      snapshotHash: "00".repeat(32),
      ledger: {
        blocks: [
          {
            index: 0,
            type: "GENESIS",
            previousHash: "0",
            payloadCanonical,
            publicHash,
          },
        ],
      },
    };

    const plusTag = {
      schemaVersion: "5.6.5",
      publicHashAlgo: "sha256",
      tenantTagHashAlgo: "hmac-sha256",
      hashingMode: "SHA256_PLUS_TENANT_TAG",
      tenantTagPresent: true,
      tenantTag: "11".repeat(32),
      snapshotHash: "22".repeat(32),
      ledger: {
        blocks: [
          {
            index: 0,
            type: "GENESIS",
            previousHash: "0",
            payloadCanonical,
            publicHash,
          },
        ],
      },
    };

    const shaOnlyPath = path.join(outDir, "v565_export_example_sha256_only.json");
    const plusTagPath = path.join(outDir, "v565_export_example_plus_tag.json");

    fs.writeFileSync(shaOnlyPath, JSON.stringify(shaOnly, null, 2) + "\n", "utf8");
    fs.writeFileSync(plusTagPath, JSON.stringify(plusTag, null, 2) + "\n", "utf8");

    // Run the verifier against both fixtures
    const verifierPath = path.join(process.cwd(), "tools", "verify_export.js");
    expect(fs.existsSync(verifierPath)).toBe(true);

    execFileSync("node", [verifierPath, shaOnlyPath], { stdio: "pipe" });
    execFileSync("node", [verifierPath, plusTagPath], { stdio: "pipe" });
  });
});
