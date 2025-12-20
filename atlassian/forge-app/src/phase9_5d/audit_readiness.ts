/**
 * Phase 9.5-D: Audit Readiness Delta
 *
 * Provides procurement-grade proof of audit defensibility over time.
 *
 * CORE PRINCIPLE: No scores. No grades. No interpretation.
 * Only facts: audit_ready_since and audit_coverage_duration.
 *
 * Data sources:
 * - Phase 9.5-A: Counterfactual Proof Ledger (earliest_governance_evidence_at)
 * - Phase 9.5-B: Historical Blind-Spot Map (shows evidence gaps)
 * - Phase 9.5-C: Snapshot Reliability SLA (snapshot execution history)
 * - Tenant install date (when FirstTry was first enabled)
 */

import crypto from 'crypto';

/**
 * Reason why audit coverage starts at a particular date.
 * Used to explain to procurement why we have (or don't have) evidence.
 */
export type AuditReadinessReason =
  | 'first_install' // FirstTry installation date
  | 'first_snapshot' // First successful snapshot run
  | 'first_evidence' // First governance evidence from counterfactual ledger
  | 'no_evidence'; // No evidence exists at all

/**
 * Represents the audit readiness state for a tenant.
 * Single source of truth for "how long have we had governance evidence?"
 */
export interface AuditReadinessMap {
  // Immutable identity
  tenant_id: string;
  computed_at: string; // ISO 8601 UTC
  schema_version: string; // "1.0"

  // Core measurements (facts only)
  audit_ready_since: string | null; // ISO 8601 UTC, earliest evidence date
  audit_ready_reason: AuditReadinessReason; // Why we can defend from this date
  audit_coverage_duration_days: number; // now - audit_ready_since
  audit_coverage_percentage: number; // coverage_days / max(1, days_since_install) * 100

  // Supporting context
  first_install_date: string; // When FirstTry was installed
  first_snapshot_at: string | null; // When first snapshot succeeded
  first_governance_evidence_at: string | null; // From Phase 9.5-A ledger
  current_date: string; // ISO 8601 UTC (for reproducibility)

  // Completeness disclosure
  completeness_percentage: number; // How complete is this calculation? (0-100)
  missing_inputs: string[]; // What data was unavailable

  // Integrity
  canonical_hash: string; // SHA-256

  // Metadata
  tenant_region: string; // For audit reports
}

/**
 * Input data for computing audit readiness.
 * Aggregates evidence from multiple phases.
 */
export interface AuditReadinessInput {
  tenant_id: string;
  first_install_date: string; // ISO 8601 UTC
  first_snapshot_at: string | null; // From Phase 9.5-C
  first_governance_evidence_at: string | null; // From Phase 9.5-A
  current_date?: string; // Defaults to now (overridable for testing)
  tenant_region?: string; // "us-east-1" etc
  missing_inputs?: string[]; // []
}

/**
 * Compute audit readiness for a tenant.
 *
 * RULE 1: audit_ready_since = earliest non-null date of:
 *   1. first_install_date (always present)
 *   2. first_snapshot_at (if snapshots have run)
 *   3. first_governance_evidence_at (if evidence ledger has entries)
 *
 * RULE 2: For procurement, the defensible date is the EARLIEST evidence.
 * Why? Because if we have evidence on day 30, we can only defend "20 days of
 * governance" (from day 30 to day 50), not "50 days".
 *
 * RULE 3: audit_coverage_duration = max(0, now - audit_ready_since)
 * If audit_ready_since is in the future or null, coverage is 0 days.
 *
 * RULE 4: audit_coverage_percentage = coverage_days / max(1, days_since_install) * 100
 * This shows "what % of our lifecycle have we had evidence for?"
 * Capped at 100% (can't have evidence before install).
 */
