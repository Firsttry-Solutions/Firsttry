/**
 * PHASE 4: Coverage Matrix Computation with Disclosure Hardening
 * 
 * Computes and stores coverage metrics for Jira data quality:
 * - % issues missing required fields
 * - % issues never transitioned (no status changes)
 * - Fields never populated (exist in schema but no values in any issue)
 * - Automation rules present but never triggered
 * 
 * HARDENING: All metrics wrapped with mandatory disclosure to prevent
 * misinterpretation of zeros as failures vs. "not yet measured".
 * 
 * Scope: Counts and presence only. NO calculations beyond counts.
 * NO forecasting, NO recommendations, NO benchmarks.
 */

import api from '@forge/api';
import { JiraIngestionResult } from './jira_ingest';
import {
  DataQualityIndicator,
  ConfidenceLevel,
  ZeroValueReason,
  AutomationVisibilityDisclosure,
  CoverageMetricWithDisclosure,
  createInsufficientWindowDisclosure,
  createAutomationVisibilityDisclosure,
} from './disclosure_types';

export interface CoverageMetrics {
  org: string;
  snapshotTimestamp: string;
  projectCount: number;
  issueTypeCount: number;
  statusCount: number;
  fieldCount: number;
  fieldCounts: {
    custom: number;
    system: number;
  };
  issueEventCount: number;
  automationRuleCount: number;
  automationRulesEnabled: number;
  appInstalledAt?: string;
}

/**
 * DISCLOSURE WRAPPER: All zero values must include explanation
 * that they're not measurements, they're "not yet measured".
 */
export interface CoverageMetricsWithDisclosure {
  metrics: CoverageMetrics;
  
  /** GAP 1 FIX: Every zero value has mandatory explanation */
  projectCount_disclosure: DataQualityIndicator;
  fieldCount_disclosure: DataQualityIndicator;
  automationRuleCount_disclosure: DataQualityIndicator;
  automationRulesEnabled_disclosure: DataQualityIndicator;
  
  /** Observation window for this snapshot (days since app install) */
  observation_window_days: number;
  
  /** When this disclosure was computed */
  disclosed_at: string;
}

export interface ProjectCoverageMatrix {
  projectId: string;
  projectKey: string;
  issuesTotal: number;
  issuesMissingRequiredFields: number;
  issuesMissingRequiredFieldsPercent: number;
  issuesNeverTransitioned: number;
  issuesNeverTransitionedPercent: number;
}

/**
 * DISCLOSURE WRAPPER: Field population metrics need "not measured yet" labels
 */
export interface ProjectCoverageMatrixWithDisclosure {
  matrix: ProjectCoverageMatrix;
  
  /** GAP 1 FIX: Population counts have zero-value explanations */
  issues_missing_fields_disclosure: DataQualityIndicator;
  issues_never_transitioned_disclosure: DataQualityIndicator;
}

export interface FieldCoverageMatrix {
  fieldId: string;
  fieldName: string;
  isCustom: boolean;
  populatedInIssuesCount: number;
  neverPopulated: boolean;
}

/**
 * DISCLOSURE WRAPPER: Field population is zero because Phase 4 is metadata-only
 */
export interface FieldCoverageMatrixWithDisclosure {
  matrix: FieldCoverageMatrix;
  
  /** GAP 1 FIX: Population count of zero has mandatory explanation */
  population_disclosure: DataQualityIndicator;
}

export interface AutomationRuleCoverageMatrix {
  ruleId: string;
  ruleName: string;
  enabled: boolean;
  lastModified: string;
  eventsTriggered: number; // Will be computed later with audit events
  neverTriggered: boolean;
}

/**
 * DISCLOSURE WRAPPER: Automation rule visibility + "why no execution data yet"
 * 
 * GAP 2 FIX: "Rule visible but never triggered" must NOT be misread as "rule broken"
 * Instead: "Rule is visible (metadata available) but execution not yet measurable (Phase 4)"
 */
export interface AutomationRuleCoverageMatrixWithDisclosure {
  matrix: AutomationRuleCoverageMatrix;
  
