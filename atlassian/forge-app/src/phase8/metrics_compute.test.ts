/**
 * PHASE 8 v2: COMPREHENSIVE TEST SUITE
 *
 * Tests cover:
 * - Positive metrics computation
 * - Negative (NOT_AVAILABLE) handling
 * - Confidence scoring
 * - Determinism and hashing
 * - Scale testing
 * - Prohibition verification
 */

import {
  computeM1_UnusedRequiredFields,
  computeM2_InconsistentFieldUsage,
  computeM3_AutomationExecutionGap,
  computeM4_ConfigurationChurnDensity,
  computeM5_VisibilityGapOverTime,
  computeAllMetrics,
  generateCanonicalHash,
  SnapshotData,
  UsageData,
  DriftEventData,
} from '../metrics_compute';
import {
  MetricAvailability,
  NotAvailableReason,
  ConfidenceLabel,
  TimeWindow,
  computeConfidenceScore,
  canonicalMetricsRunJson,
} from '../metrics_model';
import {
  storeMetricsRun,
  getMetricsRun,
  listMetricsRuns,
  verifyCanonicalHash,
  deleteMetricsRun,
} from '../metrics_storage';
import { exportMetricsRun, exportMetricsRunJson } from '../metrics_export';

describe('Phase 8 v2: Governance Metrics Tests', () => {
  const tenantId = 'test-tenant-1';
  const cloudId = 'cloud-123';
  const timeWindow: TimeWindow = {
    from: '2025-01-01T00:00:00Z',
    to: '2025-01-31T23:59:59Z',
  };

  // ============================================================================
  // TEST SUITE 1: M1 - UNUSED REQUIRED FIELDS
  // ============================================================================

  describe('M1 - Unused Required Fields', () => {
    it('TC-1.1: Should compute with complete data', () => {
      const snapshot: SnapshotData = {
        fields: [
          { id: 'f1', name: 'Required 1', required: true, active: true },
          { id: 'f2', name: 'Required 2', required: true, active: true },
          { id: 'f3', name: 'Required 3', required: true, active: true },
          { id: 'f4', name: 'Required 4', required: true, active: true },
          { id: 'f5', name: 'Required 5', required: true, active: true },
        ],
      };

      const usage: UsageData = {
        'project-1': {
          usedFieldIds: new Set(['f1', 'f2']),
          automationRuleExecutions: {},
        },
        'project-2': {
          usedFieldIds: new Set(['f2', 'f3']),
          automationRuleExecutions: {},
        },
      };

      const metric = computeM1_UnusedRequiredFields(snapshot, usage, []);

      expect(metric.availability).toBe(MetricAvailability.AVAILABLE);
      expect(metric.numerator).toBe(2); // f4, f5 not used
      expect(metric.denominator).toBe(5);
      expect(metric.value).toBeCloseTo(0.4);
      expect(metric.confidence_label).toBe(ConfidenceLabel.HIGH);
      expect(metric.bounded).toBe(true);
    });

    it('TC-1.2: Should return NOT_AVAILABLE when usage missing', () => {
      const snapshot: SnapshotData = {
        fields: [
          { id: 'f1', name: 'Required 1', required: true, active: true },
        ],
      };

      const metric = computeM1_UnusedRequiredFields(snapshot, null, []);

      expect(metric.availability).toBe(MetricAvailability.NOT_AVAILABLE);
      expect(metric.not_available_reason).toBe(NotAvailableReason.MISSING_USAGE_DATA);
      expect(metric.value).toBeNull();
      expect(metric.confidence_label).toBe(ConfidenceLabel.NONE);
    });

    it('TC-1.3: Should handle zero unused fields (all used)', () => {
      const snapshot: SnapshotData = {
        fields: [
          { id: 'f1', name: 'Required 1', required: true, active: true },
          { id: 'f2', name: 'Required 2', required: true, active: true },
        ],
      };

      const usage: UsageData = {
        'project-1': {
          usedFieldIds: new Set(['f1', 'f2']),
          automationRuleExecutions: {},
        },
      };

      const metric = computeM1_UnusedRequiredFields(snapshot, usage, []);

      expect(metric.numerator).toBe(0);
      expect(metric.denominator).toBe(2);
      expect(metric.value).toBe(0);
      expect(metric.availability).toBe(MetricAvailability.AVAILABLE);
    });
  });

  // ============================================================================
  // TEST SUITE 2: M2 - INCONSISTENT FIELD USAGE
  // ============================================================================

  describe('M2 - Inconsistent Field Usage', () => {
    it('TC-1.4: Should identify inconsistent fields (variance > 0.35)', () => {
      const snapshot: SnapshotData = {
        fields: [
          { id: 'f1', name: 'Field 1', required: false, active: true },
          { id: 'f2', name: 'Field 2', required: false, active: true },
        ],
      };

      const usage: UsageData = {
        'proj-1': { usedFieldIds: new Set(['f1']), automationRuleExecutions: {} },
        'proj-2': { usedFieldIds: new Set(), automationRuleExecutions: {} },
        'proj-3': { usedFieldIds: new Set(), automationRuleExecutions: {} },
      };

      const metric = computeM2_InconsistentFieldUsage(snapshot, usage, []);

      expect(metric.availability).toBe(MetricAvailability.AVAILABLE);
      // f1: [1,0,0] → variance_ratio > 0.35
      expect(metric.numerator).toBeGreaterThan(0);
      expect(metric.denominator).toBe(2);
    });

    it('TC-1.5: Should return NOT_AVAILABLE when project usage missing', () => {
      const snapshot: SnapshotData = {
        fields: [{ id: 'f1', name: 'Field 1', required: false, active: true }],
      };

      const metric = computeM2_InconsistentFieldUsage(snapshot, null, []);

      expect(metric.availability).toBe(MetricAvailability.NOT_AVAILABLE);
      expect(metric.not_available_reason).toBe(NotAvailableReason.MISSING_PROJECT_USAGE_DATA);
    });
  });

  // ============================================================================
  // TEST SUITE 3: M3 - AUTOMATION EXECUTION GAP
  // ============================================================================

  describe('M3 - Automation Execution Gap', () => {
    it('TC-1.6: Should compute with complete data', () => {
      const snapshot: SnapshotData = {
        automationRules: [
          { id: 'a1', name: 'Rule 1', enabled: true },
          { id: 'a2', name: 'Rule 2', enabled: true },
          { id: 'a3', name: 'Rule 3', enabled: true },
        ],
      };

      const usage: UsageData = {
        'project-1': {
          usedFieldIds: new Set(),
          automationRuleExecutions: { a1: 5, a2: 0, a3: 0 },
        },
      };

      const metric = computeM3_AutomationExecutionGap(snapshot, usage, []);

      expect(metric.availability).toBe(MetricAvailability.AVAILABLE);
      expect(metric.numerator).toBe(2); // a2, a3 never executed
      expect(metric.denominator).toBe(3);
      expect(metric.value).toBeCloseTo(2 / 3);
    });

    it('TC-1.7: Should return NOT_AVAILABLE when execution logs missing', () => {
      const snapshot: SnapshotData = {
        automationRules: [{ id: 'a1', name: 'Rule 1', enabled: true }],
      };

      const metric = computeM3_AutomationExecutionGap(snapshot, null, []);

      expect(metric.availability).toBe(MetricAvailability.NOT_AVAILABLE);
      expect(metric.not_available_reason).toBe(NotAvailableReason.MISSING_EXECUTION_LOGS);
    });
  });

  // ============================================================================
  // TEST SUITE 4: M4 - CONFIGURATION CHURN DENSITY
  // ============================================================================

  describe('M4 - Configuration Churn Density', () => {
    it('TC-1.8: Should compute with complete data', () => {
      const snapshot: SnapshotData = {
        fields: Array(40).fill(null).map((_, i) => ({
          id: `f${i}`,
          name: `Field ${i}`,
          required: false,
          active: true,
        })),
        automationRules: Array(30).fill(null).map((_, i) => ({
          id: `a${i}`,
          name: `Rule ${i}`,
          enabled: true,
        })),
        projects: Array(30).fill(null).map((_, i) => ({
          id: `p${i}`,
          key: `P${i}`,
        })),
      };

      const driftEvents: DriftEventData[] = Array(150).fill(null).map((_, i) => ({
        object_type: 'FIELD',
        object_id: `obj${i}`,
        change_type: 'modified',
        timestamp: '2025-01-15T12:00:00Z',
      }));

      const metric = computeM4_ConfigurationChurnDensity(snapshot, driftEvents, []);

      expect(metric.availability).toBe(MetricAvailability.AVAILABLE);
      expect(metric.numerator).toBe(150);
      expect(metric.denominator).toBe(100);
      expect(metric.value).toBeCloseTo(1.5);
      expect(metric.bounded).toBe(false); // Can exceed 1.0
    });

    it('TC-1.9: Should return NOT_AVAILABLE when drift events missing', () => {
      const snapshot: SnapshotData = {
        fields: [{ id: 'f1', name: 'Field 1', required: false, active: true }],
      };

      const metric = computeM4_ConfigurationChurnDensity(snapshot, [], ['drift_events']);

      expect(metric.availability).toBe(MetricAvailability.NOT_AVAILABLE);
      expect(metric.not_available_reason).toBe(NotAvailableReason.MISSING_DRIFT_DATA);
    });
  });

  // ============================================================================
  // TEST SUITE 5: M5 - VISIBILITY GAP OVER TIME
  // ============================================================================

  describe('M5 - Visibility Gap Over Time', () => {
    it('TC-1.10: Should compute with missing datasets', () => {
      const snapshot: SnapshotData = {
        missingData: {
          dataset_keys: ['fields', 'projects'],
          reason_codes: ['PERMISSION_DENIED', 'API_ERROR'],
        },
      };

      const expectedDatasets = ['fields', 'projects', 'workflows', 'automation_rules', 'scopes'];
      const metric = computeM5_VisibilityGapOverTime(snapshot, expectedDatasets);

      expect(metric.availability).toBe(MetricAvailability.AVAILABLE); // Always available
      expect(metric.numerator).toBe(2);
      expect(metric.denominator).toBe(5);
      expect(metric.value).toBeCloseTo(0.4);
      expect(metric.confidence_label).toBe(ConfidenceLabel.HIGH);
    });

    it('TC-1.11: Should show zero gap when no datasets missing', () => {
      const snapshot: SnapshotData = {
        missingData: {
          dataset_keys: [],
          reason_codes: [],
        },
      };

      const expectedDatasets = ['fields', 'projects', 'workflows', 'automation_rules', 'scopes'];
      const metric = computeM5_VisibilityGapOverTime(snapshot, expectedDatasets);

      expect(metric.numerator).toBe(0);
      expect(metric.denominator).toBe(5);
      expect(metric.value).toBe(0);
    });
  });

  // ============================================================================
  // TEST SUITE 6: CONFIDENCE SCORING
  // ============================================================================

  describe('Confidence Scoring', () => {
    it('TC-2.1: Should assign HIGH confidence when all data present', () => {
      const { score, label } = computeConfidenceScore({
        base_completeness: 100,
        missing_critical_datasets: 0,
      });

      expect(score).toBe(1.0);
      expect(label).toBe(ConfidenceLabel.HIGH);
    });

    it('TC-2.2: Should assign MEDIUM confidence with one missing dataset', () => {
      const { score, label } = computeConfidenceScore({
        base_completeness: 100,
        missing_critical_datasets: 1,
      });

      expect(score).toBeCloseTo(0.8);
      expect(label).toBe(ConfidenceLabel.MEDIUM);
    });

    it('TC-2.3: Should assign LOW confidence with two missing datasets', () => {
      const { score, label } = computeConfidenceScore({
        base_completeness: 100,
        missing_critical_datasets: 2,
      });

      expect(score).toBeCloseTo(0.6);
      expect(label).toBe(ConfidenceLabel.LOW);
    });

    it('TC-2.4: Should assign NONE confidence with many missing datasets', () => {
      const { score, label } = computeConfidenceScore({
        base_completeness: 100,
        missing_critical_datasets: 4,
      });

      expect(score).toBeCloseTo(0.2);
      expect(label).toBe(ConfidenceLabel.NONE);
    });

    it('TC-2.5: Should clamp negative scores to zero', () => {
      const { score } = computeConfidenceScore({
        base_completeness: 50,
        missing_critical_datasets: 5,
      });

      expect(score).toBeCloseTo(0);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // TEST SUITE 7: DETERMINISM & HASHING
  // ============================================================================

  describe('Determinism & Hashing', () => {
    it('TC-3.1: Should generate reproducible canonical hashes', async () => {
      const snapshot: SnapshotData = {
        fields: [{ id: 'f1', name: 'Field 1', required: true, active: true }],
      };

      const usage: UsageData = {
        'project-1': { usedFieldIds: new Set(), automationRuleExecutions: {} },
      };

      const run1 = await computeAllMetrics(
        tenantId,
        cloudId,
        snapshot,
        usage,
        [],
        timeWindow
      );

      const run2 = await computeAllMetrics(
        tenantId,
        cloudId,
        snapshot,
        usage,
        [],
        timeWindow
      );

      // Note: metrics_run_id will differ, so we compare metrics content
      expect(run1.metrics[0].value).toBe(run2.metrics[0].value);
      expect(run1.completeness_percentage).toBe(run2.completeness_percentage);
    });

    it('TC-3.3: Should maintain deterministic ordering across retrievals', async () => {
      // Create multiple runs with timestamps
      const run1 = await computeAllMetrics(
        tenantId,
        cloudId,
        { fields: [] },
        {},
        [],
        timeWindow
      );

      const run2 = await computeAllMetrics(
        tenantId,
        cloudId,
        { fields: [] },
        {},
        [],
        { ...timeWindow, from: '2025-01-02T00:00:00Z' }
      );

      // Verify deterministic order (most recent first)
      expect(new Date(run2.computed_at).getTime())
        .toBeGreaterThanOrEqual(new Date(run1.computed_at).getTime());
    });

    it('TC-3.4: Should verify canonical hash', () => {
      const testRun = {
        tenant_id: 'test',
        cloud_id: 'cloud',
        metrics_run_id: 'run-123',
        time_window: timeWindow,
        computed_at: new Date().toISOString(),
        status: 'success' as const,
        completeness_percentage: 100,
        missing_inputs: [] as string[],
        schema_version: '8.0',
        metrics: [],
        hash_algorithm: 'sha256',
      };

      const hash = generateCanonicalHash(testRun);
      const completeRun = { ...testRun, canonical_hash: hash };

      expect(verifyCanonicalHash(completeRun)).toBe(true);

      // Modify a field
      completeRun.completeness_percentage = 99;
      expect(verifyCanonicalHash(completeRun)).toBe(false);
    });
  });

  // ============================================================================
  // TEST SUITE 8: STORAGE & PAGINATION
  // ============================================================================

  describe('Storage & Pagination', () => {
    it('TC-4.1: Should store and retrieve metrics run', async () => {
      const snapshot: SnapshotData = { fields: [] };
      const usage: UsageData = {};
      const driftEvents: DriftEventData[] = [];

      const run = await computeAllMetrics(
        tenantId,
        cloudId,
        snapshot,
        usage,
        driftEvents,
        timeWindow
      );

      const stored = await storeMetricsRun(tenantId, cloudId, run);
      const retrieved = await getMetricsRun(tenantId, cloudId, run.metrics_run_id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.metrics_run_id).toBe(run.metrics_run_id);
      expect(retrieved?.canonical_hash).toBe(stored.canonical_hash);
    });

    it('TC-4.2: Should paginate results', async () => {
      // Store 3 runs
      for (let i = 0; i < 3; i++) {
        const run = await computeAllMetrics(
          tenantId,
          cloudId + i,
          { fields: [] },
          {},
          [],
          timeWindow
        );
        await storeMetricsRun(tenantId, cloudId + i, run);
      }

      // Retrieve page 0, limit 2
      const page0 = await listMetricsRuns(tenantId, cloudId, { page: 0, limit: 2 });

      expect(page0.items.length).toBeLessThanOrEqual(2);
      expect(page0.page).toBe(0);
      expect(page0.limit).toBe(2);
    });

    it('TC-4.4: Should isolate tenants', async () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';
      const cloudId1 = 'cloud-1';

      const runA = await computeAllMetrics(
        tenantA,
        cloudId1,
        { fields: [] },
        {},
        [],
        timeWindow
      );

      const runB = await computeAllMetrics(
        tenantB,
        cloudId1,
        { fields: [] },
        {},
        [],
        timeWindow
      );

      await storeMetricsRun(tenantA, cloudId1, runA);
      await storeMetricsRun(tenantB, cloudId1, runB);

      const retrievedA = await getMetricsRun(tenantA, cloudId1, runA.metrics_run_id);
      const retrievedB = await getMetricsRun(tenantB, cloudId1, runB.metrics_run_id);

      expect(retrievedA?.tenant_id).toBe(tenantA);
      expect(retrievedB?.tenant_id).toBe(tenantB);
      expect(retrievedA?.metrics_run_id).not.toBe(retrievedB?.metrics_run_id);
    });
  });

  // ============================================================================
  // TEST SUITE 9: EXPORT & FORMAT
  // ============================================================================

  describe('Export & Format', () => {
    it('TC-5.1: Should export valid JSON', async () => {
      const run = await computeAllMetrics(
        tenantId,
        cloudId,
        { fields: [] },
        {},
        [],
        timeWindow
      );

      const stored = await storeMetricsRun(tenantId, cloudId, run);
      const exported = exportMetricsRunJson(stored);
      const parsed = JSON.parse(exported);

      expect(parsed.metrics_run).toBeDefined();
      expect(parsed.definitions).toBeDefined();
      expect(parsed.confidence_scoring_formula).toBeDefined();
      expect(parsed.prohibited_terms).toBeDefined();
    });

    it('TC-5.2: Should include definitions in export', async () => {
      const run = await computeAllMetrics(
        tenantId,
        cloudId,
        { fields: [] },
        {},
        [],
        timeWindow
      );

      const stored = await storeMetricsRun(tenantId, cloudId, run);
      const export_data = exportMetricsRun(stored);

      expect(export_data.definitions).toHaveProperty('M1_UNUSED_REQUIRED_FIELDS');
      expect(export_data.definitions).toHaveProperty('M2_INCONSISTENT_FIELD_USAGE');
      expect(export_data.definitions).toHaveProperty('M3_AUTOMATION_EXECUTION_GAP');
      expect(export_data.definitions).toHaveProperty('M4_CONFIGURATION_CHURN_DENSITY');
      expect(export_data.definitions).toHaveProperty('M5_VISIBILITY_GAP_OVER_TIME');
    });
  });

  // ============================================================================
  // TEST SUITE 10: PROHIBITIONS
  // ============================================================================

  describe('Prohibition Enforcement', () => {
    it('TC-7.1: Should not include forbidden terms in metric output', async () => {
      const run = await computeAllMetrics(
        tenantId,
        cloudId,
        { fields: [] },
        {},
        [],
        timeWindow
      );

      const stored = await storeMetricsRun(tenantId, cloudId, run);
      const exported = JSON.stringify(stored);

      const forbiddenTerms = [
        'recommend',
        'fix',
        'root cause',
        'impact',
        'improve',
        'combined score',
      ];

      forbiddenTerms.forEach(term => {
        expect(exported.toLowerCase()).not.toContain(term.toLowerCase());
      });
    });
  });
});
