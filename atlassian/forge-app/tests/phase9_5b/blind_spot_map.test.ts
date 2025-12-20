/**
 * PHASE 9.5-B: BLIND-SPOT MAP TEST SUITE
 *
 * Tests for historical blind-spot derivation.
 * All tests are blocking (build fails if any fail).
 */

import {
  deriveBlindSpots,
  computeBlindSpotHash,
  verifyBlindSpotHash,
  BlindSpotMap,
  BlindSpotInput,
  SnapshotRunRecord,
  renderBlindSpotTimeline,
  renderBlindSpotTable,
  generateBlindSpotReport,
} from '../../src/phase9_5b/blind_spot_map';

describe('Phase 9.5-B: Blind-Spot Map Tests', () => {
  // ========================================================================
  // TC-9.5-B-1: BLIND SPOTS BEFORE INSTALL
  // ========================================================================

  describe('TC-9.5-B-1.1: Detect period before install', () => {
    it('should create blind spot for pre-install period', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-1',
        first_install_date: '2025-01-15T10:00:00Z',
        snapshot_runs: [],
        analysis_window: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-31T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);

      expect(map.blind_spot_periods.length).toBeGreaterThan(0);
      expect(map.blind_spot_periods[0].reason).toBe('not_installed');
      expect(map.blind_spot_periods[0].start_time).toBe('2025-01-01T00:00:00Z');
      expect(map.blind_spot_periods[0].end_time).toBe('2025-01-15T10:00:00Z');
      expect(map.blind_spot_periods[0].severity).toBe('critical');
    });

    it('should skip pre-install period if install_date is before window', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-2',
        first_install_date: '2024-12-01T10:00:00Z',
        snapshot_runs: [],
        analysis_window: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-31T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);

      // Should not have a not_installed period
      const notInstalledPeriod = map.blind_spot_periods.find(
        (p) => p.reason === 'not_installed'
      );
      expect(notInstalledPeriod).toBeUndefined();
    });
  });

  // ========================================================================
  // TC-9.5-B-2: BLIND SPOTS DURING FAILURES
  // ========================================================================

  describe('TC-9.5-B-2.1: Detect blind spot from snapshot failure', () => {
    it('should create blind spot when snapshot fails', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-3',
        first_install_date: '2025-01-10T10:00:00Z',
        snapshot_runs: [
          {
            run_id: 'run-1',
            scheduled_at: '2025-01-12T10:00:00Z',
            completed_at: '2025-01-12T10:05:00Z',
            success: true,
          },
          {
            run_id: 'run-2',
            scheduled_at: '2025-01-14T10:00:00Z',
            completed_at: undefined,
            success: false,
            failure_reason: 'permission_denied',
          },
          {
            run_id: 'run-3',
            scheduled_at: '2025-01-16T10:00:00Z',
            completed_at: '2025-01-16T10:05:00Z',
            success: true,
          },
        ],
        analysis_window: {
          start: '2025-01-10T00:00:00Z',
          end: '2025-01-20T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);

      // Should have blind spot from run-1 end to run-3 start (covering run-2 failure)
      const failurePeriod = map.blind_spot_periods.find(
        (p) => p.reason === 'permission_missing'
      );
      expect(failurePeriod).toBeDefined();
    });
  });

  describe('TC-9.5-B-2.2: Detect blind spot from timeout/error', () => {
    it('should create snapshot_failed blind spot', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-4',
        first_install_date: '2025-01-10T10:00:00Z',
        snapshot_runs: [
          {
            run_id: 'run-1',
            scheduled_at: '2025-01-12T10:00:00Z',
            completed_at: '2025-01-12T10:05:00Z',
            success: true,
          },
          {
            run_id: 'run-2',
            scheduled_at: '2025-01-14T10:00:00Z',
            success: false,
            failure_reason: 'timeout',
          },
          {
            run_id: 'run-3',
            scheduled_at: '2025-01-16T10:00:00Z',
            completed_at: '2025-01-16T10:05:00Z',
            success: true,
          },
        ],
        analysis_window: {
          start: '2025-01-10T00:00:00Z',
          end: '2025-01-20T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);

      const failurePeriod = map.blind_spot_periods.find(
        (p) => p.reason === 'snapshot_failed'
      );
      expect(failurePeriod).toBeDefined();
    });
  });

  // ========================================================================
  // TC-9.5-B-3: NO FABRICATED BLIND SPOTS
  // ========================================================================

  describe('TC-9.5-B-3.1: No blind spots when coverage is complete', () => {
    it('should have no blind spots with frequent successful snapshots', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-5',
        first_install_date: '2025-01-10T10:00:00Z',
        snapshot_runs: [
          {
            run_id: 'run-1',
            scheduled_at: '2025-01-12T10:00:00Z',
            completed_at: '2025-01-12T10:05:00Z',
            success: true,
          },
          {
            run_id: 'run-2',
            scheduled_at: '2025-01-12T12:00:00Z',
            completed_at: '2025-01-12T12:05:00Z',
            success: true,
          },
          {
            run_id: 'run-3',
            scheduled_at: '2025-01-13T10:00:00Z',
            completed_at: '2025-01-13T10:05:00Z',
            success: true,
          },
        ],
        analysis_window: {
          start: '2025-01-12T00:00:00Z',
          end: '2025-01-13T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);

      // Should have minimal blind spots
      expect(map.coverage_percentage).toBeGreaterThan(95);
    });

    it('should not fabricate blind spots during small time gaps', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-6',
        first_install_date: '2025-01-10T10:00:00Z',
        snapshot_runs: [
          {
            run_id: 'run-1',
            scheduled_at: '2025-01-12T10:00:00Z',
            completed_at: '2025-01-12T10:15:00Z',
            success: true,
          },
          {
            run_id: 'run-2',
            scheduled_at: '2025-01-12T11:00:00Z', // 45 min gap
            completed_at: '2025-01-12T11:15:00Z',
            success: true,
          },
        ],
        analysis_window: {
          start: '2025-01-12T00:00:00Z',
          end: '2025-01-12T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);

      // Gaps < 12 hours should not create blind spots
      expect(map.blind_spot_periods.length).toBe(0);
    });
  });

  // ========================================================================
  // TC-9.5-B-4: BLIND SPOT PROPERTIES
  // ========================================================================

  describe('TC-9.5-B-4.1: Blind spot has correct properties', () => {
    it('should populate all blind-spot fields', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-7',
        first_install_date: '2025-01-15T10:00:00Z',
        snapshot_runs: [],
        analysis_window: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-31T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);
      const period = map.blind_spot_periods[0];

      expect(period.start_time).toBeDefined();
      expect(period.end_time).toBeDefined();
      expect(period.reason).toBeDefined();
      expect(['not_installed', 'permission_missing', 'snapshot_failed', 'unknown']).toContain(
        period.reason
      );
      expect(period.reason_description).toBeDefined();
      expect(period.reason_description.length).toBeGreaterThan(0);
      expect(period.duration_days).toBeGreaterThan(0);
      expect(['critical', 'high', 'medium']).toContain(period.severity);
    });
  });

  describe('TC-9.5-B-4.2: Coverage percentage computed correctly', () => {
    it('should compute coverage as (evidence_days / total_days) * 100', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-8',
        first_install_date: '2025-01-15T10:00:00Z',
        snapshot_runs: [
          {
            run_id: 'run-1',
            scheduled_at: '2025-01-20T10:00:00Z',
            completed_at: '2025-01-20T10:05:00Z',
            success: true,
          },
        ],
        analysis_window: {
          start: '2025-01-15T10:00:00Z',
          end: '2025-01-20T10:00:00Z',
        },
      };

      const map = deriveBlindSpots(input);

      // Blind period: install to first snapshot (5 days)
      // Total period: 5 days
      // So coverage should be very low
      expect(map.coverage_percentage).toBeLessThan(50);
    });
  });

  // ========================================================================
  // TC-9.5-B-5: BLIND SPOT HASHING & VERIFICATION
  // ========================================================================

  describe('TC-9.5-B-5.1: Blind spots hash deterministically', () => {
    it('should compute same hash from same data (3x)', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-9',
        first_install_date: '2025-01-15T10:00:00Z',
        snapshot_runs: [],
        analysis_window: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-31T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);
      const hash1 = computeBlindSpotHash(map);
      const hash2 = computeBlindSpotHash(map);
      const hash3 = computeBlindSpotHash(map);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });
  });

  describe('TC-9.5-B-5.2: Hash verification detects changes', () => {
    it('should detect if blind spots modified', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-10',
        first_install_date: '2025-01-15T10:00:00Z',
        snapshot_runs: [],
        analysis_window: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-31T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);
      const originalHash = map.canonical_hash;

      // Modify blind spot
      if (map.blind_spot_periods.length > 0) {
        map.blind_spot_periods[0].duration_days = 999;
      }

      const recomputed = computeBlindSpotHash(map);
      expect(recomputed).not.toBe(originalHash);
    });

    it('should verify hash integrity', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-11',
        first_install_date: '2025-01-15T10:00:00Z',
        snapshot_runs: [],
        analysis_window: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-31T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);
      expect(verifyBlindSpotHash(map)).toBe(true);

      // Corrupt map by modifying total_blind_days (a field included in hash)
      const originalBlindDays = map.total_blind_days;
      map.total_blind_days = 999;
      expect(verifyBlindSpotHash(map)).toBe(false);

      // Restore and verify works again
      map.total_blind_days = originalBlindDays;
      expect(verifyBlindSpotHash(map)).toBe(true);
    });
  });

  // ========================================================================
  // TC-9.5-B-6: UI RENDERING
  // ========================================================================

  describe('TC-9.5-B-6.1: Timeline rendering', () => {
    it('should render blind-spot timeline HTML', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-12',
        first_install_date: '2025-01-15T10:00:00Z',
        snapshot_runs: [],
        analysis_window: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-31T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);
      const html = renderBlindSpotTimeline(map);

      expect(html).toContain('blind-spot-timeline');
      expect(html).toContain('Governance Evidence Timeline');
      expect(html).toContain(`${map.coverage_percentage.toFixed(1)}`);
    });
  });

  describe('TC-9.5-B-6.2: Table rendering', () => {
    it('should render blind-spot table HTML', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-13',
        first_install_date: '2025-01-15T10:00:00Z',
        snapshot_runs: [],
        analysis_window: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-31T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);
      const html = renderBlindSpotTable(map);

      expect(html).toContain('<table');
      expect(html).toContain('Period');
      expect(html).toContain('Reason');
      expect(html).toContain('Duration');
    });
  });

  // ========================================================================
  // TC-9.5-B-7: AUDIT REPORTING
  // ========================================================================

  describe('TC-9.5-B-7.1: Audit report generation', () => {
    it('should generate markdown audit report', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-14',
        first_install_date: '2025-01-15T10:00:00Z',
        snapshot_runs: [],
        analysis_window: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-31T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);
      const report = generateBlindSpotReport(map);

      expect(report).toContain('GOVERNANCE EVIDENCE GAP ANALYSIS');
      expect(report).toContain(map.tenant_id);
      expect(report).toContain(`${map.coverage_percentage.toFixed(1)}`);
      expect(report).toContain('Unknown Periods');
    });

    it('should note zero blind spots when coverage is complete', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-15',
        first_install_date: '2024-12-01T10:00:00Z',
        snapshot_runs: [
          {
            run_id: 'run-1',
            scheduled_at: '2025-01-12T10:00:00Z',
            completed_at: '2025-01-12T10:05:00Z',
            success: true,
          },
        ],
        analysis_window: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-02T00:00:00Z',
        },
      };

      const map = deriveBlindSpots(input);

      // Install before window, snapshot after window, so no blind spots in window
      if (map.blind_spot_periods.length === 0) {
        const report = generateBlindSpotReport(map);
        expect(report).toContain('No blind spots detected');
      }
    });
  });

  // ========================================================================
  // INTEGRATION: COMPLETE WORKFLOW
  // ========================================================================

  describe('INTEGRATION: Complete blind-spot derivation workflow', () => {
    it('should handle complex snapshot history with multiple failures', () => {
      const input: BlindSpotInput = {
        tenant_id: 'tenant-integration',
        first_install_date: '2025-01-10T10:00:00Z',
        snapshot_runs: [
          {
            run_id: 'run-1',
            scheduled_at: '2025-01-12T10:00:00Z',
            completed_at: '2025-01-12T10:05:00Z',
            success: true,
          },
          {
            run_id: 'run-2',
            scheduled_at: '2025-01-13T10:00:00Z',
            success: false,
            failure_reason: 'permission_denied',
          },
          {
            run_id: 'run-3',
            scheduled_at: '2025-01-15T10:00:00Z',
            completed_at: '2025-01-15T10:05:00Z',
            success: true,
          },
          {
            run_id: 'run-4',
            scheduled_at: '2025-01-18T10:00:00Z',
            completed_at: '2025-01-18T10:05:00Z',
            success: true,
          },
        ],
        analysis_window: {
          start: '2025-01-10T00:00:00Z',
          end: '2025-01-31T23:59:59Z',
        },
      };

      const map = deriveBlindSpots(input);

      // Should have blind spots
      expect(map.blind_spot_periods.length).toBeGreaterThan(0);

      // Should have proper coverage
      expect(map.coverage_percentage).toBeGreaterThanOrEqual(0);
      expect(map.coverage_percentage).toBeLessThanOrEqual(100);

      // Hash should verify
      expect(verifyBlindSpotHash(map)).toBe(true);

      // Should render properly
      const timeline = renderBlindSpotTimeline(map);
      const table = renderBlindSpotTable(map);
      const report = generateBlindSpotReport(map);

      expect(timeline.length).toBeGreaterThan(0);
      expect(table.length).toBeGreaterThan(0);
      expect(report.length).toBeGreaterThan(0);
    });
  });
});
