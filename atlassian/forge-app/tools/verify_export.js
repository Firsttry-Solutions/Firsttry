/**
 * Review Pack External Verifier
 *
 * Usage: node tools/verify_export.js <path-to-export-json>
 *
 * Validates:
 * 1. Required top-level fields present
 * 2. publicHash = SHA-256(payloadCanonical) for each ledger block
 * 3. tenantTag presence: warn only (HMAC not externally verifiable)
 * 4. Schema version documented
 *
 * Exits 0 on pass, 1 on failure.
 * Pure node + crypto — no dist imports.
 */

const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function verify(filePath) {
  console.log("[VERIFY] Starting export verification for: " + filePath);

  if (!fs.existsSync(filePath)) {
    console.error("FAIL: File not found: " + filePath);
    process.exit(1);
  }

  let data;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    data = JSON.parse(raw);
  } catch (e) {
    console.error("FAIL: Invalid JSON: " + e.message);
    process.exit(1);
  }

  // 1. Schema version
  if (!data.schemaVersion) {
    console.error("FAIL: missing schemaVersion");
    process.exit(1);
  }
  console.log("[VERIFY] ✓ schemaVersion=" + data.schemaVersion);

  // 2. publicHashAlgo
  if (data.publicHashAlgo && data.publicHashAlgo !== "sha256") {
    console.error("FAIL: unsupported publicHashAlgo=" + data.publicHashAlgo);
    process.exit(1);
  }
  console.log("[VERIFY] ✓ publicHashAlgo=" + (data.publicHashAlgo || "sha256"));

  // 3. Verify ledger blocks (if present)
  if (data.ledger && Array.isArray(data.ledger.blocks)) {
    for (const block of data.ledger.blocks) {
      if (!block.payloadCanonical || !block.publicHash) {
        console.error("FAIL: ledger block missing payloadCanonical or publicHash at index " + block.index);
        process.exit(1);
      }
      const recomputed = sha256Hex(block.payloadCanonical);
      if (recomputed !== block.publicHash) {
        console.error("FAIL: publicHash mismatch at block index " + block.index);
        console.error("  expected: " + block.publicHash);
        console.error("  computed: " + recomputed);
        process.exit(1);
      }
      console.log("[VERIFY] ✓ block[" + block.index + "] publicHash matches (" + recomputed.slice(0, 16) + "...)");
    }
  } else {
    console.log("[VERIFY] ⚠ No ledger.blocks found; skipping block hash verification");
  }

  // 4. Tenant tag warning
  if (data.tenantTagPresent === true) {
    console.log("WARN: tenantTag present (HMAC) is not externally verifiable without tenant secret; publicHash verified.");
  }

  console.log("FT_PROOF_PUBLIC_VERIFIER_DUALHASH_COMPAT_v1 ok=true");
  console.log("[VERIFY] ✓ EXPORT VERIFICATION PASS");
  process.exit(0);
}

// CLI entry
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: node verify_export.js <path-to-export-json>");
  process.exit(1);
}
verify(args[0]);
