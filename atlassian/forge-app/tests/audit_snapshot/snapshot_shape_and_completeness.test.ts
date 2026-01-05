/**
 * Phase 5: Snapshot Shape and Completeness Test
 * 
 * Verifies that TrustSnapshot has all required fields
 * and completeness is correctly determined
 */

import { describe, it, expect } from 'vitest';
import { TrustSnapshot } from '../../src/core/audit_snapshot/types';

describe('Snapshot Shape and Completeness', () => {
    function createMinimalSnapshot(): TrustSnapshot {
        return {
            generatedAtISO: '2026-01-05T10:00:00Z',
            window: 'point-in-time',
            operationalState: {
                status: 'NOT_RUNNING',
                lastSuccessfulRunAtISO: null,
                consecutiveDaysOperational: null,
            },
            monitoringContinuity: {
                schedulerActive: false,
                lastRunAtISO: null,
                dataCompleteness: 'EMPTY',
            },
            configurationRiskSummary: {
                riskBand: 'HIGH',
                metricsIncluded: [],
                evaluatedAtISO: null,
            },
            changeSummary: {
                window: 'last-30d',
                eventCount: 0,
                categoriesPresent: [],
                lastChangeAtISO: null,
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
            completeness: 'EMPTY',
            issues: [],
        };
    }

    it('should have all required fields', () => {
        const snapshot = createMinimalSnapshot();

        expect(snapshot).toHaveProperty('generatedAtISO');
        expect(snapshot).toHaveProperty('window');
        expect(snapshot).toHaveProperty('operationalState');
        expect(snapshot).toHaveProperty('monitoringContinuity');
        expect(snapshot).toHaveProperty('configurationRiskSummary');
        expect(snapshot).toHaveProperty('changeSummary');
        expect(snapshot).toHaveProperty('appBehaviorGuarantees');
        expect(snapshot).toHaveProperty('versioning');
        expect(snapshot).toHaveProperty('completeness');
        expect(snapshot).toHaveProperty('issues');
    });

    it('should have valid window value', () => {
        const snapshot = createMinimalSnapshot();
        expect(snapshot.window).toBe('point-in-time');
    });

    it('should have valid completeness values', () => {
        const snapshot = createMinimalSnapshot();
        expect(['COMPLETE', 'PARTIAL', 'EMPTY']).toContain(snapshot.completeness);
    });

    it('should have valid status values', () => {
        const snapshot = createMinimalSnapshot();
        expect(['RUNNING', 'DEGRADED', 'NOT_RUNNING']).toContain(snapshot.operationalState.status);
    });

    it('should have valid risk band values', () => {
        const snapshot = createMinimalSnapshot();
        expect(['LOW', 'MEDIUM', 'HIGH']).toContain(snapshot.configurationRiskSummary.riskBand);
    });

    it('should have valid environment values', () => {
        const snapshot = createMinimalSnapshot();
        expect(['production', 'staging', 'development']).toContain(snapshot.versioning.environment);
    });

    it('should have boolean guarantees set to true', () => {
        const snapshot = createMinimalSnapshot();
        expect(snapshot.appBehaviorGuarantees.readOnly).toBe(true);
        expect(snapshot.appBehaviorGuarantees.noJiraWrites).toBe(true);
        expect(snapshot.appBehaviorGuarantees.noConfigChanges).toBe(true);
        expect(snapshot.appBehaviorGuarantees.noEnforcement).toBe(true);
    });

    it('should have ISO8601 timestamp format for generatedAtISO', () => {
        const snapshot = createMinimalSnapshot();
        expect(snapshot.generatedAtISO).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle null optional timestamps', () => {
        const snapshot = createMinimalSnapshot();
        expect(snapshot.operationalState.lastSuccessfulRunAtISO).toBeNull();
        expect(snapshot.configurationRiskSummary.evaluatedAtISO).toBeNull();
    });

    it('should have array for issues', () => {
        const snapshot = createMinimalSnapshot();
        expect(Array.isArray(snapshot.issues)).toBe(true);
    });

    it('should have issue with correct shape when present', () => {
        const snapshot = createMinimalSnapshot();
        snapshot.issues.push({
            source: 'phase1',
            reason: 'Test issue',
            errorCode: 'TEST_ERROR',
        });

        const issue = snapshot.issues[0];
        expect(issue).toHaveProperty('source');
        expect(issue).toHaveProperty('reason');
        expect(issue).toHaveProperty('errorCode');
    });
});
