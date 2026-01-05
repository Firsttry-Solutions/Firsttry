/**
 * UNIT TESTS: ConfigRisk Computation
 * 
 * Tests for deterministic risk band computation
 * - Completeness transitions (EMPTY/PARTIAL/COMPLETE)
 * - Exact threshold boundaries for each metric
 * - Overall risk band max-severity rule
 * - Determinism (same input -> same output)
 */

import { describe, it, expect } from 'vitest';
import { computeConfigRisk } from '../../src/core/config_visibility/computeConfigRisk';
import { ConfigMetrics } from '../../src/core/config_visibility/types';

describe('computeConfigRisk', () => {
  const baseTime = '2026-01-05T12:00:00Z';

  describe('completeness transitions', () => {
    it('EMPTY: all metrics null', () => {
      const metrics: ConfigMetrics = {
        customFieldCount: null,
        workflowCount: null,
        workflowSchemeCount: null,
        maxWorkflowsPerScheme: null,
        screenCount: null,
        permissionSchemeCount: null,
        maxProjectsPerPermissionScheme: null,
      };

      const result = computeConfigRisk(metrics, baseTime);
      expect(result.completeness).toBe('EMPTY');
      expect(result.riskBand).toBe('LOW'); // neutral default
    });

    it('PARTIAL: some null, some non-null', () => {
      const metrics: ConfigMetrics = {
        customFieldCount: 100,
        workflowCount: null,
        workflowSchemeCount: null,
        maxWorkflowsPerScheme: null,
        screenCount: 150,
        permissionSchemeCount: null,
        maxProjectsPerPermissionScheme: null,
      };

      const result = computeConfigRisk(metrics, baseTime);
      expect(result.completeness).toBe('PARTIAL');
    });

    it('COMPLETE: all metrics non-null', () => {
      const metrics: ConfigMetrics = {
        customFieldCount: 100,
        workflowCount: 50,
        workflowSchemeCount: 25,
        maxWorkflowsPerScheme: 10,
        screenCount: 100,
        permissionSchemeCount: 25,
        maxProjectsPerPermissionScheme: 5,
      };

      const result = computeConfigRisk(metrics, baseTime);
      expect(result.completeness).toBe('COMPLETE');
    });
  });

  describe('customFieldCount thresholds', () => {
    const baseMetrics: ConfigMetrics = {
      customFieldCount: 0,
      workflowCount: null,
      workflowSchemeCount: null,
      maxWorkflowsPerScheme: null,
      screenCount: null,
      permissionSchemeCount: null,
      maxProjectsPerPermissionScheme: null,
    };

    it('LOW: <= 250', () => {
      const metrics = { ...baseMetrics, customFieldCount: 250 };
      expect(computeConfigRisk(metrics, baseTime).riskBand).toBe('LOW');
    });

    it('MEDIUM: 251-1000', () => {
      const metrics = { ...baseMetrics, customFieldCount: 251 };
      expect(computeConfigRisk(metrics, baseTime).riskBand).toBe('MEDIUM');

      const metrics2 = { ...baseMetrics, customFieldCount: 1000 };
      expect(computeConfigRisk(metrics2, baseTime).riskBand).toBe('MEDIUM');
    });

    it('HIGH: > 1000', () => {
      const metrics = { ...baseMetrics, customFieldCount: 1001 };
      expect(computeConfigRisk(metrics, baseTime).riskBand).toBe('HIGH');
    });
  });

  describe('workflowCount thresholds', () => {
    const baseMetrics: ConfigMetrics = {
      customFieldCount: null,
      workflowCount: 0,
      workflowSchemeCount: null,
      maxWorkflowsPerScheme: null,
      screenCount: null,
      permissionSchemeCount: null,
      maxProjectsPerPermissionScheme: null,
    };

    it('LOW: <= 100', () => {
      const metrics = { ...baseMetrics, workflowCount: 100 };
      expect(computeConfigRisk(metrics, baseTime).riskBand).toBe('LOW');
    });

    it('MEDIUM: 101-500', () => {
      const metrics = { ...baseMetrics, workflowCount: 101 };
      expect(computeConfigRisk(metrics, baseTime).riskBand).toBe('MEDIUM');

      const metrics2 = { ...baseMetrics, workflowCount: 500 };
      expect(computeConfigRisk(metrics2, baseTime).riskBand).toBe('MEDIUM');
    });

    it('HIGH: > 500', () => {
      const metrics = { ...baseMetrics, workflowCount: 501 };
      expect(computeConfigRisk(metrics, baseTime).riskBand).toBe('HIGH');
    });
  });

  describe('overall risk band: max severity rule', () => {
    it('HIGH wins over MEDIUM', () => {
      const metrics: ConfigMetrics = {
        customFieldCount: 100, // LOW
        workflowCount: 300, // MEDIUM
        workflowSchemeCount: 250, // HIGH (> 200)
        maxWorkflowsPerScheme: null,
        screenCount: null,
        permissionSchemeCount: null,
        maxProjectsPerPermissionScheme: null,
      };

      expect(computeConfigRisk(metrics, baseTime).riskBand).toBe('HIGH');
    });

    it('MEDIUM wins over LOW', () => {
      const metrics: ConfigMetrics = {
        customFieldCount: 100, // LOW
        workflowCount: 200, // MEDIUM
        workflowSchemeCount: null,
        maxWorkflowsPerScheme: null,
        screenCount: null,
        permissionSchemeCount: null,
        maxProjectsPerPermissionScheme: null,
      };

      expect(computeConfigRisk(metrics, baseTime).riskBand).toBe('MEDIUM');
    });

    it('All LOW stays LOW', () => {
      const metrics: ConfigMetrics = {
        customFieldCount: 100,
        workflowCount: 50,
        workflowSchemeCount: 25,
        maxWorkflowsPerScheme: 10,
        screenCount: 100,
        permissionSchemeCount: 25,
        maxProjectsPerPermissionScheme: 5,
      };

      expect(computeConfigRisk(metrics, baseTime).riskBand).toBe('LOW');
    });
  });

  describe('determinism', () => {
    it('same input always produces same output', () => {
      const metrics: ConfigMetrics = {
        customFieldCount: 500,
        workflowCount: 250,
        workflowSchemeCount: 100,
        maxWorkflowsPerScheme: 50,
        screenCount: 400,
        permissionSchemeCount: 75,
        maxProjectsPerPermissionScheme: 30,
      };

      const result1 = computeConfigRisk(metrics, baseTime);
      const result2 = computeConfigRisk(metrics, baseTime);

      expect(result1).toEqual(result2);
      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });
  });

  describe('snapshot structure', () => {
    it('always includes required fields', () => {
      const metrics: ConfigMetrics = {
        customFieldCount: 100,
        workflowCount: null,
        workflowSchemeCount: null,
        maxWorkflowsPerScheme: null,
        screenCount: null,
        permissionSchemeCount: null,
        maxProjectsPerPermissionScheme: null,
      };

      const result = computeConfigRisk(metrics, baseTime, []);

      expect(result.metrics).toBeDefined();
      expect(result.riskBand).toBeDefined();
      expect(result.evaluatedAtISO).toBe(baseTime);
      expect(result.completeness).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.mode).toBe('scheduled-read-only');
      expect(result.boundaries).toBeDefined();
      expect(result.boundaries.noJiraWrites).toBe(true);
      expect(result.boundaries.noConfigChanges).toBe(true);
      expect(result.boundaries.noEnforcement).toBe(true);
    });

    it('issues are included in snapshot', () => {
      const metrics: ConfigMetrics = {
        customFieldCount: null,
        workflowCount: null,
        workflowSchemeCount: null,
        maxWorkflowsPerScheme: null,
        screenCount: null,
        permissionSchemeCount: null,
        maxProjectsPerPermissionScheme: null,
      };

      const issues = [
        {
          metric: 'customFieldCount' as const,
          reason: 'Test failure',
          errorCode: 'JIRA_403',
        },
      ];

      const result = computeConfigRisk(metrics, baseTime, issues);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].metric).toBe('customFieldCount');
    });
  });
});
