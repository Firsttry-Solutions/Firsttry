/**
 * Drift Risk Engine — ECL Enterprise Hardening
 *
 * Computes drift severity by comparing the latest snapshot against the stored baseline.
 * No heuristics. No silent severity downgrade. Fail-closed on missing baseline.
 *
 * Input: difference between latest snapshot and baseline snapshot.
 *
 * Severity classification (strict):
 * - CRITICAL: role changes, admin group changes
 * - HIGH:     permission widening (any new grant not present in baseline)
 * - MEDIUM:   permission narrowing, workflow changes, app install changes
 * - LOW:      non-structural changes (display names, descriptions, etc.)
 * - NONE:     no differences detected
 *
 * Rules:
 * - Missing baseline → THROW
 * - Diff engine compares canonical structures (via canonicalStringify)
 * - No heuristic inference
 * - No silent downgrade of severity
 *
 * // FT_ECL_ENGINE: DRIFT_RISK_V1
 */

// FT_ECL_ENGINE: DRIFT_RISK_V1

import { canonicalStringify } from '../utils/canonicalJson';
import { SnapshotPayload, validateSnapshotPayload } from '../governance/snapshotSchema';
import { requireBaseline, BaselineRecord } from '../governance/baselineVersion';
import { readChain } from '../governance/hashChain';
import * as crypto from 'crypto';

/** Severity levels — ordered from highest to lowest */
export type DriftSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

/** A single drift finding */
export interface DriftFinding {
  readonly severity: DriftSeverity;
  readonly category: DriftCategory;
  readonly description: string;
  readonly field: string;
}

/** Drift categories */
export type DriftCategory =
  | 'ROLE_CHANGE'
  | 'ADMIN_GROUP_CHANGE'
  | 'PERMISSION_WIDENING'
  | 'PERMISSION_NARROWING'
  | 'WORKFLOW_CHANGE'
  | 'APP_INSTALL_CHANGE'
  | 'USER_CHANGE';

/** Result from the drift engine */
export interface DriftResult {
  readonly severity: DriftSeverity;         // Highest severity of all findings
  readonly findings: ReadonlyArray<DriftFinding>;
  readonly baselineVersion: number;
  readonly baselineSnapshotHash: string;
  readonly currentSnapshotHash: string;
  readonly analysedUtc: string;             // ISO 8601 timestamp
  readonly hasCritical: boolean;
  readonly hasHigh: boolean;
  readonly hasMedium: boolean;
}

/**
 * Compute SHA-256 of canonical JSON representation (for snapshot comparison).
 */