  /** Why we can see this rule but not its execution */
  visibility_disclosure: AutomationVisibilityDisclosure;
  
  /** Execution data is zero because Phase 4 has no audit events yet */
  execution_disclosure: DataQualityIndicator;
}

export interface CoverageMatrixSnapshot {
  org: string;
  snapshotTimestamp: string;
  coverageMetrics: CoverageMetrics;
  projectMatrices: ProjectCoverageMatrix[];
  fieldMatrices: FieldCoverageMatrix[];
  automationMatrices: AutomationRuleCoverageMatrix[];
  dataQualityNotes: string[];
}

/**
 * Compute summary coverage metrics from ingestion result
 * (UNCHANGED: Core logic preserved)
 */
export function computeCoverageMetrics(
  org: string,
  ingestionResult: JiraIngestionResult
): CoverageMetrics {
  const customFieldCount = ingestionResult.fields.data.filter((f) => f.isCustom).length;
  const systemFieldCount = ingestionResult.fields.data.length - customFieldCount;

  const enabledRules = ingestionResult.automationRules.data.filter((r) => r.enabled).length;

  return {
    org,
    snapshotTimestamp: ingestionResult.snapshotTimestamp,
    projectCount: ingestionResult.projects.data.length,
    issueTypeCount: ingestionResult.issueTypes.data.length,
    statusCount: ingestionResult.statuses.data.length,
    fieldCount: ingestionResult.fields.data.length,
    fieldCounts: {
      custom: customFieldCount,
      system: systemFieldCount,
    },
    issueEventCount: ingestionResult.issueEvents.data.length,
    automationRuleCount: ingestionResult.automationRules.data.length,
    automationRulesEnabled: enabledRules,
    appInstalledAt: ingestionResult.appInstallation.data?.installedAt,
  };
}

/**
 * GAP 1 FIX: Wrap coverage metrics with mandatory disclosure
 * Prevents misinterpretation of zeros as measurement failures.
 * 
 * CRITICAL: Does NOT change metric computation. Only adds explanatory labels.
 */
export function wrapCoverageMetricsWithDisclosure(
  metrics: CoverageMetrics,
  observationWindowDays: number
): CoverageMetricsWithDisclosure {
  return {
    metrics,
    projectCount_disclosure: {
      completeness_percent: metrics.projectCount > 0 ? 100 : 0,
      observation_window_days: observationWindowDays,
      confidence_level:
        metrics.projectCount > 0 ? ConfidenceLevel.HIGH : ConfidenceLevel.INSUFFICIENT_DATA,
      zero_value_reason:
        metrics.projectCount === 0 ? ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW : undefined,
      disclosure_text:
        metrics.projectCount > 0
          ? `${metrics.projectCount} projects visible. All project metadata has been collected (100% completeness).`
          : `Project count is not yet measured in Phase 4 (metadata-only phase). Actual project count will be measured in Phase 5+. This is not a failure.`,
      computed_at: new Date().toISOString(),
    },
    fieldCount_disclosure: {
      completeness_percent: metrics.fieldCount > 0 ? 100 : 0,
      observation_window_days: observationWindowDays,
      confidence_level:
        metrics.fieldCount > 0 ? ConfidenceLevel.HIGH : ConfidenceLevel.INSUFFICIENT_DATA,
      zero_value_reason:
        metrics.fieldCount === 0 ? ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW : undefined,
      disclosure_text:
        metrics.fieldCount > 0
          ? `${metrics.fieldCount} fields (${metrics.fieldCounts.custom} custom, ${metrics.fieldCounts.system} system) are configured in your instance.`
          : `Field count is not yet measured in Phase 4 (metadata-only phase). Field usage will be measured in Phase 5+. This is not a failure.`,
      computed_at: new Date().toISOString(),
    },
    automationRuleCount_disclosure: {
      completeness_percent: metrics.automationRuleCount > 0 ? 100 : 0,
      observation_window_days: observationWindowDays,
      confidence_level:
        metrics.automationRuleCount > 0 ? ConfidenceLevel.HIGH : ConfidenceLevel.INSUFFICIENT_DATA,
      zero_value_reason:
        metrics.automationRuleCount === 0 ? ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW : undefined,
      disclosure_text:
        metrics.automationRuleCount > 0
          ? `${metrics.automationRuleCount} automation rules exist in your instance. Rule presence has been fully enumerated (100% completeness).`
          : `Automation rule count is not yet measured in Phase 4 (metadata-only phase). Rule existence will be measured in Phase 5+. This is not a failure.`,
      computed_at: new Date().toISOString(),
    },
    automationRulesEnabled_disclosure: {
      completeness_percent: metrics.automationRuleCount > 0 ? 100 : 0,
      observation_window_days: observationWindowDays,
      confidence_level:
        metrics.automationRuleCount > 0
          ? ConfidenceLevel.MEDIUM
          : ConfidenceLevel.INSUFFICIENT_DATA,
      zero_value_reason:
        metrics.automationRulesEnabled === 0
          ? ZeroValueReason.MEASUREMENT_NOT_YET_ENABLED
          : undefined,
      disclosure_text:
        metrics.automationRulesEnabled > 0
          ? `${metrics.automationRulesEnabled} of ${metrics.automationRuleCount} automation rules are currently enabled.`
          : `Enabled rule count shows ${metrics.automationRulesEnabled} because Phase 4 is metadata-only. Automation rule EXECUTION will be measured in Phase 5+. Rule presence does not imply usage.`,
      computed_at: new Date().toISOString(),
    },
    observation_window_days: observationWindowDays,
    disclosed_at: new Date().toISOString(),
  };
}

