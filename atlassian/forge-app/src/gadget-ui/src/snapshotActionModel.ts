/**
 * Snapshot Variant Action Model — Pure Functions (v7.45)
 *
 * Single source of truth for button rendering across all snapshot variants.
 * Zero browser dependencies — fully testable in Node.js environment.
 *
 * Exported from main.ts for backward compatibility.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * REQUIRED UX RULES (v7.45 — uses effectiveKind from backend, NOT variant string)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * R1) On initial dashboard load (no dropdown interaction), compute action model
 *     using effectiveKind derived from backend (snapshotKindNormalized/snapshotId).
 *     effectiveKind is GOVERNANCE or SEED — never "latest" (latest is a selector label).
 *
 * R2) Run Access Review button:
 *     - visible=true when dashboardStatus === "AVAILABLE"
 *     - enabled=true unless buildCoherence.ok === false
 *
 * R3) Export Evidence Pack button:
 *     - visible=true ONLY when effectiveKind === "GOVERNANCE" AND exportGateOk === true
 *     - visible=false otherwise (NO ghost disabled button)
 *
 * R4) Seal Review button:
 *     - visible=true ONLY when effectiveKind === "GOVERNANCE"
 *     - enabled=false while seal state is loading
 *
 * R5) Selecting Seed must NOT disable Run Access Review
 *     (unless dashboardStatus not AVAILABLE).
 *
 * R6) Remove the customer-facing footer text about tab navigation being
 *     temporarily unavailable (the banned nav-warning copy).
 *
 * R7) Proof markers must exist:
 *     - [FT_PROOF_UI_ACTION_MODEL_INITIAL] on mount
 *     - [FT_PROOF_UI_EFFECTIVE_KIND] with effectiveKind + exportGateReasonCode
 *     - [FT_PROOF_UI_SNAPSHOT_REVERTED] when seed selection fails
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Canonical snapshot kind. All UI branch logic uses this enum exclusively.
 */
export type SnapshotKind = 'latest' | 'seed' | 'governance' | 'unknown';

/**
 * Effective kind — what the backend actually resolved, not the dropdown label.
 * GOVERNANCE = real governance snapshot. SEED = seed snapshot. UNKNOWN = can't determine.
 */
export type EffectiveKind = 'GOVERNANCE' | 'SEED' | 'UNKNOWN';

/**
 * Input for computeActionModel (v7.45).
 * Now uses effectiveKind (from backend) and exportGateOk (from export gate).
 */
export interface ActionModelInput {
  /** Dashboard status from backend: 'AVAILABLE' | 'NO_SNAPSHOT' | 'HARD_ERROR' | etc. */
  status: string;
  /** Selected snapshot variant (raw string from selector, kept for logging) */
  selectedVariant: any;
  /** Effective snapshot kind resolved from backend — GOVERNANCE, SEED, or UNKNOWN */
  effectiveKind: EffectiveKind;
  /** Whether the export gate says OK (from exportGateReasonCodeNormalized or fallback) */
  exportGateOk: boolean;
  /** Export gate reason code for diagnostics */
  exportGateReasonCode?: string;
  /** Whether the review is sealed */
  sealed: boolean;
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
 * v7.45: uses effectiveKind (GOVERNANCE/SEED/UNKNOWN) from backend,
 * NOT the variant string ("latest"/"seed"). This is the root cause fix.
 *
 * Precedence:
 * 1. buildCoherenceOk === false → all disabled, run visible if AVAILABLE
 * 2. status !== 'AVAILABLE' → nothing visible/actionable
 * 3. Run Access Review: visible when AVAILABLE, enabled unless build-incoherent (R2, R5)
 * 4. Export Evidence Pack: visible ONLY for GOVERNANCE + exportGateOk (R3)
 * 5. Seal Review: visible ONLY for GOVERNANCE (R4)
 * 6. Sealed → run disabled, seal disabled, export still allowed
 */
export function computeActionModel(input: ActionModelInput): ActionModelOutput {
  const ek = input.effectiveKind;
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
      sealVisible: ek === 'GOVERNANCE',
      sealEnabled: false,
      exportVisible: ek === 'GOVERNANCE' && input.exportGateOk,
      exportEnabled: false,
      customerMessage: 'Update in progress. Please refresh this page.',
      reasons,
    };
  }

  // ── AVAILABLE + coherent ──────────────────────────────────────────────

  // R2 + R5: Run Access Review visible + enabled for ANY kind when AVAILABLE
  let runVisible = true;
  let runEnabled = true;

  // R4: Seal visible ONLY for GOVERNANCE
  let sealVisible = ek === 'GOVERNANCE';
  let sealEnabled = ek === 'GOVERNANCE';

  // R3: Export visible ONLY for GOVERNANCE AND exportGateOk
  let exportVisible = ek === 'GOVERNANCE' && input.exportGateOk;
  let exportEnabled = exportVisible;
  let customerMessage: string | undefined;

  // Sealed → immutable, no run, no seal, export still allowed
  if (input.sealed) {
    runEnabled = false;
    sealEnabled = false;
    reasons.push('SEALED');
  }

  // Seed → export hidden, seal hidden (already set above), run stays enabled (R5)
  if (ek === 'SEED') {
    reasons.push('SEED_NO_EXPORT');
  }

  // Not exportGateOk → already handled by exportVisible derivation above
  if (!input.exportGateOk && ek === 'GOVERNANCE') {
    reasons.push('EXPORT_GATE_' + (input.exportGateReasonCode || 'NOT_OK'));
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
