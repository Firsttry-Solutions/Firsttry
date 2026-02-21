/**
 * Shared Export Eligibility Gate
 *
 * Single source of truth for export eligibility determination.
 * Used by:
 *   - Dashboard envelope (gadget-resolver) for exportEligibleNormalized / exportGateReasonCodeNormalized
 *   - Export handler (gadget-resolver export path) for pre-handler gating
 *   - Export resolver (ft_exportAccessPack_v1) as additional fail-closed check
 *
 * Pure function — no side effects, no storage reads, no throws.
 *
 * v7.50: Created as single source of truth for export gating.
 */

// ============================================================================
// Types
// ============================================================================

export interface ExportEligibilityResult {
  exportEligible: boolean;
  reasonCode: string;     // 'OK' | 'SNAPSHOT_NOT_FOUND' | 'SEED_NOT_EXPORTABLE' | 'EXPORT_PHASE1_STATS_MISSING' | 'MISSING_CANONICAL_HASH'
  message: string;
  hasTotals: boolean;
  totalUsers: number | null;
}

// ============================================================================
// Gate function
// ============================================================================

/**
 * computeExportEligibilityGate(snapshot)
 *
 * Determines whether the given snapshot record is eligible for Phase1 export.
 *
 * Rules (evaluated in order):
 * 1. snapshot must exist
 * 2. snapshotKind must be 'GOVERNANCE' (not SEED, not UNKNOWN)
 * 3. snapshot.totals must exist as an object AND snapshot.totals.totalUsers must be a number
 * 4. snapshot must have canonicalHash
 * 5. All checks pass → exportEligible=true, reasonCode='OK'
 */
export function computeExportEligibilityGate(snapshot: any): ExportEligibilityResult {
  // Rule 1: Snapshot must exist
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      exportEligible: false,
      reasonCode: 'SNAPSHOT_NOT_FOUND',
      message: 'No snapshot found in storage. Run "Access Review (Phase 1)" first.',
      hasTotals: false,
      totalUsers: null,
    };
  }

  // Rule 2: Must be GOVERNANCE (not SEED)
  const snapshotKind = snapshot.snapshotKind || 'UNKNOWN';
  if (snapshotKind === 'SEED') {
    return {
      exportEligible: false,
      reasonCode: 'SEED_NOT_EXPORTABLE',
      message: 'Seed snapshots cannot be exported. Run "Access Review (Phase 1)" to create a governance snapshot.',
      hasTotals: false,
      totalUsers: null,
    };
  }

  if (snapshotKind !== 'GOVERNANCE') {
    return {
      exportEligible: false,
      reasonCode: 'SEED_NOT_EXPORTABLE',
      message: `Unsupported snapshot kind "${snapshotKind}". Only GOVERNANCE snapshots can be exported.`,
      hasTotals: false,
      totalUsers: null,
    };
  }

  // Rule 3: Phase1 totals must be present with numeric totalUsers
  const hasTotals = !!(snapshot.totals && typeof snapshot.totals === 'object');
  const totalUsers = typeof snapshot.totals?.totalUsers === 'number' ? snapshot.totals.totalUsers : null;

  if (!hasTotals || totalUsers === null) {
    return {
      exportEligible: false,
      reasonCode: 'EXPORT_PHASE1_STATS_MISSING',
      message: 'Export requires Phase1 stats (totals.totalUsers) but none were found in snapshot record.',
      hasTotals,
      totalUsers,
    };
  }

  // Rule 4: Must have canonical hash
  if (!snapshot.canonicalHash) {
    return {
      exportEligible: false,
      reasonCode: 'MISSING_CANONICAL_HASH',
      message: 'Snapshot missing canonical hash. Cannot generate deterministic export.',
      hasTotals: true,
      totalUsers,
    };
  }

  // All rules pass
  return {
    exportEligible: true,
    reasonCode: 'OK',
    message: 'Export eligible',
    hasTotals: true,
    totalUsers,
  };
}