/**
 * Compute project-level coverage matrix
 * (UNCHANGED: Core logic preserved)
 * 
 * Note: In Phase 4, we don't have full issue data (bulk download is expensive).
 * This function provides the SCHEMA for project coverage.
 * Actual computation happens in Phase 5+ when we have issue audit data.
 */
export function computeProjectCoverageMatrix(
  projectId: string,
  projectKey: string,
  issueCount: number,
  issuesMissingRequiredFields: number = 0,
  issuesNeverTransitioned: number = 0
): ProjectCoverageMatrix {
  const missingPercent = issueCount > 0 ? (issuesMissingRequiredFields / issueCount) * 100 : 0;
  const neverTransitionedPercent = issueCount > 0 ? (issuesNeverTransitioned / issueCount) * 100 : 0;

  return {
    projectId,
    projectKey,
    issuesTotal: issueCount,
    issuesMissingRequiredFields,
    issuesMissingRequiredFieldsPercent: Math.round(missingPercent * 100) / 100,
    issuesNeverTransitioned,
    issuesNeverTransitionedPercent: Math.round(neverTransitionedPercent * 100) / 100,
  };
}

/**
 * GAP 1 FIX: Wrap project coverage with disclosure
 * Prevents misreading "zero missing fields" as "complete" when we haven't looked yet.
 */
export function wrapProjectCoverageWithDisclosure(
  matrix: ProjectCoverageMatrix,
  observationWindowDays: number
): ProjectCoverageMatrixWithDisclosure {
  return {
    matrix,
    issues_missing_fields_disclosure: {
      completeness_percent:
        matrix.issuesTotal > 0 ? 100 : 0,
      observation_window_days: observationWindowDays,
      confidence_level:
        matrix.issuesTotal > 0 ? ConfidenceLevel.MEDIUM : ConfidenceLevel.INSUFFICIENT_DATA,
      zero_value_reason:
        matrix.issuesMissingRequiredFields === 0 && matrix.issuesTotal === 0
          ? ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW
          : undefined,
      disclosure_text:
        matrix.issuesTotal === 0
          ? `${matrix.projectKey}: Issue analysis shows zero because Phase 4 has only been observing for ${observationWindowDays} day(s). Field population will be measured in Phase 5+.`
          : `${matrix.projectKey}: ${matrix.issuesMissingRequiredFields} of ${matrix.issuesTotal} issues (${matrix.issuesMissingRequiredFieldsPercent}%) are missing required fields.`,
      computed_at: new Date().toISOString(),
    },
    issues_never_transitioned_disclosure: {
      completeness_percent:
        matrix.issuesTotal > 0 ? 100 : 0,
      observation_window_days: observationWindowDays,
      confidence_level:
        matrix.issuesTotal > 0 ? ConfidenceLevel.MEDIUM : ConfidenceLevel.INSUFFICIENT_DATA,
      zero_value_reason:
        matrix.issuesNeverTransitioned === 0 && matrix.issuesTotal === 0
          ? ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW
          : undefined,
      disclosure_text:
        matrix.issuesTotal === 0
          ? `${matrix.projectKey}: Workflow analysis shows zero because Phase 4 has only been observing for ${observationWindowDays} day(s). Status transitions will be measured in Phase 5+.`
          : `${matrix.projectKey}: ${matrix.issuesNeverTransitioned} of ${matrix.issuesTotal} issues (${matrix.issuesNeverTransitionedPercent}%) have never transitioned between statuses.`,
      computed_at: new Date().toISOString(),
    },
  };
}

