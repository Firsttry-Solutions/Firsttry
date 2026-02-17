/**
 * Certification Pre-Check Gate (Hard Block)
 * 
 * FT_PROOF_CERT_PRECHECK_v1
 * 
 * Before allowing certification, verify:
 * 1. Ledger passes full verification
 * 2. No restore suspicion detected
 * 3. Drift SLA is computable from snapshot blocks
 * 
 * FAIL-CLOSED: No overrides. Block on any check failure.
 */

import { detectPossibleRestore } from "./restoreHeuristic";
import { getVerifyAudit } from "./verifyAudit";

export interface CertPrecheckResult {
  allowed: boolean;
  blockedReason: string | null;
}

/**
 * Run certification pre-check
 * 
 * FAIL-CLOSED: Returns false + reason if ANY check fails
 */
export async function runCertificationPrecheck(
  tenantKey: string,
  snapshot?: any
): Promise<CertPrecheckResult> {
  // Check 1: Verify audit status must be OK_VERIFIED
  const audit = await getVerifyAudit(tenantKey);

  if (audit.lastWindowStatus !== "OK_VERIFIED") {
    return {
      allowed: false,
      blockedReason: `Certification blocked: Ledger verification status is '${audit.lastWindowStatus}', not 'OK_VERIFIED'. Full re-verification required before certification.`,
    };
  }

  // Check 2: Detect possible restore/reset
  const restore = await detectPossibleRestore(tenantKey);

  if (restore.suspected) {
    return {
      allowed: false,
      blockedReason: `Certification blocked: Possible restore/reset operation detected. ${restore.reason}`,
    };
  }

  // Check 3: Verify drift SLA is computable
  if (snapshot) {
    if (
      !Number.isFinite(snapshot.totalChanges) &&
      !Number.isFinite(snapshot.unresolvedDrifts)
    ) {
      return {
        allowed: false,
        blockedReason: `Certification blocked: Unable to compute drift SLA from snapshot blocks. Missing metrics data.`,
      };
    }
  }

  // All checks passed
  return {
    allowed: true,
    blockedReason: null,
  };
}
