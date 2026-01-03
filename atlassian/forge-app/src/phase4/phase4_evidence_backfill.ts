/**
 * PHASE-4 EVIDENCE BACKFILL (FAIL-CLOSED PRESERVED)
 * 
 * Detects and safely backfills missing Phase-4 evidence (installation timestamp)
 * for tenants that installed before Phase-4 was introduced.
 * 
 * Guarantees:
 * - Idempotent: safe to call multiple times
 * - Tenant-scoped: uses cloudId as partition key
 * - Evidence-only: no Jira writes, no config mutations
 * - Fail-closed: missing tenant identity still fails closed
 * - Audited: single log line when backfill occurs
 */

import { storage } from '@forge/api';

/**
 * Result of backfill attempt
 */
export interface Phase4BackfillResult {
  didBackfill: boolean;
  reason: string; // e.g., "missing_phase4_evidence_on_upgrade", "phase4_exists"
  timestamp?: string; // ISO 8601 if backfilled
  error?: string; // if failed with details
}

/**
 * Phase-4 Evidence schema (as expected by Phase-5 scheduler)
 */
interface Phase4Evidence {
  installed_at: string; // ISO 8601 timestamp
  backfilled?: boolean; // true if created by this backfill logic
  backfilled_at?: string; // ISO 8601 when backfilled
  backfill_reason?: string; // e.g., "missing_phase4_evidence_on_upgrade"
}

/**
 * Ensure Phase-4 evidence exists for a tenant.
 * 
 * If evidence missing:
 * - Create it with installed_at = now (first-known-at)
 * - Mark as backfilled with reason and timestamp
 * - Log exactly once
 * - Return didBackfill=true
 * 
 * If evidence exists and valid:
 * - Return didBackfill=false (no-op)
 * 
 * If tenant identity missing or evidence invalid:
 * - Throw error to preserve fail-closed semantics
 * 
 * @param cloudId Tenant cloud ID (required)
 * @returns BackfillResult with status
 * @throws Error if validation fails (to preserve fail-closed)
 */
export async function ensurePhase4EvidenceOrFailClosed(
  cloudId: string | undefined
): Promise<Phase4BackfillResult> {
  // ========================================================================
  // VALIDATE TENANT IDENTITY (FAIL CLOSED)
  // ========================================================================

  if (!cloudId || typeof cloudId !== 'string' || cloudId.trim() === '') {
    throw new Error(
      `[PHASE4_BACKFILL] FAIL_CLOSED: cloudId must be a non-empty string, got: ${typeof cloudId}`
    );
  }

  const storageKey = `phase4:evidence:installation:${cloudId}`;

  try {
    // ====================================================================
    // 1. READ EXISTING EVIDENCE
    // ====================================================================

    const existing = await storage.get(storageKey);

    if (existing && existing.installed_at) {
      // Evidence exists and has required field
      const timestamp = existing.installed_at as string;

      // Validate it's a valid ISO 8601 timestamp
      const parsed = new Date(timestamp);
      if (isNaN(parsed.getTime())) {
        throw new Error(
          `[PHASE4_BACKFILL] FAIL_CLOSED: Invalid timestamp in existing Phase-4 evidence for ${cloudId}: ${timestamp}`
        );
      }

      // Exists and valid: no-op
      return {
        didBackfill: false,
        reason: 'phase4_exists',
      };
    }

    // ====================================================================
    // 2. EVIDENCE MISSING: BACKFILL DETERMINISTICALLY
    // ====================================================================

    const now = new Date().toISOString(); // First-known-at
    const evidence: Phase4Evidence = {
      installed_at: now,
      backfilled: true,
      backfilled_at: now,
      backfill_reason: 'missing_phase4_evidence_on_upgrade',
    };

    // Write atomically
    await storage.set(storageKey, evidence);

    // ====================================================================
    // 3. VERIFY WRITE SUCCEEDED
    // ====================================================================

    const written = await storage.get(storageKey);

    if (!written || !written.installed_at) {
      throw new Error(
        `[PHASE4_BACKFILL] FAIL_CLOSED: Write verification failed for ${cloudId}; evidence still missing after write`
      );
    }

    // Validate what we wrote
    const verifyParsed = new Date(written.installed_at as string);
    if (isNaN(verifyParsed.getTime())) {
      throw new Error(
        `[PHASE4_BACKFILL] FAIL_CLOSED: Write verification failed for ${cloudId}; timestamp invalid after write`
      );
    }

    // ====================================================================
    // 4. LOG BACKFILL (EXACTLY ONCE, STRUCTURED)
    // ====================================================================

    console.log(
      `[PHASE4_BACKFILL] cloudId=${cloudId} didBackfill=true reason=missing_phase4_evidence_on_upgrade timestamp=${now}`
    );

    return {
      didBackfill: true,
      reason: 'missing_phase4_evidence_on_upgrade',
      timestamp: now,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // If already a fail-closed error, re-throw as-is
    if (errorMsg.includes('[PHASE4_BACKFILL] FAIL_CLOSED')) {
      throw error;
    }

    // Wrap storage errors as fail-closed
    throw new Error(
      `[PHASE4_BACKFILL] FAIL_CLOSED: Unexpected error for ${cloudId}: ${errorMsg}`
    );
  }
}