export function computeAuditReadiness(input: AuditReadinessInput): AuditReadinessMap {
  const computedAt = new Date().toISOString();
  const currentDate = input.current_date || computedAt;
  const currentTime = new Date(currentDate);

  // Parse input dates
  const installTime = new Date(input.first_install_date);
  const snapshotTime = input.first_snapshot_at ? new Date(input.first_snapshot_at) : null;
  const evidenceTime = input.first_governance_evidence_at
    ? new Date(input.first_governance_evidence_at)
    : null;

  // Collect all available evidence dates
  const evidenceDates = [installTime];
  if (snapshotTime) evidenceDates.push(snapshotTime);
  if (evidenceTime) evidenceDates.push(evidenceTime);

  // RULE 1: Find earliest evidence
  const earliestEvidence = evidenceDates.reduce((earliest, current) => {
    return current < earliest ? current : earliest;
  });

  // RULE 2: Determine reason for audit readiness
  let auditReadyReason: AuditReadinessReason = 'no_evidence';
  let auditReadySince: string | null = null;

  if (earliestEvidence === installTime) {
    auditReadyReason = 'first_install';
    auditReadySince = installTime.toISOString();
  } else if (snapshotTime && earliestEvidence === snapshotTime) {
    auditReadyReason = 'first_snapshot';
    auditReadySince = snapshotTime.toISOString();
  } else if (evidenceTime && earliestEvidence === evidenceTime) {
    auditReadyReason = 'first_evidence';
    auditReadySince = evidenceTime.toISOString();
  }

  // RULE 3 & 4: Calculate coverage duration and percentage
  let coverageDurationDays = 0;
  let coveragePercentage = 0;

  if (auditReadySince && auditReadySince !== null) {
    const auditReadyTime = new Date(auditReadySince);
    const timeDiff = currentTime.getTime() - auditReadyTime.getTime();
    coverageDurationDays = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    coverageDurationDays = Math.max(0, coverageDurationDays); // Never negative

    // Calculate percentage: coverage / total_lifetime
    const installDiff = currentTime.getTime() - installTime.getTime();
    const installLifetimeDays = Math.floor(installDiff / (1000 * 60 * 60 * 24));
    const denominatorDays = Math.max(1, installLifetimeDays);

    coveragePercentage = Math.round((coverageDurationDays / denominatorDays) * 100);
    coveragePercentage = Math.min(100, coveragePercentage); // Never > 100%
  }

  // Compute completeness (simulated: assume all data is available unless listed)
  const completenessPercentage =
    100 - (input.missing_inputs && input.missing_inputs.length > 0 ? 20 * input.missing_inputs.length : 0);

  const map: AuditReadinessMap = {
    tenant_id: input.tenant_id,
    computed_at: computedAt,
    schema_version: '1.0',
    audit_ready_since: auditReadySince,
    audit_ready_reason: auditReadyReason,
    audit_coverage_duration_days: coverageDurationDays,
    audit_coverage_percentage: coveragePercentage,
    first_install_date: input.first_install_date,
    first_snapshot_at: input.first_snapshot_at || null,
    first_governance_evidence_at: input.first_governance_evidence_at || null,
    current_date: currentDate,
    completeness_percentage: Math.max(0, completenessPercentage),
    missing_inputs: input.missing_inputs || [],
    canonical_hash: '', // Placeholder, set below
    tenant_region: input.tenant_region || 'unknown',
  };

  // Compute hash (set in map)
  map.canonical_hash = computeAuditReadinessHash(map);

  return map;
}

/**
 * Compute canonical SHA-256 hash of audit readiness data.
 * Used to verify data integrity in storage.
 *
 * Must be deterministic: same input → same hash always.
 */
