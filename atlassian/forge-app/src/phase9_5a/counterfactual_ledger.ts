/**
 * PHASE 9.5-A: COUNTERFACTUAL PROOF LEDGER
 *
 * Derived, append-only ledger proving irreversible value by showing what knowledge
 * exists ONLY because FirstTry was installed.
 *
 * Core invariant: This ledger is derived from Phase-6/7/8 data, never manually edited.
 * Updates only when new "first-time" events occur (first snapshot, first drift, etc).
 *
 * Immutable historical entries. Tenant-isolated. Deterministically hashed.
 */

import crypto from 'crypto';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Pre-install gap summary: What governance knowledge was missing before FirstTry.
 */
export interface PreInstallGap {
  exists: boolean;
  description: string; // Static text only
  missing_permission_gaps: string[]; // Summarized from Phase-6 missing_data
  earliest_known_gap_date?: string; // ISO 8601 UTC or NOT_AVAILABLE
}

/**
 * Core counterfactual proof ledger entry.
 * Derived only. Never manually edited. Immutable once created.
 */
export interface CounterfactualProof {
  tenant_id: string;
  first_install_detected_at: string; // ISO 8601 UTC
  first_snapshot_at: string; // ISO 8601 UTC (when governance evidence began)
  first_drift_detected_at: string | 'NOT_AVAILABLE'; // When first change detected
  first_metrics_available_at: string | 'NOT_AVAILABLE'; // When M1-M5 first computed
  earliest_governance_evidence_at: string; // min(first_snapshot_at, others) - proof start
  pre_install_gap: PreInstallGap;
  canonical_hash: string; // SHA-256 of canonical JSON
  schema_version: '1.0';
}

/**
 * Result of ledger creation or update.
 */
export interface LedgerResult {
  success: boolean;
  ledger?: CounterfactualProof;
  reason?: string; // If not success
  changed: boolean; // If derived from prior state, did it change?
  timestamp: string; // When this result was computed
}

/**
 * Governance continuity status for UI display.
 */
export interface GovernanceContinuity {
  governance_evidence_from: string; // earliest_governance_evidence_at
  governance_evidence_to: string; // ISO 8601 UTC current
  no_memory_before: string; // earliest_governance_evidence_at (UI: "No governance memory exists before this date")
  uninstall_impact: string; // Static: "Uninstalling FirstTry will create a new blind spot"
  ledger_hash_verified: boolean;
  pre_install_gap_exists: boolean;
}

// ============================================================================
// CANONICALIZATION & HASHING
// ============================================================================

/**
 * Canonicalize CounterfactualProof to deterministic JSON for hashing.
 * Rules:
 * - Keys sorted alphabetically
 * - No whitespace (compact)
 * - Timestamps already ISO 8601 UTC
 * - Exclude canonical_hash from hash input (like procurement packet)
 */
export function canonicalizeCounterfactualProof(
  proof: CounterfactualProof
): string {
  // Create object without canonical_hash
  const hashInput: any = {
    earliest_governance_evidence_at: proof.earliest_governance_evidence_at,
    first_drift_detected_at: proof.first_drift_detected_at,
    first_install_detected_at: proof.first_install_detected_at,
    first_metrics_available_at: proof.first_metrics_available_at,
    first_snapshot_at: proof.first_snapshot_at,
    pre_install_gap: {
      description: proof.pre_install_gap.description,
      earliest_known_gap_date:
        proof.pre_install_gap.earliest_known_gap_date || 'NOT_AVAILABLE',
      exists: proof.pre_install_gap.exists,
      missing_permission_gaps: proof.pre_install_gap.missing_permission_gaps.sort(),
    },
    schema_version: proof.schema_version,
    tenant_id: proof.tenant_id,
  };

  // Compact JSON (no whitespace)
  return JSON.stringify(hashInput, Object.keys(hashInput).sort());
}

/**
 * Compute SHA-256 hash of canonical JSON.
 */
