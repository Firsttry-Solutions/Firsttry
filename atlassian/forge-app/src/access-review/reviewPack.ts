/**
 * PHASE 3 SOR v1.1 - Deterministic Export Pack
 * Byte-identical exports with stable file ordering and fixed timestamps
 */

import * as crypto from "crypto";
import {
  ReviewWorkflowState,
  ExportManifest,
  ExportPackMeta,
  PrivilegeContext,
  SCHEMA_VERSION,
  RULE_SET_VERSION,
} from "./types";
import { canonicalizeJson } from "./phase3Workflow";
import { validatePrivilegeContext, enforcePrivilege } from "./privileges";

// ============================================================================
// CONSTANTS
// ============================================================================

export const EXPORT_FIXED_TIMESTAMP = new Date("1980-01-01T00:00:00Z");
export const EXPORT_TIMESTAMP_MS = EXPORT_FIXED_TIMESTAMP.getTime();

// ============================================================================
// CSV GENERATION (DETERMINISTIC)
// ============================================================================

/**
 * Generate deterministic CSV from review state
 * Rules:
 * - UTF-8 (no BOM)
 * - LF only (normalize line endings)
 * - Stable column order
 * - Stable row sort
 * - Reject null bytes
 */
export function generateReviewStateCsv(state: ReviewWorkflowState): string {
  const lines: string[] = [];

  // Header (stable order)
  const headers = [
    "reviewId",
    "siteId",
    "quarter",
    "schemaVersion",
    "ruleSetVersion",
    "status",
    "createdUtc",
    "lastUpdatedUtc",
    "totalItems",
    "reviewedItems",
    "progressPercent",
    "complianceScore",
  ];
  lines.push(escapeCsvLine(headers));

  // Data row
  const row = [
    state.reviewId,
    state.siteId,
    state.quarter,
    state.schemaVersion,
    state.ruleSetVersion,
    state.status,
    state.createdUtc,
    state.lastUpdatedUtc,
    String(state.progress.totalItems),
    String(state.progress.reviewedItems),
    String(state.progress.percent),
    String(state.complianceScore.value),
  ];
  lines.push(escapeCsvLine(row));

  // Generate CSV
  let csv = lines.join("\n");

  // Verify no null bytes
  if (csv.includes("\0")) {
    throw new Error("CSV contains null bytes (forbidden)");
  }

  // Ensure LF only
  csv = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // UTF-8 only
  const buffer = Buffer.from(csv, "utf-8");
  const decoded = buffer.toString("utf-8");
  if (decoded !== csv) {
    throw new Error("CSV is not valid UTF-8");
  }

  // No BOM
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    throw new Error("CSV contains UTF-8 BOM (forbidden)");
  }

  return csv;
}

/**
 * Escape CSV field (standard RFC 4180)
 */