/**
 * Compute field-level coverage matrix
 * (UNCHANGED: Core logic preserved)
 * 
 * Identifies which fields are populated in any issue.
 * In Phase 4, all fields are considered "never populated" (conservative estimate).
 * Actual population data comes from Phase 5+ with full issue audit.
 */
export function computeFieldCoverageMatrix(
  fieldId: string,
  fieldName: string,
  isCustom: boolean,
  populatedInIssuesCount: number = 0
): FieldCoverageMatrix {
  return {
    fieldId,
    fieldName,
    isCustom,
    populatedInIssuesCount,
    neverPopulated: populatedInIssuesCount === 0,
  };
}

/**
 * GAP 1 FIX: Wrap field coverage with disclosure
 * Prevents misreading "zero issues use this field" as "field is unused" when we haven't looked yet.
 */
export function wrapFieldCoverageWithDisclosure(
  matrix: FieldCoverageMatrix,
  observationWindowDays: number
): FieldCoverageMatrixWithDisclosure {
  return {
    matrix,
    population_disclosure: {
      completeness_percent: matrix.neverPopulated ? 0 : 100,
      observation_window_days: observationWindowDays,
      confidence_level:
        observationWindowDays >= 30
          ? ConfidenceLevel.MEDIUM
          : ConfidenceLevel.INSUFFICIENT_DATA,
      zero_value_reason: matrix.neverPopulated
        ? ZeroValueReason.INSUFFICIENT_HISTORICAL_WINDOW
        : undefined,
      disclosure_text: matrix.neverPopulated
        ? `${matrix.fieldName} (${matrix.isCustom ? 'custom' : 'system'}): Shows zero issues because Phase 4 has only been observing for ${observationWindowDays} day(s). Field population will be measured in Phase 5+. Lack of current usage does not indicate a misconfigured field.`
        : `${matrix.fieldName} (${matrix.isCustom ? 'custom' : 'system'}): Used in ${matrix.populatedInIssuesCount} issue(s).`,
      computed_at: new Date().toISOString(),
    },
  };
}

/**
 * Compute automation rule coverage matrix
 * (UNCHANGED: Core logic preserved)
 * 
 * Tracks which automation rules exist and whether they've been triggered.
 * In Phase 4, all rules are marked as "never triggered" (conservative estimate).
 * Actual trigger data comes from Phase 5+ with audit events.
 */
export function computeAutomationRuleCoverageMatrix(
  ruleId: string,
  ruleName: string,
  enabled: boolean,
  lastModified: string,
  eventsTriggered: number = 0
): AutomationRuleCoverageMatrix {
  return {
    ruleId,
    ruleName,
    enabled,
    lastModified,
    eventsTriggered,
    neverTriggered: eventsTriggered === 0,
  };
}

/**
 * GAP 2 FIX: Wrap automation rule coverage with visibility disclosure
 * 
 * CRITICAL: Prevents "rule visible but zero triggers = rule is broken" misinterpretation.
 * Instead: "Rule is visible (Phase 4 metadata available) but execution not measurable (Phase 4)".
 * 
 * Does NOT change metric computation. Only adds mandatory explanation labels.
 */
