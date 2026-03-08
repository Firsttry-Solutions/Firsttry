#!/usr/bin/env node
/**
 * Phase 6 STRICT Bundle Hash Computation
 * 
 * SPEC (non-negotiable, fail-closed):
 * - Find exactly 1 block comment containing FT_IDENTITY_ANCHOR_V1|git=...|bundle=...|time=...
 * - Extract embedded git, bundle, time fields (must match /^[0-9a-f]{7,40}$/)
 * - Strip that exact block comment from the bundle (byte-level precision)
 * - Compute sha256(stripped_bytes)
 * - Extract prefix7 from computed hash
 * - MUST: computed prefix7 == embedded bundle (first 7 chars)
 * - Exit 1 if: count != 1, format invalid, or hash mismatch
 * - Output JSON with all fields
 */

import fs from "fs";
import crypto from "crypto";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node strip_and_hash.js <bundle_file>");
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`ERROR: File not found: ${filePath}`);
  process.exit(1);
}

const bundleBuffer = fs.readFileSync(filePath);
const bundleString = bundleBuffer.toString("utf8");

// Find block comment containing FT_IDENTITY_ANCHOR_V1 (STRICT: must be exactly 1)
const blockCommentRegex = /\/\*[\s\S]*?FT_IDENTITY_ANCHOR_V1[\s\S]*?\*\//g;
const matches = bundleString.match(blockCommentRegex) || [];

if (matches.length !== 1) {
  console.error(`ERROR: Expected exactly 1 block comment with anchor, found ${matches.length}`);
  process.exit(1);
}

const anchorBlockComment = matches[0];

// Extract anchor line fields (STRICT format validation)
const anchorLineRegex = /FT_IDENTITY_ANCHOR_V1\|git=([0-9a-f]+)\|bundle=([0-9a-f]+)\|time=([^\s|]+)/;
const anchorMatch = anchorBlockComment.match(anchorLineRegex);

if (!anchorMatch) {
  console.error("ERROR: Anchor format invalid. Expected: FT_IDENTITY_ANCHOR_V1|git=...|bundle=...|time=...");
  process.exit(1);
}

const embeddedGit = anchorMatch[1];
const embeddedBundle = anchorMatch[2];
const embeddedTime = anchorMatch[3];

// Validate SHA format (7-40 hex chars, not UNSET/ERROR)
if (!/^[0-9a-f]{7,40}$/.test(embeddedGit)) {
  console.error(`ERROR: Git SHA invalid format: ${embeddedGit}`);
  process.exit(1);
}
if (!/^[0-9a-f]{7,40}$/.test(embeddedBundle)) {
  console.error(`ERROR: Bundle SHA invalid format: ${embeddedBundle}`);
  process.exit(1);
}

// Strip the anchor block comment at byte level (preserve file encoding exactly)
const anchorBlockBytes = Buffer.from(anchorBlockComment, "utf8");
const anchorStartIndex = bundleBuffer.indexOf(anchorBlockBytes);

if (anchorStartIndex === -1) {
  console.error("ERROR: Could not find anchor block comment in buffer (encoding mismatch?)");
  process.exit(1);
}

const strippedBuffer = Buffer.concat([
  bundleBuffer.slice(0, anchorStartIndex),
  bundleBuffer.slice(anchorStartIndex + anchorBlockBytes.length),
]);

// Compute SHA256 of stripped content
const computedHash = crypto.createHash("sha256").update(strippedBuffer).digest("hex");
const computedPrefix7 = computedHash.substring(0, 7);

// HARD FAIL if computed hash does not match embedded bundle
if (computedPrefix7 !== embeddedBundle.substring(0, 7)) {
  console.error(`ERROR: HASH MISMATCH! Embedded bundle=${embeddedBundle} (prefix7=${embeddedBundle.substring(0, 7)}) but computed=${computedPrefix7}`);
  process.exit(1);
}

// Output JSON (strict format, all fields required)
const result = {
  bundleFile: filePath,
  anchorCount: matches.length,
  embeddedGit: embeddedGit,
  embeddedBundle: embeddedBundle,
  embeddedTime: embeddedTime,
  computedPrefix7: computedPrefix7,
  computedFull: computedHash,
  status: "OK",
};

console.log(JSON.stringify(result, null, 2));
process.exit(0);
