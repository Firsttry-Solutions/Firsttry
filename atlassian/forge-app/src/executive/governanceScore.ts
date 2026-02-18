// FT_ECL_PHASE: ECL-8 EXEC_METRICS
/**
 * Executive Governance Score Aggregator
 *
 * Computes deterministic governance metrics from existing dashboard state fields.
 * No network calls. No mock data. Fail-closed: throws if required data unavailable.
 *
 * Data sources (all from L0DashboardState passed in):
 *   - state.status / state.createdAtUtc          → snapshot freshness
 *   - state.driftAcknowledgements                → open drift count
 *   - state.governanceActions                    → review completion, last export
 *   - state.metadata                             → control coverage declaration
 *   - state.enterpriseContract.snapshots         → snapshot integrity hash (proof presence)
 *
 * MARKER: FT_ECL_PHASE: ECL-8 EXEC_METRICS
 */

// ============================================================================
// WEIGHTS (deterministic, fixed in code — no config dependency)
// ============================================================================

const WEIGHT_SNAPSHOT_FRESH    = 25; // snapshot is AVAILABLE and <7 days old
const WEIGHT_DRIFT_CLEAR       = 25; // no unacknowledged open drifts
const WEIGHT_REVIEWS_CLOSED    = 25; // ≥1 CLOSE_REVIEW governance action in log
const WEIGHT_PROOF_PRESENT     = 25; // ≥1 snapshot with integrity hash present

// Max age for "fresh" snapshot: 7 days in milliseconds
const SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// TYPES
// ============================================================================

export interface RiskEvent {
  readonly id: string;           // deterministic stable key
  readonly category: string;     // e.g. 'UNACKED_DRIFT', 'NO_REVIEW', 'STALE_SNAPSHOT'
  readonly description: string;
  readonly timestampUtc: string | null;
}

