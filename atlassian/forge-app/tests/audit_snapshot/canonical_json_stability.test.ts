/**
 * Phase 5: Canonical JSON Stability Test
 * 
 * Verifies that canonical JSON is deterministic:
 * same snapshot data => identical canonical JSON string
 */

import { describe, it, expect } from 'vitest';
import { toCanonicalJson } from '../../src/core/audit_snapshot/canonicalJson';
import { TrustSnapshot } from '../../src/core/audit_snapshot/types';

describe('Canonical JSON Stability', () => {
    it('should produce identical JSON for same object', () => {
        const snapshot1: TrustSnapshot = {
            generatedAtISO: '2026-01-05T10:00:00Z',
            window: 'point-in-time',
            operationalState: {
                status: 'RUNNING',
                lastSuccessfulRunAtISO: '2026-01-05T09:00:00Z',
                consecutiveDaysOperational: 10,
            },
            monitoringContinuity: {
                schedulerActive: true,
                lastRunAtISO: '2026-01-05T09:30:00Z',
                dataCompleteness: 'COMPLETE',
            },
            configurationRiskSummary: {
                riskBand: 'LOW',
                metricsIncluded: ['metric1', 'metric2'],
                evaluatedAtISO: '2026-01-05T09:00:00Z',
            },
            changeSummary: {
                window: 'last-30d',
                eventCount: 5,
                categoriesPresent: ['setting-change'],
                lastChangeAtISO: '2026-01-05T08:00:00Z',
            },
            appBehaviorGuarantees: {
                readOnly: true,
                noJiraWrites: true,
                noConfigChanges: true,
                noEnforcement: true,
            },
            versioning: {
                appVersion: 'v2.14.0',
                environment: 'production',
                deployedAtISO: null,
            },
            completeness: 'COMPLETE',
            issues: [],
        };

        const snapshot2: TrustSnapshot = {
            generatedAtISO: '2026-01-05T10:00:00Z',
            window: 'point-in-time',
            operationalState: {
                status: 'RUNNING',
                lastSuccessfulRunAtISO: '2026-01-05T09:00:00Z',
                consecutiveDaysOperational: 10,
            },
            monitoringContinuity: {
                schedulerActive: true,
                lastRunAtISO: '2026-01-05T09:30:00Z',
                dataCompleteness: 'COMPLETE',
            },
            configurationRiskSummary: {
                riskBand: 'LOW',
                metricsIncluded: ['metric1', 'metric2'],
                evaluatedAtISO: '2026-01-05T09:00:00Z',
            },
            changeSummary: {
                window: 'last-30d',
                eventCount: 5,
                categoriesPresent: ['setting-change'],
                lastChangeAtISO: '2026-01-05T08:00:00Z',
            },
            appBehaviorGuarantees: {
                readOnly: true,
                noJiraWrites: true,
                noConfigChanges: true,
                noEnforcement: true,
            },
            versioning: {
                appVersion: 'v2.14.0',
                environment: 'production',
                deployedAtISO: null,
            },
            completeness: 'COMPLETE',
            issues: [],
        };

        const json1 = toCanonicalJson(snapshot1);
        const json2 = toCanonicalJson(snapshot2);

        expect(json1).toBe(json2);
    });

    it('should sort object keys lexicographically', () => {
        const obj = { z: 1, a: 2, m: 3 };
        const json = toCanonicalJson(obj);
        expect(json).toBe('{"a":2,"m":3,"z":1}');
    });

    it('should preserve array order', () => {
        const obj = { items: [3, 1, 2] };
        const json = toCanonicalJson(obj);
        expect(json).toBe('{"items":[3,1,2]}');
    });

    it('should handle nested objects with sorting', () => {
        const obj = {
            z: { b: 2, a: 1 },
            a: { y: 3, x: 4 },
        };
        const json = toCanonicalJson(obj);
        expect(json).toBe('{"a":{"x":4,"y":3},"z":{"a":1,"b":2}}');
    });

    it('should handle null values correctly', () => {
        const obj = { a: null, b: 'value' };
        const json = toCanonicalJson(obj);
        expect(json).toBe('{"a":null,"b":"value"}');
    });

    it('should be UTF-8 compatible', () => {
        const obj = { name: '測試' };
        const json = toCanonicalJson(obj);
        expect(json).toContain('測試');
    });
});
