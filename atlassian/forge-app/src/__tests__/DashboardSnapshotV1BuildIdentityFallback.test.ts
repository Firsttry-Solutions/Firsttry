/**
 * Test: Dashboard Build Identity Fallback
 *
 * Validates that UI never renders "NOT_AVAILABLE" when backend provides build identity values.
 * Ensures backend_git_sha and backend_build_time_utc are used as fallback when buildInfo missing.
 */

import { describe, it, expect } from 'vitest';
import { mapL0SnapshotResponse } from '../gadget-ui/src/l0_snapshot_mapper';

describe('Dashboard Build Identity Fallback', () => {
  
  it('should render backend build SHA when buildInfo.buildSha is missing', () => {
    const response = {
      data: {
        status: 'AVAILABLE',
        snapshotId: 'test-123',
        createdAtUtc: '2026-02-03T14:00:00Z',
        schemaVersion: 'L0',
        backend_git_sha: '91884ff67c435497b5456501df540bd7f920c1a4',
        backend_build_time_utc: '2026-02-03T13:13:16Z',
        backend_app_version: '2.14.0',
      },
    };

    const state = mapL0SnapshotResponse(response);

    // Verify state has backend fields captured
    expect(state.backendBuildSha).toBe('91884ff67c435497b5456501df540bd7f920c1a4');
    expect(state.backendBuildTimeUtc).toBe('2026-02-03T13:13:16Z');

    // In rendering context (verified by l0_snapshot_mapper.ts logic):
    // buildSha fallback: buildInfo?.buildSha || backendBuildSha
    const displayedBuildSha = state.buildInfo?.buildSha || state.backendBuildSha || "NOT_AVAILABLE";
    expect(displayedBuildSha).not.toBe("NOT_AVAILABLE");
    expect(displayedBuildSha).toBe('91884ff67c435497b5456501df540bd7f920c1a4');
  });

  it('should render backend build time when buildInfo.buildTimeUtc is missing', () => {
    const response = {
      data: {
        status: 'AVAILABLE',
        snapshotId: 'test-456',
        createdAtUtc: '2026-02-03T14:00:00Z',
        schemaVersion: 'L0',
        backend_git_sha: '91884ff67c435497b5456501df540bd7f920c1a4',
        backend_build_time_utc: '2026-02-03T13:13:16Z',
        backend_app_version: '2.14.0',
      },
    };

    const state = mapL0SnapshotResponse(response);

    // In rendering context:
    // buildTime fallback: buildInfo?.buildTimeUtc || backendBuildTimeUtc
    const displayedBuildTime = state.buildInfo?.buildTimeUtc || state.backendBuildTimeUtc || "NOT_AVAILABLE";
    expect(displayedBuildTime).not.toBe("NOT_AVAILABLE");
    expect(displayedBuildTime).toBe('2026-02-03T13:13:16Z');
  });

  it('should prefer buildInfo values when both buildInfo and backend are provided', () => {
    const response = {
      data: {
        status: 'AVAILABLE',
        snapshotId: 'test-789',
        createdAtUtc: '2026-02-03T14:00:00Z',
        schemaVersion: 'L0',
        buildInfo: {
          buildSha: 'aaaaaaa67c435497b5456501df540bd7f920c1a4',
          buildTimeUtc: '2026-01-01T00:00:00Z',
        },
        backend_git_sha: '91884ff67c435497b5456501df540bd7f920c1a4',
        backend_build_time_utc: '2026-02-03T13:13:16Z',
        backend_app_version: '2.14.0',
      },
    };

    const state = mapL0SnapshotResponse(response);

    // Should use buildInfo when available
    const displayedBuildSha = state.buildInfo?.buildSha || state.backendBuildSha || "NOT_AVAILABLE";
    const displayedBuildTime = state.buildInfo?.buildTimeUtc || state.backendBuildTimeUtc || "NOT_AVAILABLE";

    expect(displayedBuildSha).toBe('aaaaaaa67c435497b5456501df540bd7f920c1a4');
    expect(displayedBuildTime).toBe('2026-01-01T00:00:00Z');
  });

  it('should render NOT_AVAILABLE only when both buildInfo and backend are missing', () => {
    const response = {
      data: {
        status: 'AVAILABLE',
        snapshotId: 'test-empty',
        createdAtUtc: '2026-02-03T14:00:00Z',
        schemaVersion: 'L0',
        // No buildInfo, no backend fields
      },
    };

    const state = mapL0SnapshotResponse(response);

    // Only now should we render NOT_AVAILABLE
    const displayedBuildSha = state.buildInfo?.buildSha || state.backendBuildSha || "NOT_AVAILABLE";
    const displayedBuildTime = state.buildInfo?.buildTimeUtc || state.backendBuildTimeUtc || "NOT_AVAILABLE";

    expect(displayedBuildSha).toBe("NOT_AVAILABLE");
    expect(displayedBuildTime).toBe("NOT_AVAILABLE");
  });

  it('should preserve backend app version in state', () => {
    const response = {
      data: {
        status: 'AVAILABLE',
        snapshotId: 'test-version',
        createdAtUtc: '2026-02-03T14:00:00Z',
        schemaVersion: 'L0',
        backend_git_sha: '91884ff67c435497b5456501df540bd7f920c1a4',
        backend_build_time_utc: '2026-02-03T13:13:16Z',
        backend_app_version: '2.15.0',
      },
    };

    const state = mapL0SnapshotResponse(response);
    expect(state.backendAppVersion).toBe('2.15.0');
  });

  it('should handle null/undefined backend fields gracefully', () => {
    const response = {
      data: {
        status: 'AVAILABLE',
        snapshotId: 'test-null',
        createdAtUtc: '2026-02-03T14:00:00Z',
        schemaVersion: 'L0',
        backend_git_sha: undefined,
        backend_build_time_utc: null,
      },
    };

    const state = mapL0SnapshotResponse(response);

    // Rendering should gracefully fallback to NOT_AVAILABLE
    const displayedBuildSha = state.buildInfo?.buildSha || state.backendBuildSha || "NOT_AVAILABLE";
    expect(displayedBuildSha).toBe("NOT_AVAILABLE");
  });
});
