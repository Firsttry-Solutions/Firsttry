/**
 * Snapshot Variant Action Model — Pure Functions (v7.47)
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
 *     - [FT_PROOF_UI_EFFECTIVE_KIND] with effectiveKind + backendExportGateReasonCode
 *     - [FT_PROOF_UI_SNAPSHOT_REVERTED] when seed selection fails
 *     - [FT_PROOF_UI_EXPORT_GATE_EVALUATED] with eligibility vs readiness separation
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

// ── Export Eligibility (v7.46 — backend truth gate) ─────────────────────────

/**
 * Result of export eligibility computation.
 * Eligibility = "does the backend say this snapshot MAY be exported?"
 * Readiness = "are all artifacts present?" (separate concern, never hides button).
 */
export interface ExportEligibilityResult {
  /** Whether the snapshot is eligible for export (backend truth) */
  eligibilityOk: boolean;
  /** Machine-readable reason code */
  reasonCode: string;
  /** Where the decision came from: 'backend' (authoritative) or 'fallback' (local heuristics) */
  source: 'backend' | 'fallback';
  /** Raw backend exportGateReasonCodeNormalized if present */
  backendReasonCode?: string;
}

/**
 * Pure function: determines export ELIGIBILITY from the raw backend envelope.
 * 
 * CRITICAL: This function receives the RAW resolver envelope (not the mapped
 * dashState) so it can read `envelope.data.exportGateReasonCodeNormalized`
 * which the L0 mapper currently strips.
 *
 * Rules (v7.46):
 * 1. If envelope?.data?.exportGateReasonCodeNormalized exists → use it (backend truth)
 *    - 'OK' → eligibilityOk=true
 *    - Any other value → eligibilityOk=false
 * 2. If field missing but exportEligible===true + GOVERNANCE kind → fallback OK
 * 3. Otherwise → MISSING_BACKEND_EXPORT_GATE (not eligible)
 *
 * This function has ZERO browser deps — fully testable in Node.js.
 */
export function computeExportEligibilityFromBackend(envelope: any): ExportEligibilityResult {
  // Guard: no envelope at all
  if (!envelope || typeof envelope !== 'object') {
    return {
      eligibilityOk: false,
      reasonCode: 'NO_ENVELOPE',
      source: 'fallback',
    };
  }

  const data = envelope?.data ?? envelope;

  // PRIMARY PATH: backend provided an authoritative reason code
  const backendCode: string | undefined = data?.exportGateReasonCodeNormalized;
  if (typeof backendCode === 'string' && backendCode.length > 0) {
    const codeUpper = backendCode.toUpperCase().trim();
    return {
      eligibilityOk: codeUpper === 'OK',
      reasonCode: codeUpper,
      source: 'backend',
      backendReasonCode: backendCode,
    };
  }

  // FALLBACK PATH: backend did not provide exportGateReasonCodeNormalized
  // Check local signals: exportEligible + snapshotKind
  const exportEligible =
    data?.exportEligibleNormalized === true ||
    data?.exportEligible === true ||
    (data?.snapshots?.[0]?.exportEligible === true);

  const snapshotKindRaw: string | undefined =
    data?.snapshotKindNormalized || data?.snapshotKind;
  const isGovernance =
    typeof snapshotKindRaw === 'string' &&
    snapshotKindRaw.toUpperCase().trim() === 'GOVERNANCE';

  if (exportEligible && isGovernance) {
    return {
      eligibilityOk: true,
      reasonCode: 'FALLBACK_OK',
      source: 'fallback',
    };
  }

  // No backend code, no local eligibility signal → not eligible
  return {
    eligibilityOk: false,
    reasonCode: 'MISSING_BACKEND_EXPORT_GATE',
    source: 'fallback',
  };
}

// ── Snapshot ID Resolution (v7.47) ──────────────────────────────────────────

/**
 * Pure function: resolves the snapshotId to use for export from the raw
 * resolver envelope and the currently selected variant.
 *
 * Rules:
 * - If selectedVariant === "seed" → return null (seeds are never exportable)
 * - Else, priority order:
 *   1) envelope?.data?.snapshotIdNormalized
 *   2) envelope?.data?.snapshotId
 *   3) envelope?.data?.snapshots?.[0]?.snapshotId
 * - If still missing → return null
 *
 * Zero browser deps — fully testable in Node.js.
 */
export function resolveSelectedSnapshotId(
  envelope: any,
  selectedVariant: 'latest' | 'seed' | string,
): string | null {
  // Seeds are never exportable
  if (selectedVariant === 'seed') return null;

  if (!envelope || typeof envelope !== 'object') return null;

  const data = envelope?.data ?? envelope;

  // Priority 1: snapshotIdNormalized
  if (typeof data?.snapshotIdNormalized === 'string' && data.snapshotIdNormalized.trim()) {
    return data.snapshotIdNormalized.trim();
  }

  // Priority 2: snapshotId
  if (typeof data?.snapshotId === 'string' && data.snapshotId.trim()) {
    return data.snapshotId.trim();
  }

  // Priority 3: first snapshot in array
  const snap0Id = data?.snapshots?.[0]?.snapshotId;
  if (typeof snap0Id === 'string' && snap0Id.trim()) {
    return snap0Id.trim();
  }

  return null;
}