export function computeCounterfactualHash(proof: CounterfactualProof): string {
  const canonical = canonicalizeCounterfactualProof(proof);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify counterfactual ledger integrity.
 * Recompute hash and compare to stored hash.
 */
export function verifyCounterfactualHash(proof: CounterfactualProof): boolean {
  const recomputed = computeCounterfactualHash(proof);
  return recomputed === proof.canonical_hash;
}

// ============================================================================
// LEDGER CREATION & UPDATES
// ============================================================================

/**
 * Create counterfactual proof ledger from initial state.
 * Called when FirstTry is first installed or first snapshot is detected.
 *
 * Inputs come from Phase-6/7/8 data, never from user configuration.
 */
export function createCounterfactualProof(input: {
  tenant_id: string;
  install_detected_at: string; // ISO 8601 UTC
  first_snapshot_at: string; // ISO 8601 UTC
  first_drift_detected_at?: string; // ISO 8601 UTC or undefined
  first_metrics_available_at?: string; // ISO 8601 UTC or undefined
  missing_permission_gaps?: string[]; // From Phase-6 missing_data
}): CounterfactualProof {
  // Ensure all timestamps are ISO 8601 UTC
  const installDate = new Date(input.install_detected_at);
  const snapshotDate = new Date(input.first_snapshot_at);

  const earliest_governance_evidence_at = snapshotDate < installDate ? snapshotDate.toISOString() : snapshotDate.toISOString();

  const proof: CounterfactualProof = {
    tenant_id: input.tenant_id,
    first_install_detected_at: input.install_detected_at,
    first_snapshot_at: input.first_snapshot_at,
    first_drift_detected_at: input.first_drift_detected_at || 'NOT_AVAILABLE',
    first_metrics_available_at: input.first_metrics_available_at || 'NOT_AVAILABLE',
    earliest_governance_evidence_at,
    pre_install_gap: {
      exists: (input.missing_permission_gaps || []).length > 0,
      description:
        'Governance knowledge exists only from the date of first snapshot forward. No memory of prior configuration, automation execution, or field usage exists in FirstTry.',
      missing_permission_gaps: input.missing_permission_gaps || [],
      earliest_known_gap_date: input.missing_permission_gaps?.length
        ? earliest_governance_evidence_at
        : undefined,
    },
    canonical_hash: '', // Placeholder, computed below
    schema_version: '1.0',
  };

  // Compute hash with placeholder first
  proof.canonical_hash = computeCounterfactualHash(proof);

  return proof;
}

/**
 * Update counterfactual proof with new first-time events.
 * Derived-only: only updates when new "firsts" are discovered.
 * Returns {changed: false} if no new firsts exist.
 */
export function updateCounterfactualProof(
  current: CounterfactualProof,
  updates: {
    first_drift_detected_at?: string;
    first_metrics_available_at?: string;
    missing_permission_gaps?: string[];
  }
): CounterfactualProof {
  let changed = false;
  const updated = { ...current };

  // Only update if we have new first-drift AND it's earlier than current
  if (
    updates.first_drift_detected_at &&
    (current.first_drift_detected_at === 'NOT_AVAILABLE' ||
      new Date(updates.first_drift_detected_at) <
        new Date(current.first_drift_detected_at as string))
  ) {
    updated.first_drift_detected_at = updates.first_drift_detected_at;
    changed = true;
  }

  // Only update if we have new first-metrics AND it's earlier than current
  if (
    updates.first_metrics_available_at &&
    (current.first_metrics_available_at === 'NOT_AVAILABLE' ||
      new Date(updates.first_metrics_available_at) <
        new Date(current.first_metrics_available_at as string))
  ) {
    updated.first_metrics_available_at = updates.first_metrics_available_at;
    changed = true;
  }

  // Update missing permissions if provided
  if (updates.missing_permission_gaps) {
    const sortedGaps = updates.missing_permission_gaps.sort();
    if (
      JSON.stringify(sortedGaps) !==
      JSON.stringify(updated.pre_install_gap.missing_permission_gaps)
    ) {
      updated.pre_install_gap.missing_permission_gaps = sortedGaps;
      updated.pre_install_gap.exists = sortedGaps.length > 0;
      changed = true;
    }
  }

  // If anything changed, recompute hash
  if (changed) {
    updated.canonical_hash = computeCounterfactualHash(updated);
  }

  return updated;
}

// ============================================================================
// ENFORCEMENT: DERIVED-ONLY, NEVER MANUAL
// ============================================================================

/**
 * Assert that ledger was not manually modified.
 * (In practice: ensure updates come only from Phase-6/7/8 event detection,
 * never from direct API calls without event context.)
 */
export function assertDerivedOnly(
  proof: CounterfactualProof,
  derivedFromEvents: {
    snapshot_detected: boolean;
    drift_detected: boolean;
    metrics_computed: boolean;
  }
): void {
  // If ledger exists, it must have been derived from at least one event
  const hasEvents =
    derivedFromEvents.snapshot_detected ||
    derivedFromEvents.drift_detected ||
    derivedFromEvents.metrics_computed;

  if (!hasEvents && proof) {
    throw new Error(
      'LEDGER_NOT_DERIVED: CounterfactualProof exists but no deriving events detected. ' +
        'Ledger must be created/updated only when Phase-6/7/8 events occur.'
    );
  }
}

/**
 * Assert tenant isolation.
 * Verify that a ledger belongs to the expected tenant.
 */
export function assertTenantIsolation(
  proof: CounterfactualProof,
  expected_tenant_id: string
): void {
  if (proof.tenant_id !== expected_tenant_id) {
    throw new Error(
      `TENANT_ISOLATION_VIOLATION: Ledger tenant_id "${proof.tenant_id}" ` +
        `does not match expected "${expected_tenant_id}"`
    );
  }
}

/**
 * Assert ledger immutability.
 * Once created, only first-time events can trigger updates.
 * No backfill, no corrections, no manual edits.
 */
export function assertImmutable(
  prior: CounterfactualProof | null,
  current: CounterfactualProof
): void {
  if (!prior) return; // No prior state, any current is valid

  // Check that install_detected_at never changes
  if (prior.first_install_detected_at !== current.first_install_detected_at) {
    throw new Error(
      'IMMUTABILITY_VIOLATION: first_install_detected_at must never change'
    );
  }

  // Check that first_snapshot_at never changes
  if (prior.first_snapshot_at !== current.first_snapshot_at) {
    throw new Error(
      'IMMUTABILITY_VIOLATION: first_snapshot_at must never change'
    );
  }

  // Check that earlier first-time events are never updated to later dates
  if (
    prior.first_drift_detected_at !== 'NOT_AVAILABLE' &&
    current.first_drift_detected_at !== 'NOT_AVAILABLE'
  ) {
    if (new Date(current.first_drift_detected_at) > new Date(prior.first_drift_detected_at)) {
      throw new Error(
        'IMMUTABILITY_VIOLATION: first_drift_detected_at moved to later date'
      );
    }
  }

  if (
    prior.first_metrics_available_at !== 'NOT_AVAILABLE' &&
    current.first_metrics_available_at !== 'NOT_AVAILABLE'
  ) {
    if (new Date(current.first_metrics_available_at) > new Date(prior.first_metrics_available_at)) {
      throw new Error(
        'IMMUTABILITY_VIOLATION: first_metrics_available_at moved to later date'
      );
    }
  }
}

// ============================================================================
// UI HELPERS
// ============================================================================

/**
 * Generate governance continuity status for admin UI display.
 */
export function getGovernanceContinuity(
  proof: CounterfactualProof,
  current_timestamp: string = new Date().toISOString()
): GovernanceContinuity {
  return {
    governance_evidence_from: proof.earliest_governance_evidence_at,
    governance_evidence_to: current_timestamp,
    no_memory_before: proof.earliest_governance_evidence_at,
    uninstall_impact:
      'Uninstalling FirstTry will create a new blind spot. Future governance evidence will restart from the date of reinstallation.',
    ledger_hash_verified: verifyCounterfactualHash(proof),
    pre_install_gap_exists: proof.pre_install_gap.exists,
  };
}

/**
 * Generate HTML section for "Governance Continuity" admin UI.
 * Static, factual language only.
 */
export function renderGovernanceContinuitySection(
  proof: CounterfactualProof,
  current_timestamp: string = new Date().toISOString()
): string {
  const continuity = getGovernanceContinuity(proof, current_timestamp);
  const preInstallHTML = proof.pre_install_gap.exists
    ? `<p><strong>Pre-install Gap:</strong> ${escapeHtml(
        proof.pre_install_gap.description
      )}</p>`
    : '';

  return `
    <section class="governance-continuity">
      <h2>Governance Continuity</h2>
      <p><strong>Governance evidence exists from:</strong> <code>${escapeHtml(
        continuity.governance_evidence_from
      )}</code></p>
      <p><strong>to:</strong> <code>${escapeHtml(
        continuity.governance_evidence_to
      )}</code></p>
      <p><strong>No governance memory exists before:</strong> <code>${escapeHtml(
        continuity.no_memory_before
      )}</code></p>
      <p>${escapeHtml(continuity.uninstall_impact)}</p>
      ${preInstallHTML}
      <p><small>Ledger hash verified: ${continuity.ledger_hash_verified ? '✓' : '✗'}</small></p>
    </section>
  `;
}

/**
 * HTML escape helper.
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ============================================================================
// EXPORTS FOR AUDIT / PROCUREMENT
// ============================================================================

/**
 * Export counterfactual proof as JSON.
 */
export function exportCounterfactualProofJson(
  proof: CounterfactualProof
): string {
  return JSON.stringify(proof, null, 2);
}

/**
 * Generate human-readable report for audit/procurement.
 */
export function generateCounterfactualReport(
  proof: CounterfactualProof
): string {
  const lines = [
    '# COUNTERFACTUAL PROOF LEDGER',
    '',
    `**Tenant ID:** ${escapeHtml(proof.tenant_id)}`,
    `**Schema Version:** ${proof.schema_version}`,
    `**Canonical Hash:** ${proof.canonical_hash}`,
    '',
    '## Governance Evidence Timeline',
    `- **FirstTry Installed:** ${proof.first_install_detected_at}`,
    `- **First Snapshot (Governance Began):** ${proof.first_snapshot_at}`,
    `- **First Drift Detected:** ${proof.first_drift_detected_at}`,
    `- **First Metrics Available:** ${proof.first_metrics_available_at}`,
    `- **Earliest Evidence Date:** ${proof.earliest_governance_evidence_at}`,
    '',
    '## Pre-Install Gap',
    `- **Exists:** ${proof.pre_install_gap.exists ? 'Yes' : 'No'}`,
    `- **Description:** ${proof.pre_install_gap.description}`,
    `- **Missing Permission Gaps:** ${proof.pre_install_gap.missing_permission_gaps.length > 0 ? proof.pre_install_gap.missing_permission_gaps.join(', ') : 'None'}`,
    '',
    '## Key Facts',
    '- All dates are immutable historical records.',
    '- This ledger is derived from Phase-6/7/8 data, never manually edited.',
    '- Uninstalling FirstTry will create a new governance blind spot.',
    `- No governance memory exists before ${proof.earliest_governance_evidence_at}.`,
  ];

  return lines.join('\n');
}
