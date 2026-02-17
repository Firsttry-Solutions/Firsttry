/**
 * Verify Audit Visibility
 * 
 * FT_PROOF_VERIFY_AUDIT_VISIBILITY_v1
 * 
 * Track verification window results deterministically.
 * No Date. Reads only from stored state.
 */

import { storage } from "@forge/api";
import { sanitizeKey } from "../utils/sanitizeKey";

export type VerifyWindowStatus = "OK_VERIFIED" | "DEGRADED_STORAGE_READ" | "FAIL_MISMATCH" | null;

export interface VerifyAuditState {
  lastFullVerifyAtUtc: string | null;
  lastWindowVerifyAtUtc: string | null;
  lastWindowStatus: VerifyWindowStatus;
}

/**
 * Storage key for verify audit
 */
function getVerifyAuditKey(tenantKey: string): string {
  return `ft:verify:v1:${sanitizeKey(tenantKey)}`;
}

/**
 * Get current verify audit state
 */
export async function getVerifyAudit(tenantKey: string): Promise<VerifyAuditState> {
  const key = getVerifyAuditKey(tenantKey);

  try {
    const data = await storage.get(key);
    if (!data) {
      return {
        lastFullVerifyAtUtc: null,
        lastWindowVerifyAtUtc: null,
        lastWindowStatus: null,
      };
    }

    try {
      const state = typeof data === "string" ? JSON.parse(data) : data;
      return {
        lastFullVerifyAtUtc: state.lastFullVerifyAtUtc || null,
        lastWindowVerifyAtUtc: state.lastWindowVerifyAtUtc || null,
        lastWindowStatus: state.lastWindowStatus || null,
      };
    } catch (err) {
      console.error(`[verifyAudit] Parse error: ${err}`);
      return {
        lastFullVerifyAtUtc: null,
        lastWindowVerifyAtUtc: null,
        lastWindowStatus: null,
      };
    }
  } catch (err) {
    console.error(`[verifyAudit] Read error: ${err}`);
    return {
      lastFullVerifyAtUtc: null,
      lastWindowVerifyAtUtc: null,
      lastWindowStatus: null,
    };
  }
}

/**
 * Record window verification result
 *
 * Called after window verify completes
 * observedAtUtc should be from head block
 */
export async function recordWindowVerify(
  tenantKey: string,
  observedAtUtc: string,
  status: VerifyWindowStatus
): Promise<void> {
  const key = getVerifyAuditKey(tenantKey);

  try {
    const existing = (await getVerifyAudit(tenantKey)) || {};

    const updated: VerifyAuditState = {
      lastFullVerifyAtUtc: existing.lastFullVerifyAtUtc || null,
      lastWindowVerifyAtUtc: observedAtUtc,
      lastWindowStatus: status || null,
    };

    await storage.set(key, JSON.stringify(updated));
  } catch (err) {
    console.error(`[verifyAudit] Record error: ${err}`);
    // Non-fatal: continue without storing
  }
}

/**
 * Record full verification result
 *
 * Called when full ledger verify succeeds
 */
export async function recordFullVerify(tenantKey: string, observedAtUtc: string): Promise<void> {
  const key = getVerifyAuditKey(tenantKey);

  try {
    const existing = (await getVerifyAudit(tenantKey)) || {};

    const updated: VerifyAuditState = {
      lastFullVerifyAtUtc: observedAtUtc,
      lastWindowVerifyAtUtc: existing.lastWindowVerifyAtUtc || null,
      lastWindowStatus: existing.lastWindowStatus || null,
    };

    await storage.set(key, JSON.stringify(updated));
  } catch (err) {
    console.error(`[verifyAudit] Record full verify error: ${err}`);
    // Non-fatal
  }
}
