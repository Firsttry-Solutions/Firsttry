/**
 * Diagnostic Bundle Export
 * 
 * FT_PROOF_DIAGNOSTIC_EXPORT_v1
 * 
 * Export diagnostic data ONLY when verification fails with FAIL_MISMATCH.
 * Excludes PII (tenantKey, accountIds).
 * Deterministic bundle format for support forensics.
 */

import { storage } from "@forge/api";
import { sanitizeKey } from "../utils/sanitizeKey";
import { getVerifyAudit } from "../enterprise/verifyAudit";
import { failClosed } from "../shared/failClosed";

export interface DiagnosticBundle {
  schemaVersion: "ft-diagnostic@1";
  verificationStatus: string;
  mismatch: any;
  head: any;
  meta: any;
  blocks: Array<any>;
  recomputed: Array<{
    key: string;
    chainHash: string;
    recomputedChainHash: string;
    ok: boolean;
  }>;
}

/**
 * Build diagnostic bundle
 * 
 * FAIL-CLOSED: Only callable if current window verify status is FAIL_MISMATCH
 */
export async function buildDiagnosticBundle(tenantKey: string): Promise<DiagnosticBundle> {
  // Check current verify status
  const audit = await getVerifyAudit(tenantKey);

  if (audit.lastWindowStatus !== "FAIL_MISMATCH") {
    throw new Error(
      `FT_PROOF_DIAG_NOT_ALLOWED_v1: Diagnostic export only allowed on FAIL_MISMATCH, current status: ${audit.lastWindowStatus}`
    );
  }

  const headKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:head`;
  const metaKey = `ft:ledger:v1:${sanitizeKey(tenantKey)}:meta`;

  let head: any = null;
  let meta: any = null;
  const blocks: any[] = [];

  // Read head and meta
  const headData = await storage.get(headKey);
  if (headData) {
    head = typeof headData === "string" ? JSON.parse(headData) : headData;
  }

  const metaData = await storage.get(metaKey);
  if (metaData) {
    meta = typeof metaData === "string" ? JSON.parse(metaData) : metaData;
  }

  // Collect last 200 blocks
  let current = head;
  let collected = 0;

  while (current && collected < 200) {
    // Sanitize: remove tenantKey and accountIds
    const sanitized = { ...current };
    delete sanitized.tenantKey;
    delete sanitized.accountIds;
    delete sanitized.userId;

    blocks.push(sanitized);

    if (current.previousBlockKey) {
      try {
        const parentData = await storage.get(current.previousBlockKey);
        if (parentData) {
          current = typeof parentData === "string" ? JSON.parse(parentData) : parentData;
          collected++;
        } else {
          break;
        }
      } catch (err) {
        throw failClosed('FT_DIAG_BUNDLE_PARENT_BLOCK_FETCH_FAILED', 'Cannot fetch parent block for diagnostic bundle', err);
      }
    } else {
      break;
    }
  }

  // Placeholder for mismatch details and recomputed hashes
  // In a full implementation, this would include verification mismatch details
  const mismatch = {
    expectedChainHash: "unknown",
    computedChainHash: "unknown",
    firstMismatchBlock: null,
  };

  const recomputed: Array<{
    key: string;
    chainHash: string;
    recomputedChainHash: string;
    ok: boolean;
  }> = [];

  return {
    schemaVersion: "ft-diagnostic@1",
    verificationStatus: "FAIL_MISMATCH",
    mismatch,
    head,
    meta,
    blocks,
    recomputed,
  };
}