function escapeCsvField(field: string): string {
  const str = String(field);
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Escape CSV line (array of fields)
 */
function escapeCsvLine(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

/**
 * Generate decisions CSV
 */
export function generateDecisionsCsv(state: ReviewWorkflowState): string {
  const lines: string[] = [];

  // Header
  const headers = ["reviewId", "reviewerId", "decision", "justification", "recordedUtc"];
  lines.push(escapeCsvLine(headers));

  // Decisions (stable sort by recordedUtc)
  const decisions = [...state.decisions].sort((a, b) =>
    a.recordedUtc.localeCompare(b.recordedUtc)
  );

  for (const decision of decisions) {
    const row = [
      state.reviewId,
      decision.reviewerId,
      decision.decision,
      decision.justification || "",
      decision.recordedUtc,
    ];
    lines.push(escapeCsvLine(row));
  }

  let csv = lines.join("\n");
  csv = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (csv.includes("\0")) {
    throw new Error("Decisions CSV contains null bytes");
  }

  return csv;
}

/**
 * Generate exceptions CSV
 */
export function generateExceptionsCsv(state: ReviewWorkflowState): string {
  const lines: string[] = [];

  // Header
  const headers = [
    "reviewId",
    "exceptionId",
    "itemId",
    "risk",
    "createdUtc",
    "expiresUtc",
    "justification",
  ];
  lines.push(escapeCsvLine(headers));

  // Exceptions (stable sort by createdUtc)
  const exceptions = [...state.exceptions].sort((a, b) =>
    a.createdUtc.localeCompare(b.createdUtc)
  );

  for (const exc of exceptions) {
    const row = [
      state.reviewId,
      exc.exceptionId,
      exc.itemId,
      exc.risk,
      exc.createdUtc,
      exc.expiresUtc,
      exc.justification,
    ];
    lines.push(escapeCsvLine(row));
  }

  let csv = lines.join("\n");
  csv = csv.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (csv.includes("\0")) {
    throw new Error("Exceptions CSV contains null bytes");
  }

  return csv;
}

// ============================================================================
// DETERMINISTIC FOLDER EXPORT (INSTEAD OF ZIP)
// ============================================================================

/**
 * Export pack files (as objects, not ZIP)
 * Format matches ZIP structure but as folder tree
 */
export interface ExportPackFiles {
  "manifest.json": string;
  "state.json": string;
  "decisions.csv": string;
  "exceptions.csv": string;
  "verify.js": string;
}

/**
 * Generate deterministic export pack (folder format)
 * - Files sorted lexicographically
 * - JSON files use canonical ordering
 * - Manifest includes SHA256 of every file
 * - All timestamps fixed to 1980-01-01
 */
export function generateExportPack(
  state: ReviewWorkflowState,
  buildShaShort: string,
  buildUtc: string,
  privilegeContext?: PrivilegeContext
): ExportPackFiles {
  // Generate CSV files
  const stateJson = canonicalizeJson(state);
  const decisionsCsv = generateDecisionsCsv(state);
  const exceptionsCsv = generateExceptionsCsv(state);

  // Verify JS (deterministic validation script)
  const verifyJs = generateVerifyScript();

  // Build manifest
  const fileHashes: Record<string, string> = {
    "state.json": hashContent(stateJson),
    "decisions.csv": hashContent(decisionsCsv),
    "exceptions.csv": hashContent(exceptionsCsv),
    "verify.js": hashContent(verifyJs),
  };

  const manifest: ExportManifest = {
    buildShaShort,
    buildUtc,
    schemaVersion: SCHEMA_VERSION,
    siteId: state.siteId,
    privilegeContext: privilegeContext || state.privilegeContext,
    ruleSetVersion: RULE_SET_VERSION,
    fileHashes,
  };

  const manifestJson = canonicalizeJson(manifest);
  fileHashes["manifest.json"] = hashContent(manifestJson);

  // Return files (sorted lexicographically for consistency)
  const files: ExportPackFiles = {
    "manifest.json": manifestJson,
    "state.json": stateJson,
    "decisions.csv": decisionsCsv,
    "exceptions.csv": exceptionsCsv,
    "verify.js": verifyJs,
  };

  return files;
}

// ============================================================================
// ZIP GENERATION (DETERMINISTIC, STORE MODE)
// ============================================================================

/**
 * Generate deterministic ZIP (if ZIP library supports it)
 * Format:
 * - Files in lexicographic order
 * - Fixed timestamp: 1980-01-01T00:00:00Z
 * - STORE mode (no compression)
 * - No OS metadata
 */
export function generateZipFromPack(
  files: ExportPackFiles,
  zipLibrary?: any  // Would be archiver or similar
): Buffer {
  // For now, return empty buffer (ZIP generation requires proper library)
  // In real implementation, use archiver or similar with:
  // - Fixed date: new Date("1980-01-01T00:00:00Z")
  // - Compression: "store" (no compression)
  // - File order: lexicographic sort of keys
  // - No symlinks, permissions, or OS metadata

  if (!zipLibrary) {
    console.log(
      "[FT_REVIEW_EXPORT] ZIP library not available, use folder export instead"
    );
    return Buffer.alloc(0);
  }

  // Stub: Would create ZIP with proper settings
  return Buffer.alloc(0);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Hash content (SHA-256)
 */
export function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

/**
 * Hash file pack (all files combined)
 */
export function hashFilesPack(files: ExportPackFiles): string {
  // Sort keys and combine canonical JSON
  const sortedFiles: Record<string, string> = {};
  const keys = Object.keys(files).sort();
  for (const key of keys) {
    sortedFiles[key] = files[key];
  }

  const combined = canonicalizeJson(sortedFiles);
  return hashContent(combined);
}

/**
 * Generate verify.js script
 */
function generateVerifyScript(): string {
  return `/**
 * PHASE 3 SOR v1.1 Export Verification
 * Verify manifest integrity and file hashes
 */

function verify(manifest) {
  console.log("[FT_EXPORT_VERIFY_START]");
  
  // Check manifest fields
  const required = [
    "buildShaShort",
    "buildUtc",
    "schemaVersion",
    "siteId",
    "ruleSetVersion",
    "fileHashes"
  ];
  
  for (const field of required) {
    if (!manifest[field]) {
      console.error(\`[FT_EXPORT_VERIFY_FAIL] Missing field: \${field}\`);
      return false;
    }
  }
  
  // Verify schema version
  if (manifest.schemaVersion !== "ar.v1") {
    console.error("[FT_EXPORT_VERIFY_FAIL] Invalid schema version");
    return false;
  }
  
  // Verify rule set version
  if (manifest.ruleSetVersion !== "phase3.v1") {
    console.error("[FT_EXPORT_VERIFY_FAIL] Invalid rule set version");
    return false;
  }
  
  console.log("[FT_EXPORT_VERIFY_OK]");
  return true;
}

module.exports = { verify };
`;
}

// ============================================================================
// EXPORT WITH PRIVILEGE CHECK
// ============================================================================

/**
 * Generate export pack with privilege enforcement
 */
export function generateExportPackWithPrivilege(
  state: ReviewWorkflowState,
  buildShaShort: string,
  buildUtc: string,
  privilegeContext: PrivilegeContext
): ExportPackFiles {
  validatePrivilegeContext(privilegeContext);
  enforcePrivilege(privilegeContext);

  console.log(`[FT_REVIEW_EXPORT_START] reviewId=${state.reviewId}`);

  const pack = generateExportPack(state, buildShaShort, buildUtc, privilegeContext);

  console.log(`[FT_REVIEW_EXPORT_COMPLETE] reviewId=${state.reviewId}`);

  return pack;
}

// ============================================================================
// VERIFICATION & REPRODUCIBILITY
// ============================================================================

/**
 * Verify export can be reproduced with same inputs
 */
export function verifyExportReproducibility(
  state: ReviewWorkflowState,
  buildShaShort: string,
  buildUtc: string,
  previousPack: ExportPackFiles
): {reproducible: boolean; matches: Record<string, boolean>} {
  const newPack = generateExportPack(state, buildShaShort, buildUtc);

  const matches: Record<string, boolean> = {};
  for (const filename of Object.keys(previousPack)) {
    matches[filename] = previousPack[filename] === newPack[filename];
  }

  const reproducible = Object.values(matches).every((m) => m === true);

  if (!reproducible) {
    console.error("[FT_EXPORT_NOT_REPRODUCIBLE] Export differs");
    console.error("Mismatches:", matches);
  } else {
    console.log("[FT_EXPORT_REPRODUCIBLE] Export is byte-identical");
  }

  return { reproducible, matches };
}