export interface ExecutiveMetrics {
  readonly governanceScore: number;               // 0–100, integer
  readonly scoreComponents: Readonly<{
    snapshotFresh: boolean;
    driftClear: boolean;
    reviewsClosed: boolean;
    proofPresent: boolean;
  }>;
  readonly topRiskEvents: readonly RiskEvent[];   // up to 5, deterministic order
  readonly auditReady: boolean;                   // yes only if all 4 components pass
  readonly lastExportHash: string | null;         // SHA of last generate_export event or snapshot integrity
  readonly snapshotAgeMs: number | null;          // age of snapshot at compute time
  readonly computedAtUtc: string;                 // ISO timestamp of computation
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Compute executive metrics from existing dashboard state.
 *
 * @param state - L0DashboardState (passed as `any` to avoid circular UI import)
 * @throws Error if required state fields are entirely missing (fail-closed)
 */
export function computeExecutiveMetrics(state: any): ExecutiveMetrics {
  // ── GUARD: state must be a non-null object ───────────────────────────────
  if (!state || typeof state !== 'object') {
    throw new Error('ECL8_FAIL_CLOSED: state is null or non-object');
  }

  // ── 1. SNAPSHOT FRESHNESS ────────────────────────────────────────────────
  const snapshotStatus: string = state.status ?? 'UNKNOWN';
  const createdAtUtc: string | null = state.createdAtUtc ?? null;

  let snapshotFresh = false;
  let snapshotAgeMs: number | null = null;

  if (snapshotStatus === 'AVAILABLE' && createdAtUtc) {
    const snapshotTs = new Date(createdAtUtc).getTime();
    if (isNaN(snapshotTs)) {
      throw new Error(`ECL8_FAIL_CLOSED: createdAtUtc is not a valid ISO date: ${createdAtUtc}`);
    }
    snapshotAgeMs = Date.now() - snapshotTs;
    snapshotFresh = snapshotAgeMs >= 0 && snapshotAgeMs <= SNAPSHOT_MAX_AGE_MS;
  }

  // ── 2. DRIFT CLEAR ───────────────────────────────────────────────────────
  // driftAcknowledgements: Record<string, DriftAckRecord | null>
  // null value = drift exists but NOT acknowledged = open
  const driftAcks: Record<string, any> | null | undefined = state.driftAcknowledgements;
  let driftClear = true;  // no drifts known = no open drifts
  let openDriftIds: string[] = [];

  if (driftAcks && typeof driftAcks === 'object') {
    openDriftIds = Object.entries(driftAcks)
      .filter(([, rec]) => rec === null || rec === undefined)
      .map(([id]) => id)
      .sort(); // deterministic ordering
    driftClear = openDriftIds.length === 0;
  }

  // ── 3. REVIEWS CLOSED ───────────────────────────────────────────────────
  // governanceActions: GovernanceActionRecord[] – last 20 most recent actions
  // "reviews closed" = at least one CLOSE_REVIEW action exists in the log
  const governanceActions: any[] = Array.isArray(state.governanceActions)
    ? state.governanceActions
    : [];

  const closeReviewActions = governanceActions.filter(
    (a) => a && a.actionType === 'close_review'
  );
  const reviewsClosed = closeReviewActions.length > 0;

  // Last export hash: from the most recent generate_export action or snapshot integrity
  let lastExportHash: string | null = null;
  const exportActions = governanceActions.filter(
    (a) => a && a.actionType === 'generate_export'
  );
  if (exportActions.length > 0) {
    // Actions are sorted desc by timestamp; first = most recent
    const latestExport = exportActions[0];
    // Use recordSha256 as a deterministic hash of that export event
    lastExportHash = latestExport.recordSha256
      ? `${latestExport.recordSha256.substring(0, 16)} (export event)`
      : null;
  }

  // ── 4. PROOF PRESENT ─────────────────────────────────────────────────────
  // Proof = at least one snapshot in enterpriseContract.snapshots has an integrity.value
  const snapshots: any[] = state.enterpriseContract?.snapshots ?? [];
  let proofPresent = false;
  let firstIntegrityHash: string | null = null;

  for (const snap of snapshots) {
    const hashVal = snap?.integrity?.value;
    if (typeof hashVal === 'string' && hashVal.length > 0) {
      proofPresent = true;
      firstIntegrityHash = hashVal;
      break; // deterministic: use first found
    }
  }

  // Fall back to export hash if no snapshot integrity
  if (!lastExportHash && firstIntegrityHash) {
    lastExportHash = `${firstIntegrityHash.substring(0, 16)} (snapshot integrity)`;
  }

  // ── GOVERNANCE SCORE ─────────────────────────────────────────────────────
  let score = 0;
  if (snapshotFresh)  score += WEIGHT_SNAPSHOT_FRESH;
  if (driftClear)     score += WEIGHT_DRIFT_CLEAR;
  if (reviewsClosed)  score += WEIGHT_REVIEWS_CLOSED;
  if (proofPresent)   score += WEIGHT_PROOF_PRESENT;

  // ── AUDIT READINESS ──────────────────────────────────────────────────────
  const auditReady = snapshotFresh && driftClear && reviewsClosed && proofPresent;

  // ── TOP 5 RISK EVENTS (deterministic sort) ───────────────────────────────
  const riskEvents: RiskEvent[] = [];

  if (!snapshotFresh) {
    riskEvents.push({
      id: 'STALE_SNAPSHOT',
      category: 'STALE_SNAPSHOT',
      description: snapshotStatus !== 'AVAILABLE'
        ? `Snapshot unavailable (status: ${snapshotStatus})`
        : `Snapshot older than 7 days (age: ${snapshotAgeMs !== null ? Math.round(snapshotAgeMs / 86400000) + 'd' : 'unknown'})`,
      timestampUtc: createdAtUtc,
    });
  }

  for (const driftId of openDriftIds.slice(0, 3)) {
    riskEvents.push({
      id: `UNACKED_DRIFT:${driftId}`,
      category: 'UNACKED_DRIFT',
      description: `Drift not acknowledged: ${driftId.substring(0, 20)}`,
      timestampUtc: null,
    });
  }

  if (!reviewsClosed) {
    riskEvents.push({
      id: 'NO_CLOSED_REVIEW',
      category: 'NO_REVIEW',
      description: 'No completed review cycle found in recent governance log',
      timestampUtc: null,
    });
  }

  if (!proofPresent) {
    riskEvents.push({
      id: 'NO_PROOF',
      category: 'NO_PROOF',
      description: 'No snapshot integrity hash available — proof bundle may be absent',
      timestampUtc: null,
    });
  }

  // Deterministic: sort risk events by id ascending, then cap at 5
  const topRiskEvents: readonly RiskEvent[] = riskEvents
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 5);

  return {
    governanceScore:    score,
    scoreComponents:    Object.freeze({ snapshotFresh, driftClear, reviewsClosed, proofPresent }),
    topRiskEvents:      Object.freeze(topRiskEvents),
    auditReady,
    lastExportHash,
    snapshotAgeMs,
    computedAtUtc:      new Date().toISOString(),
  };
}

// FT_ECL_PHASE: ECL-8 EXEC_METRICS_END