export function wrapAutomationRuleCoverageWithDisclosure(
  matrix: AutomationRuleCoverageMatrix,
  observationWindowDays: number
): AutomationRuleCoverageMatrixWithDisclosure {
  return {
    matrix,
    visibility_disclosure: createAutomationVisibilityDisclosure(
      matrix.ruleId,
      matrix.ruleName,
      matrix.enabled
    ),
    execution_disclosure: {
      completeness_percent: 0,
      observation_window_days: observationWindowDays,
      confidence_level: ConfidenceLevel.INSUFFICIENT_DATA,
      zero_value_reason: ZeroValueReason.MEASUREMENT_NOT_YET_ENABLED,
      disclosure_text: `${matrix.ruleName}: Rule is visible and ${matrix.enabled ? 'enabled' : 'disabled'}, but execution is not measurable in Phase 4 (metadata-only). Automation execution will be measured in Phase 5+. Rule presence does not indicate execution or health status.`,
      computed_at: new Date().toISOString(),
    },
  };
}

/**
 * Build complete coverage matrix snapshot from ingestion result
 */
export function buildCoverageMatrixSnapshot(
  org: string,
  ingestionResult: JiraIngestionResult
): CoverageMatrixSnapshot {
  const coverageMetrics = computeCoverageMetrics(org, ingestionResult);

  // Project matrices (stub with zero issues; actual counts in Phase 5+)
  const projectMatrices = ingestionResult.projects.data.map((project) =>
    computeProjectCoverageMatrix(project.id, project.key, 0)
  );

  // Field matrices
  const fieldMatrices = ingestionResult.fields.data.map((field) =>
    computeFieldCoverageMatrix(field.id, field.name, field.isCustom, 0)
  );

  // Automation rule matrices
  const automationMatrices = ingestionResult.automationRules.data.map((rule) =>
    computeAutomationRuleCoverageMatrix(rule.id, rule.name, rule.enabled, rule.lastModified, 0)
  );

  // Data quality notes based on coverage flags
  const notes: string[] = [];

  if (ingestionResult.projects.coverage === 'PARTIAL') {
    notes.push(`Projects: ${ingestionResult.projects.errorMessage || 'partial data'}`);
  }
  if (ingestionResult.issueEvents.coverage === 'PARTIAL') {
    notes.push(`Issue events: ${ingestionResult.issueEvents.errorMessage || 'partial data (pagination limit)'}`);
  }
  if (ingestionResult.appInstallation.coverage === 'PARTIAL') {
    notes.push('App installation timestamp: not yet recorded');
  }

  // Missing permissions
  if (ingestionResult.projects.coverage === 'NOT_PERMITTED_BY_SCOPE') {
    notes.push(`Projects: ${ingestionResult.projects.errorMessage}`);
  }
  if (ingestionResult.issueTypes.coverage === 'NOT_PERMITTED_BY_SCOPE') {
    notes.push(`Issue types: ${ingestionResult.issueTypes.errorMessage}`);
  }
  if (ingestionResult.statuses.coverage === 'NOT_PERMITTED_BY_SCOPE') {
    notes.push(`Statuses: ${ingestionResult.statuses.errorMessage}`);
  }
  if (ingestionResult.fields.coverage === 'NOT_PERMITTED_BY_SCOPE') {
    notes.push(`Fields: ${ingestionResult.fields.errorMessage}`);
  }
  if (ingestionResult.issueEvents.coverage === 'NOT_PERMITTED_BY_SCOPE') {
    notes.push(`Issues: ${ingestionResult.issueEvents.errorMessage}`);
  }
  if (ingestionResult.automationRules.coverage === 'NOT_PERMITTED_BY_SCOPE') {
    notes.push(`Automation rules: ${ingestionResult.automationRules.errorMessage}`);
  }

  return {
    org,
    snapshotTimestamp: ingestionResult.snapshotTimestamp,
    coverageMetrics,
    projectMatrices,
    fieldMatrices,
    automationMatrices,
    dataQualityNotes: notes,
  };
}

