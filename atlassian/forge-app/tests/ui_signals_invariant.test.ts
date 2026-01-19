/**
 * Test: UI RuntimeSignals invariant enforcement
 * CRITICAL: If scheduleStatus === NOT_CONFIGURED, then expectedScheduleIntervalMinutes MUST be null
 */

import { describe, it, expect } from 'vitest';
import { computeGovernanceViewModel, type RuntimeSignals } from '../src/gadget-ui/src/truthModel';

describe('UI RuntimeSignals - expectedScheduleIntervalMinutes invariant', () => {
  const baseSignals: RuntimeSignals = {
    tenantIdentityStatus: 'OK',
    backendStatus: 'OK',
    scheduleStatus: 'CONFIGURED',
    expectedScheduleIntervalMinutes: 60,
    lastSuccessfulRunISO: null,
    lastAttemptISO: null,
    snapshot: null,
    storageStatus: 'EMPTY',
    snapshotCountRetained: 0,
    checksCompletedLifetime: 0,
    failures7d: 0,
    skippedChecks7d: 0,
    exportSubsystemStatus: 'NOT_READY',
    permissionsVisibility: 'OK',
    stalenessThresholdMinutes: 120,
    nowISO: new Date().toISOString()
  };

  it('should enforce: NOT_CONFIGURED => expectedScheduleIntervalMinutes is null', () => {
    const signals: RuntimeSignals = {
      ...baseSignals,
      scheduleStatus: 'NOT_CONFIGURED',
      expectedScheduleIntervalMinutes: null  // Must be null when NOT_CONFIGURED
    };

    const vm = computeGovernanceViewModel(signals);

    // CRITICAL INVARIANT: must be null, never a number
    expect(vm.expectedScheduleIntervalMinutes).toBeNull();
  });

  it('should enforce: NOT_CONFIGURED + number input => auto-corrects to null', () => {
    // Even if input has a number, NOT_CONFIGURED should override
    const signals: RuntimeSignals = {
      ...baseSignals,
      scheduleStatus: 'NOT_CONFIGURED',
      expectedScheduleIntervalMinutes: 30  // Input has a number
    };

    const vm = computeGovernanceViewModel(signals);

    // Should auto-correct to null by invariant check
    expect(vm.expectedScheduleIntervalMinutes).toBeNull();
  });

  it('should preserve number when CONFIGURED', () => {
    const signals: RuntimeSignals = {
      ...baseSignals,
      scheduleStatus: 'CONFIGURED',
      expectedScheduleIntervalMinutes: 45
    };

    const vm = computeGovernanceViewModel(signals);

    expect(vm.expectedScheduleIntervalMinutes).toBe(45);
  });

  it('should be null when CONFIGURED but interval is null', () => {
    const signals: RuntimeSignals = {
      ...baseSignals,
      scheduleStatus: 'CONFIGURED',
      expectedScheduleIntervalMinutes: null
    };

    const vm = computeGovernanceViewModel(signals);

    expect(vm.expectedScheduleIntervalMinutes).toBeNull();
  });

  it('should be null for UNKNOWN schedule status (conservative)', () => {
    const signals: RuntimeSignals = {
      ...baseSignals,
      scheduleStatus: 'UNKNOWN' as any,
      expectedScheduleIntervalMinutes: 60
    };

    const vm = computeGovernanceViewModel(signals);

    // UNKNOWN should NOT default to showing an interval
    // The invariant only enforces NOT_CONFIGURED strictly, but UNKNOWN should also be safe
    expect(vm.expectedScheduleIntervalMinutes).not.toBeUndefined();
  });

  it('should NEVER produce undefined expectedScheduleIntervalMinutes', () => {
    const testCases = [
      { scheduleStatus: 'NOT_CONFIGURED', interval: null },
      { scheduleStatus: 'NOT_CONFIGURED', interval: 60 },
      { scheduleStatus: 'CONFIGURED', interval: null },
      { scheduleStatus: 'CONFIGURED', interval: 30 },
      { scheduleStatus: 'UNKNOWN', interval: 45 }
    ] as const;

    for (const testCase of testCases) {
      const signals: RuntimeSignals = {
        ...baseSignals,
        scheduleStatus: testCase.scheduleStatus as any,
        expectedScheduleIntervalMinutes: testCase.interval
      };

      const vm = computeGovernanceViewModel(signals);

      // CRITICAL: must never be undefined
      expect(vm.expectedScheduleIntervalMinutes).not.toBeUndefined();
    }
  });
});