function sha256Hex(obj: unknown): string {
  const canonical = canonicalStringify(obj);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Determine the highest severity from a list of findings.
 */
function maxSeverity(findings: DriftFinding[]): DriftSeverity {
  if (findings.some((f) => f.severity === 'CRITICAL')) return 'CRITICAL';
  if (findings.some((f) => f.severity === 'HIGH')) return 'HIGH';
  if (findings.some((f) => f.severity === 'MEDIUM')) return 'MEDIUM';
  if (findings.some((f) => f.severity === 'LOW')) return 'LOW';
  return 'NONE';
}

/**
 * Compare two arrays using canonicalStringify for deterministic equality.
 */
function canonicalEqual(a: unknown, b: unknown): boolean {
  return canonicalStringify(a) === canonicalStringify(b);
}

/**
 * Diff roles between baseline and current snapshot.
 * CRITICAL: any role change (addition, removal, admin flag change)
 */
function diffRoles(
  baselineRoles: SnapshotPayload['roles'],
  currentRoles: SnapshotPayload['roles']
): DriftFinding[] {
  const findings: DriftFinding[] = [];

  const baselineById = new Map(baselineRoles.map((r) => [r.id, r]));
  const currentById = new Map(currentRoles.map((r) => [r.id, r]));

  // New roles added
  for (const [id, role] of currentById.entries()) {
    if (!baselineById.has(id)) {
      findings.push({
        severity: 'CRITICAL',
        category: 'ROLE_CHANGE',
        description: `Role "${role.name}" (id: ${id}) added since baseline`,
        field: `roles[${id}]`,
      });
    }
  }

  // Roles removed
  for (const [id, role] of baselineById.entries()) {
    if (!currentById.has(id)) {
      findings.push({
        severity: 'CRITICAL',
        category: 'ROLE_CHANGE',
        description: `Role "${role.name}" (id: ${id}) removed since baseline`,
        field: `roles[${id}]`,
      });
    }
  }

  // Modified roles — specifically admin flag changes → CRITICAL
  for (const [id, current] of currentById.entries()) {
    const baseline = baselineById.get(id);
    if (!baseline) continue; // already caught above
    if (current.admin !== baseline.admin) {
      findings.push({
        severity: 'CRITICAL',
        category: 'ADMIN_GROUP_CHANGE',
        description: `Role "${current.name}" admin flag changed: ${baseline.admin} → ${current.admin}`,
        field: `roles[${id}].admin`,
      });
    }
    // Other role changes (name, description) → MEDIUM
    if (current.name !== baseline.name || current.description !== baseline.description) {
      findings.push({
        severity: 'MEDIUM',
        category: 'ROLE_CHANGE',
        description: `Role "${id}" metadata changed (name or description)`,
        field: `roles[${id}]`,
      });
    }
  }

  return findings;
}

/**
 * Diff permissions between baseline and current snapshot.
 * HIGH: permission widening (new grant not in baseline)
 * MEDIUM: permission narrowing (grant removed)
 */
function diffPermissions(
  baselinePerms: SnapshotPayload['permissions'],
  currentPerms: SnapshotPayload['permissions']
): DriftFinding[] {
  const findings: DriftFinding[] = [];

  const baselineMap = new Map(baselinePerms.map((p) => [p.schemeId, p]));
  const currentMap = new Map(currentPerms.map((p) => [p.schemeId, p]));

  // New permission schemes
  for (const [id, scheme] of currentMap.entries()) {
    if (!baselineMap.has(id)) {
      findings.push({
        severity: 'HIGH',
        category: 'PERMISSION_WIDENING',
        description: `Permission scheme "${scheme.schemeName}" (id: ${id}) added — new access grants possible`,
        field: `permissions[${id}]`,
      });
    }
  }

  // Removed permission schemes
  for (const [id, scheme] of baselineMap.entries()) {
    if (!currentMap.has(id)) {
      findings.push({
        severity: 'MEDIUM',
        category: 'PERMISSION_NARROWING',
        description: `Permission scheme "${scheme.schemeName}" (id: ${id}) removed`,
        field: `permissions[${id}]`,
      });
    }
  }

  // Within existing schemes: compare grants
  for (const [id, current] of currentMap.entries()) {
    const baseline = baselineMap.get(id);
    if (!baseline) continue;

    const baselineGrantSet = new Set(
      baseline.grants.map((g) => canonicalStringify(g))
    );
    const currentGrantSet = new Set(
      current.grants.map((g) => canonicalStringify(g))
    );

    // New grants (widening)
    for (const grantStr of currentGrantSet) {
      if (!baselineGrantSet.has(grantStr)) {
        findings.push({
          severity: 'HIGH',
          category: 'PERMISSION_WIDENING',
          description: `New permission grant added in scheme "${current.schemeName}": ${grantStr}`,
          field: `permissions[${id}].grants`,
        });
      }
    }

    // Removed grants (narrowing)
    for (const grantStr of baselineGrantSet) {
      if (!currentGrantSet.has(grantStr)) {
        findings.push({
          severity: 'MEDIUM',
          category: 'PERMISSION_NARROWING',
          description: `Permission grant removed from scheme "${current.schemeName}": ${grantStr}`,
          field: `permissions[${id}].grants`,
        });
      }
    }
  }

  return findings;
}

/**
 * Diff workflows between baseline and current snapshot.
 * MEDIUM: any workflow change
 */
function diffWorkflows(
  baselineWf: SnapshotPayload['workflows'],
  currentWf: SnapshotPayload['workflows']
): DriftFinding[] {
  const findings: DriftFinding[] = [];

  if (!canonicalEqual(baselineWf, currentWf)) {
    findings.push({
      severity: 'MEDIUM',
      category: 'WORKFLOW_CHANGE',
      description: 'Workflow configuration changed since baseline',
      field: 'workflows',
    });
  }

  return findings;
}

/**
 * Diff app installs between baseline and current snapshot.
 * MEDIUM: any change in app installs
 */
function diffAppInstalls(
  baselineApps: SnapshotPayload['appInstalls'],
  currentApps: SnapshotPayload['appInstalls']
): DriftFinding[] {
  const findings: DriftFinding[] = [];

  if (!canonicalEqual(baselineApps, currentApps)) {
    findings.push({
      severity: 'MEDIUM',
      category: 'APP_INSTALL_CHANGE',
      description: 'App install configuration changed since baseline',
      field: 'appInstalls',
    });
  }

  return findings;
}

/**
 * Run the drift risk engine.
 *
 * Computes diff between current snapshot and baseline snapshot from hash chain.
 * THROWS if baseline is missing. THROWS if snapshots are incomplete.
 *
 * @param currentSnapshot - Latest governance snapshot payload
 * @param baselineSnapshot - Baseline governance snapshot payload (at time of baseline seal)
 * @param analysedUtc - ISO 8601 timestamp
 * @returns DriftResult with all findings and highest severity
 * @throws {Error} if baseline is missing or snapshots are invalid
 */
export async function computeDrift(
  currentSnapshot: unknown,
  baselineSnapshot: unknown,
  analysedUtc: string
): Promise<DriftResult> {
  // Validate both snapshots — throws on incomplete input
  validateSnapshotPayload(currentSnapshot);
  validateSnapshotPayload(baselineSnapshot);

  const current = currentSnapshot as SnapshotPayload;
  const baseline = baselineSnapshot as SnapshotPayload;

  if (typeof analysedUtc !== 'string' || analysedUtc.length === 0) {
    throw new Error(
      '[FT_ECL_ENGINE:DRIFT_RISK_V1] FAIL-CLOSED: analysedUtc must be a non-empty ISO string'
    );
  }

  // Require baseline record — THROW if missing
  const baselineRecord: BaselineRecord = await requireBaseline();

  // Compute hashes for verification
  const currentSnapshotHash = sha256Hex(current);
  const baselineSnapshotHash = sha256Hex(baseline);

  // Verify baseline hash matches stored baseline record
  if (baselineSnapshotHash !== baselineRecord.snapshotHash) {
    throw new Error(
      `[FT_ECL_ENGINE:DRIFT_RISK_V1] FAIL-CLOSED: provided baseline snapshot hash "${baselineSnapshotHash}" does not match stored baseline "${baselineRecord.snapshotHash}"`
    );
  }

  // Diff all domains — no heuristics, no silent downgrade
  const findings: DriftFinding[] = [
    ...diffRoles(baseline.roles, current.roles),
    ...diffPermissions(baseline.permissions, current.permissions),
    ...diffWorkflows(baseline.workflows, current.workflows),
    ...diffAppInstalls(baseline.appInstalls, current.appInstalls),
  ];

  const severity = maxSeverity(findings);

  return {
    severity,
    findings,
    baselineVersion: baselineRecord.baselineVersion,
    baselineSnapshotHash,
    currentSnapshotHash,
    analysedUtc,
    hasCritical: findings.some((f) => f.severity === 'CRITICAL'),
    hasHigh: findings.some((f) => f.severity === 'HIGH'),
    hasMedium: findings.some((f) => f.severity === 'MEDIUM'),
  };
}

// FT_ECL_ENGINE: DRIFT_RISK_V1 END