/**
 * HARDENING: Build disclosed version of coverage matrix snapshot
 * 
 * This WRAPS the snapshot with disclosure metadata without changing
 * any computation. Every metric is paired with mandatory labels explaining
 * zeros, observation windows, and confidence levels.
 * 
 * Prevents:
 * - GAP 1: Zero misinterpretation (no "INSUFFICIENT HISTORICAL WINDOW" → rejection)
 * - GAP 2: Automation visibility illusion (rule present but no execution data)
 * - GAP 5: Confidence absence (no way to judge metric reliability)
 */
export function buildCoverageMatrixSnapshotWithDisclosure(
  snapshot: CoverageMatrixSnapshot,
  observationWindowDays: number = 1
): {
  snapshot: CoverageMatrixSnapshot;
  metrics_disclosed: CoverageMetricsWithDisclosure;
  projects_disclosed: ProjectCoverageMatrixWithDisclosure[];
  fields_disclosed: FieldCoverageMatrixWithDisclosure[];
  automations_disclosed: AutomationRuleCoverageMatrixWithDisclosure[];
} {
  return {
    snapshot,
    metrics_disclosed: wrapCoverageMetricsWithDisclosure(
      snapshot.coverageMetrics,
      observationWindowDays
    ),
    projects_disclosed: snapshot.projectMatrices.map((m) =>
      wrapProjectCoverageWithDisclosure(m, observationWindowDays)
    ),
    fields_disclosed: snapshot.fieldMatrices.map((m) =>
      wrapFieldCoverageWithDisclosure(m, observationWindowDays)
    ),
    automations_disclosed: snapshot.automationMatrices.map((m) =>
      wrapAutomationRuleCoverageWithDisclosure(m, observationWindowDays)
    ),
  };
}

/**
 * Store coverage matrix snapshot in Forge storage (append-only)
 */
export async function storeCoverageMatrixSnapshot(
  org: string,
  snapshot: CoverageMatrixSnapshot
): Promise<string> {
  const snapshotId = `coverage_${org}_${new Date(snapshot.snapshotTimestamp).getTime()}`;

  await api.asApp().requestStorage(async (storage) => {
    // Store snapshot
    const storageKey = `coverage/${snapshotId}`;
    await storage.set(storageKey, snapshot);

    // Update index
    const indexKey = `coverage:index:${org}`;
    const index = (await storage.get(indexKey) || []) as string[];
    if (!index.includes(snapshotId)) {
      index.push(snapshotId);
      await storage.set(indexKey, index);
    }
  });

  return snapshotId;
}

/**
 * Retrieve most recent coverage matrix for org
 */
export async function getMostRecentCoverageMatrix(org: string): Promise<CoverageMatrixSnapshot | null> {
  const snapshot = await api.asApp().requestStorage(async (storage) => {
    const indexKey = `coverage:index:${org}`;
    const index = (await storage.get(indexKey) || []) as string[];

    if (index.length === 0) {
      return null;
    }

    // Most recent is last in index
    const snapshotId = index[index.length - 1];
    const storageKey = `coverage/${snapshotId}`;
    return await storage.get(storageKey);
  });

  return snapshot || null;
}

/**
 * Get all coverage matrices for org with pagination
 */
export async function listCoverageMatrices(org: string, limit: number = 100): Promise<CoverageMatrixSnapshot[]> {
  const snapshots = await api.asApp().requestStorage(async (storage) => {
    const indexKey = `coverage:index:${org}`;
    const index = (await storage.get(indexKey) || []) as string[];

    // Get most recent N
    const recentIds = index.slice(-limit).reverse();

    const snapshotPromises = recentIds.map(async (id) => {
      const storageKey = `coverage/${id}`;
      return await storage.get(storageKey);
    });

    const allSnapshots = await Promise.all(snapshotPromises);
    return allSnapshots.filter((s) => s !== null);
  });

  return snapshots || [];
}