export function computeAuditReadinessHash(map: Omit<AuditReadinessMap, 'canonical_hash'>): string {
  // Build canonical string with sorted keys for determinism
  const sortedKeys = [
    'audit_coverage_duration_days',
    'audit_coverage_percentage',
    'audit_ready_reason',
    'audit_ready_since',
    'completeness_percentage',
    'current_date',
    'first_governance_evidence_at',
    'first_install_date',
    'first_snapshot_at',
    'missing_inputs',
    'schema_version',
    'tenant_id',
    'tenant_region',
  ];

  let canonical = '';
  for (const key of sortedKeys) {
    const value = (map as Record<string, unknown>)[key];
    if (value === null || value === undefined) {
      canonical += `${key}:null;`;
    } else if (Array.isArray(value)) {
      const sorted = [...value].sort();
      canonical += `${key}:[${sorted.join(',')}];`;
    } else if (typeof value === 'number') {
      canonical += `${key}:${value};`;
    } else if (typeof value === 'boolean') {
      canonical += `${key}:${value ? 'true' : 'false'};`;
    } else {
      canonical += `${key}:${String(value)};`;
    }
  }

  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify audit readiness data integrity.
 * Returns true if hash matches, false if data has been modified.
 */
export function verifyAuditReadinessHash(map: AuditReadinessMap): boolean {
  const { canonical_hash, ...mapWithoutHash } = map;
  const computedHash = computeAuditReadinessHash(mapWithoutHash as Omit<AuditReadinessMap, 'canonical_hash'>);
  return computedHash === canonical_hash;
}

/**
 * Render audit readiness as simple HTML.
 * Suitable for audit reports and procurement documentation.
 *
 * RULE: Text only. No scores. No grades. Just facts.
 */
export function renderAuditReadinessHtml(map: AuditReadinessMap): string {
  const readyDate = map.audit_ready_since
    ? new Date(map.audit_ready_since).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Never';

  const daysText =
    map.audit_coverage_duration_days === 1
      ? '1 day'
      : `${map.audit_coverage_duration_days} days`;

  const reasonText = {
    first_install: 'FirstTry installation date',
    first_snapshot: 'First successful snapshot run',
    first_evidence: 'First governance evidence recorded',
    no_evidence: 'No governance evidence available',
  }[map.audit_ready_reason];

  return `
<div class="audit-readiness-card">
  <h3>Audit Readiness</h3>
  <p class="audit-statement">
    An audit conducted today would have <strong>${daysText}</strong> of verifiable governance evidence.
  </p>
  <div class="audit-details">
    <div class="detail-row">
      <span class="label">Ready Since:</span>
      <span class="value">${readyDate}</span>
    </div>
    <div class="detail-row">
      <span class="label">Evidence Start Reason:</span>
      <span class="value">${reasonText}</span>
    </div>
    <div class="detail-row">
      <span class="label">Coverage of Lifecycle:</span>
      <span class="value">${map.audit_coverage_percentage}%</span>
    </div>
    <div class="detail-row">
      <span class="label">Installed:</span>
      <span class="value">${new Date(map.first_install_date).toLocaleDateString('en-US')}</span>
    </div>
    ${map.first_snapshot_at
      ? `
    <div class="detail-row">
      <span class="label">First Snapshot:</span>
      <span class="value">${new Date(map.first_snapshot_at).toLocaleDateString('en-US')}</span>
    </div>
    `
      : ''}
    ${map.first_governance_evidence_at
      ? `
    <div class="detail-row">
      <span class="label">First Evidence:</span>
      <span class="value">${new Date(map.first_governance_evidence_at).toLocaleDateString('en-US')}</span>
    </div>
    `
      : ''}
    ${map.missing_inputs && map.missing_inputs.length > 0
      ? `
    <div class="detail-row">
      <span class="label">Missing Data:</span>
      <span class="value">${map.missing_inputs.join(', ')}</span>
    </div>
    `
      : ''}
  </div>
  <p class="completeness-note">
    Completeness: ${map.completeness_percentage}%
    ${map.missing_inputs && map.missing_inputs.length > 0
      ? `(missing: ${map.missing_inputs.join(', ')})`
      : '(all data available)'}
  </p>
</div>
  `.trim();
}

/**
 * Render audit readiness data as procurement-grade text for reports.
 */
export function renderAuditReadinessText(map: AuditReadinessMap): string {
  const readyDate = map.audit_ready_since
    ? new Date(map.audit_ready_since).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      })
    : 'No evidence';

  const daysText =
    map.audit_coverage_duration_days === 1
      ? '1 day'
      : `${map.audit_coverage_duration_days} days`;

  const reasonText = {
    first_install: 'from FirstTry installation',
    first_snapshot: 'from first successful snapshot',
    first_evidence: 'from first recorded governance evidence',
    no_evidence: 'no governance evidence available',
  }[map.audit_ready_reason];

  return (
    `An audit conducted on ${new Date(map.current_date).toLocaleDateString('en-US', { timeZone: 'UTC' })} ` +
    `would have ${daysText} of verifiable governance evidence, ` +
    `${reasonText} (${readyDate}). ` +
    `This represents ${map.audit_coverage_percentage}% of FirstTry's lifecycle (since install on ` +
    `${new Date(map.first_install_date).toLocaleDateString('en-US', { timeZone: 'UTC' })}).`
  );
}

