/**
 * Snapshot Variant Action Model — Pure Functions (v7.42.x)
 *
 * Single source of truth for button rendering across all snapshot variants.
 * Zero browser dependencies — fully testable in Node.js environment.
 *
 * Exported from main.ts for backward compatibility.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * REQUIRED UX RULES (verbatim from fix pack spec — NO AMBIGUITY)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * R1) On initial dashboard load (no dropdown interaction), compute action model
 *     for the default selection (Latest).
 *
 * R2) Run Access Review button:
 *     - visible=true when dashboardStatus === "AVAILABLE"
 *     - enabled=true unless buildCoherence.ok === false
 *
 * R3) Export Evidence Pack button:
 *     - visible=true ONLY when snapshotKindNormalized === "governance"
 *       AND exportAllowed === true
 *     - visible=false otherwise (NO ghost disabled button)
 *
 * R4) Seal Review button:
 *     - visible=true ONLY when snapshotKindNormalized === "governance"
 *     - enabled=false while seal state is loading (show "Loading review state...")
 *
 * R5) Selecting Seed must NOT disable Run Access Review
 *     (unless dashboardStatus not AVAILABLE).
 *
 * R6) Remove the customer-facing footer text about tab navigation being
 *     temporarily unavailable (the banned nav-warning copy).
 *     It must not exist in source OR dist.
 *
 * R7) Proof markers must exist:
 *     - On mount after action model computed: emit [FT_PROOF_UI_ACTION_MODEL_INITIAL]
 *     - On every dropdown selection: emit [FT_PROOF_UI_SNAPSHOT_SELECTED]
 *     - On every action model recompute: emit [FT_PROOF_UI_ACTION_MODEL] with
 *       {snapshotKindNormalized, exportVisible, exportEnabled, runVisible,
 *        runEnabled, sealVisible, sealEnabled}
 *     - All clicks still emit [FT_PROOF_UI_CLICK] and [FT_PROOF_UI_CLICK_RESULT]
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
  /** Whether "Run Access Review" button is visible */
  runVisible: boolean;
  /** Whether "Run Access Review" button is enabled */
  runEnabled: boolean;
  /** Whether "Seal Review" button is visible */
  sealVisible: boolean;
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
 * Precedence:
 * 1. buildCoherenceOk === false → all disabled, run visible if AVAILABLE
 * 2. status !== 'AVAILABLE' → nothing visible/actionable
 * 3. Run Access Review: visible when AVAILABLE, enabled unless build-incoherent (R2, R5)
 * 4. Export Evidence Pack: visible ONLY for governance + exportEligible (R3)
 * 5. Seal Review: visible ONLY for governance (R4)
 * 6. Sealed → run disabled, seal disabled, export still allowed
 * 7. Missing hash → export visible but disabled
 */
export function computeActionModel(input: ActionModelInput): ActionModelOutput {
  const kind = normalizeSnapshotKind(input.selectedVariant);
  const reasons: string[] = [];

  // Rule 2: Dashboard not available → nothing visible
  if (input.status !== 'AVAILABLE') {
    reasons.push('NOT_AVAILABLE');
    return {
      runVisible: false,
      runEnabled: false,
      sealVisible: false,
      sealEnabled: false,
      exportVisible: false,
      exportEnabled: false,
      customerMessage: 'Snapshot data is not yet available.',
      reasons,
    };
  }

  // Rule 1: Build coherence failure → visible but disabled
  if (!input.buildCoherenceOk) {
    reasons.push('BUILD_INCOHERENT');
    return {
      runVisible: true,
      runEnabled: false,
      sealVisible: kind === 'governance',
      sealEnabled: false,
      exportVisible: kind === 'governance' && input.exportEligible,
      exportEnabled: false,
      customerMessage: 'Update in progress. Please refresh this page.',
      reasons,
    };
  }

  // ── AVAILABLE + coherent ──────────────────────────────────────────────

  // R2 + R5: Run Access Review visible + enabled for ANY kind when AVAILABLE
  let runVisible = true;
  let runEnabled = true;

  // R4: Seal visible ONLY for governance
  let sealVisible = kind === 'governance';
  let sealEnabled = kind === 'governance';

  // R3: Export visible ONLY for governance AND exportEligible
  let exportVisible = kind === 'governance' && input.exportEligible;
  let exportEnabled = exportVisible;
  let customerMessage: string | undefined;

  // Sealed → immutable, no run, no seal, export still allowed
  if (input.sealed) {
    runEnabled = false;
    sealEnabled = false;
    reasons.push('SEALED');
  }

  // Seed → export hidden, seal hidden (already set above), run stays enabled (R5)
  if (kind === 'seed') {
    reasons.push('SEED_NO_EXPORT');
  }

  // Not export eligible → already handled by exportVisible derivation above
  if (!input.exportEligible && kind === 'governance') {
    reasons.push('NOT_EXPORT_ELIGIBLE');
  }

  // Missing hash → export visible but disabled
  if (exportVisible && !input.hasCanonicalHash) {
    exportEnabled = false;
    reasons.push('MISSING_HASH');
    customerMessage = 'Export is not yet available. Please run an access review first.';
  }

  return {
    runVisible,
    runEnabled,
    sealVisible,
    sealEnabled,
    exportVisible,
    exportEnabled,
    customerMessage,
    reasons,
  };
}
