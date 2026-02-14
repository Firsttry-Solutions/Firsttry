/**
 * MILESTONE 1 ENGINE 6E: Audit Coverage & Gaps Report
 * 
 * Output:
 * {
 *   "auditCoverage": {
 *     "jiraAuditCovers": [],
 *     "jiraAuditDoesNotCover": [],
 *     "firstTryCovers": [],
 *     "disclaimers": []
 *   }
 * }
 * 
 * Must explicitly state (verbatim meaning):
 * - Jira audit logs do not capture all user activity
 * - FirstTry captures configuration state, not user content events
 * 
 * Determinism:
 * - Lists sorted lexicographically
 */

import type { AuditCoverage, ConfigInventory } from '../models';
import { canonicalizeValue } from '../canonicalize';

/**
 * Build audit coverage report
 * Derived deterministically from snapshot and inventory
 */
export async function buildAuditCoverageReport(
  snapshotId: string,
  createdAtUtc: string,
  inventory: ConfigInventory | null
): Promise<AuditCoverage> {
  // These lists are deterministic and canonical
  const jiraAuditCovers = [
    'Admin login and logout',
    'App installation and uninstallation',
    'Configuration changes (schemes, workflows)',
    'Jira platform administrative actions',
    'Permission and access changes',
    'User account management',
  ];

  const jiraAuditDoesNotCover = [
    'Custom app events (FirstTry governance snapshots)',
    'Issue search and retrieval (content access)',
    'Non-admin configuration queries',
    'Read-only data retrieval',
    'UI navigation and dashboard views',
    'User API token creation (not audited)',
  ];

  const firstTryCovers = [
    'Configuration inventory snapshot at point-in-time',
    'Dependency graph of schemes and projects',
    'Global permission declarations',
    'Permission boundary at snapshot creation',
    'Platform feature detection (field scheme model)',
    'Project mapping and role assignment',
  ];

  const disclaimers = [
    'Jira audit logs do not capture all user activity',
    'FirstTry captures configuration state, not user content events',
    'Snapshots represent a single point-in-time state',
    'FirstTry is read-only and does not modify Jira configuration',
    'This app has read:jira-work scope only',
    'No end-user data leaves Atlassian infrastructure',
  ];

  // Sort all arrays lexicographically for determinism
  jiraAuditCovers.sort();
  jiraAuditDoesNotCover.sort();
  firstTryCovers.sort();
  disclaimers.sort();

  // Canonicalize the entire structure
  const canonicalCoverage = canonicalizeValue({
    jiraAuditCovers,
    jiraAuditDoesNotCover,
    firstTryCovers,
    disclaimers,
  });

  const report: AuditCoverage = {
    snapshotId,
    createdAtUtc,
    auditCoverage: canonicalCoverage as any,
  };

  return report;
}

/**
 * Validate audit coverage report
 */
export function validateAuditCoverageReport(report: AuditCoverage): boolean {
  if (!report.snapshotId || !report.createdAtUtc || !report.auditCoverage) {
    return false;
  }

  const ac = report.auditCoverage;
  if (!Array.isArray(ac.jiraAuditCovers) ||
      !Array.isArray(ac.jiraAuditDoesNotCover) ||
      !Array.isArray(ac.firstTryCovers) ||
      !Array.isArray(ac.disclaimers)) {
    return false;
  }

  // Check for required disclaimer statements
  const disclaimersStr = ac.disclaimers.join(' ');
  const hasActivity = disclaimersStr.includes('Jira audit logs do not capture all user activity');
  const hasContentEvents = disclaimersStr.includes('FirstTry captures configuration state, not user content events');

  return hasActivity && hasContentEvents;
}
