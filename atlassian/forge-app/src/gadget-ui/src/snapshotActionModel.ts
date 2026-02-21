/**
 * Snapshot Variant Action Model — Pure Functions (v7.41.x)
 *
 * Single source of truth for button rendering across all snapshot variants.
 * Zero browser dependencies — fully testable in Node.js environment.
 *
 * Exported from main.ts for backward compatibility.
 */

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Canonical snapshot kind. All UI branch logic uses this enum exclusively.
 */
export type SnapshotKind = 'latest' | 'seed' | 'governance' | 'unknown';

/**
 * Input for computeActionModel.
 */
export interface ActionModelInput {
  /** Dashboard status from backend: 'AVAILABLE' | 'NO_SNAPSHOT' | 'HARD_ERROR' | etc. */
  status: string;
  /** Selected snapshot variant (raw string from backend/selector) */
  selectedVariant: any;
  /** Whether the review is sealed */
  sealed: boolean;
  /** Whether export is eligible (backend truth) */
  exportEligible: boolean;
  /** Whether a canonical hash exists for export */
  hasCanonicalHash: boolean;
  /** Whether build coherence check passed */
  buildCoherenceOk: boolean;
}

/**
 * Output of computeActionModel — drives ALL button states in the action bar.
 */
export interface ActionModelOutput {
  /** Whether "Run Access Review" button is enabled */
  runEnabled: boolean;
  /** Whether "Seal Review" button is enabled */
  sealEnabled: boolean;
  /** Whether "Export Evidence Pack" button is visible at all */
  exportVisible: boolean;
  /** Whether "Export Evidence Pack" button is enabled (only meaningful if visible) */
  exportEnabled: boolean;
  /** Optional customer-facing message explaining disabled state */
  customerMessage?: string;
  /** Machine-readable reason codes for each decision */
  reasons: string[];
}

// ── Pure Functions ──────────────────────────────────────────────────────────

/**
 * Normalizes any backend/UI variant string to a canonical SnapshotKind.
 * Pure, deterministic, no side-effects.
 *
 * Rules:
 * - null / undefined / non-string → 'unknown'
 * - case-insensitive match: 'latest', 'seed', 'governance'
 * - empty string → 'unknown'
 * - unrecognized string → 'unknown'
 */
export function normalizeSnapshotKind(s: any): SnapshotKind {
  if (s == null || typeof s !== 'string') return 'unknown';
  const lower = s.trim().toLowerCase();
  if (lower === 'latest') return 'latest';
  if (lower === 'seed') return 'seed';
  if (lower === 'governance') return 'governance';
  return 'unknown';
}

/**
 * Pure function: computes the single action model that drives ALL button
 * states. No DOM access, no side-effects, fully testable.
 *
 * Rules (deterministic, in precedence order):
 * 1. If buildCoherenceOk === false → all buttons disabled, message = "Update in progress."
 * 2. If status !== 'AVAILABLE' → run disabled, seal disabled, export hidden
 * 3. If sealed === true → run disabled (immutable), seal disabled, export visible+enabled
 * 4. If variant is 'seed' → export hidden (seeds are not exportable)
 * 5. If !exportEligible → export hidden
 * 6. If !hasCanonicalHash → export visible but disabled (hash pending)
 * 7. Default: all enabled
 */
export function computeActionModel(input: ActionModelInput): ActionModelOutput {
  const kind = normalizeSnapshotKind(input.selectedVariant);
  const reasons: string[] = [];

  // Rule 1: Build coherence failure → everything off
  if (!input.buildCoherenceOk) {
    reasons.push('BUILD_INCOHERENT');
    return {
      runEnabled: false,
      sealEnabled: false,
      exportVisible: true,
      exportEnabled: false,
      customerMessage: 'Update in progress. Please refresh this page.',
      reasons,
    };
  }

  // Rule 2: Dashboard not available → nothing actionable
  if (input.status !== 'AVAILABLE') {
    reasons.push('NOT_AVAILABLE');
    return {
      runEnabled: false,
      sealEnabled: false,
      exportVisible: false,
      exportEnabled: false,
      customerMessage: 'Snapshot data is not yet available.',
      reasons,
    };
  }

  // Defaults for AVAILABLE state
  let runEnabled = true;
  let sealEnabled = true;
  let exportVisible = true;
  let exportEnabled = true;
  let customerMessage: string | undefined;

  // Rule 3: Sealed → immutable, no run, no seal, export still allowed
  if (input.sealed) {
    runEnabled = false;
    sealEnabled = false;
    reasons.push('SEALED');
  }

  // Rule 4: Seed variant → export hidden
  if (kind === 'seed') {
    exportVisible = false;
    exportEnabled = false;
    reasons.push('SEED_NO_EXPORT');
  }

  // Rule 5: Not export eligible → export hidden
  if (!input.exportEligible && exportVisible) {
    exportVisible = false;
    exportEnabled = false;
    reasons.push('NOT_EXPORT_ELIGIBLE');
  }

  // Rule 6: No canonical hash → export visible but disabled
  if (!input.hasCanonicalHash && exportVisible) {
    exportEnabled = false;
    reasons.push('MISSING_HASH');
    customerMessage = 'Export is not yet available. Please run an access review first.';
  }

  return {
    runEnabled,
    sealEnabled,
    exportVisible,
    exportEnabled,
    customerMessage,
    reasons,
  };
}