/**
 * Export audit readiness as JSON for audit packets and procurement.
 */
export function exportAuditReadinessJson(map: AuditReadinessMap): Record<string, unknown> {
  return {
    // Core fact
    audit_ready_since: map.audit_ready_since,
    audit_coverage_duration_days: map.audit_coverage_duration_days,

    // Supporting context
    audit_ready_reason: map.audit_ready_reason,
    audit_coverage_percentage: map.audit_coverage_percentage,
    first_install_date: map.first_install_date,
    first_snapshot_at: map.first_snapshot_at,
    first_governance_evidence_at: map.first_governance_evidence_at,
    current_date: map.current_date,

    // Completeness disclosure
    completeness_percentage: map.completeness_percentage,
    missing_inputs: map.missing_inputs,

    // Integrity
    canonical_hash: map.canonical_hash,

    // Metadata
    tenant_id: map.tenant_id,
    computed_at: map.computed_at,
    schema_version: map.schema_version,
  };
}

/**
 * Generate markdown audit report for procurement/audit teams.
 */
export function generateAuditReadinessReport(map: AuditReadinessMap): string {
  const daysText =
    map.audit_coverage_duration_days === 1
      ? '1 day'
      : `${map.audit_coverage_duration_days} days`;

  const reasonText = {
    first_install: 'FirstTry installation date',
    first_snapshot: 'First successful snapshot run',
    first_evidence: 'First governance evidence recorded',
    no_evidence: 'No governance evidence available',
  }[map.audit_ready_reason];

  return `# Audit Readiness Report

## Summary

**An audit conducted today would have ${daysText} of verifiable governance evidence.**

## Core Measurements

| Metric | Value |
|--------|-------|
| **Audit Ready Since** | ${map.audit_ready_since ? new Date(map.audit_ready_since).toISOString() : 'Never'} |
| **Coverage Duration** | ${map.audit_coverage_duration_days} days |
| **Coverage % of Lifecycle** | ${map.audit_coverage_percentage}% |
| **FirstTry Install Date** | ${map.first_install_date} |
| **First Snapshot** | ${map.first_snapshot_at || 'N/A'} |
| **First Evidence** | ${map.first_governance_evidence_at || 'N/A'} |

## Evidence Start Reason

**${reasonText}**

- This is the earliest date from which we have governance evidence
- Procurement can defend audit readiness starting from this date
- Earlier dates have implicit governance (no evidence to the contrary)

## Data Completeness

- **Overall Completeness:** ${map.completeness_percentage}%
- **Missing Inputs:** ${map.missing_inputs && map.missing_inputs.length > 0 ? map.missing_inputs.join(', ') : 'None'}

## Integrity

- **Canonical Hash:** \`${map.canonical_hash}\`
- **Verification:** Use this hash to verify data integrity in storage

## Report Metadata

- **Computed At:** ${map.computed_at}
- **Schema Version:** ${map.schema_version}
- **Tenant ID:** ${map.tenant_id}
- **Tenant Region:** ${map.tenant_region}

---

This report is generated automatically. No manual interpretation applied.
`;
}
