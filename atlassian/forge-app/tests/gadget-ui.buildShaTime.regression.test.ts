/**
 * Test: Build SHA and Build Time Rendering Fix
 * 
 * Regression test to ensure that when the ft_getDashboardState_v1 resolver returns
 * backend_git_sha and backend_build_time_utc, they are properly mapped through
 * the l0_snapshot_mapper and DO NOT show as "NOT_AVAILABLE" in the rendered output.
 */

import { describe, it, expect } from 'vitest';
import { mapL0SnapshotResponse } from '../src/gadget-ui/src/l0_snapshot_mapper';

describe('Build SHA and Build Time Rendering Fix', () => {
  it('MUST map backend_git_sha from resolver response to dashboardState.backendBuildSha', () => {
    // When: resolver returns AVAILABLE with backend_git_sha
    const resolverResponse = {
      status: 'AVAILABLE',
      snapshotId: 'snap-prod-202601',
      createdAtUtc: '2026-01-28T10:00:00Z',
      schemaVersion: 'L0',
      backend_git_sha: '1d93f844ceed921b5d015ef3c9d8a6573843c6b',
      backend_build_time_utc: '2026-01-28T09:30:00Z',
      backend_app_version: '2.14.0',
    };

    // When: mapping the response
    const dashState = mapL0SnapshotResponse(resolverResponse);

    // Then: backendBuildSha should NOT be undefined or empty
    expect(dashState.status).toBe('AVAILABLE');
    expect(dashState.backendBuildSha).toBe('1d93f844ceed921b5d015ef3c9d8a6573843c6b');
    expect(dashState.backendBuildSha).not.toBe('NOT_AVAILABLE');
    expect(dashState.backendBuildSha).not.toBe('');
  });

  it('MUST map backend_build_time_utc from resolver response to dashboardState.backendBuildTimeUtc', () => {
    // When: resolver returns AVAILABLE with backend_build_time_utc
    const resolverResponse = {
      status: 'AVAILABLE',
      snapshotId: 'snap-prod-202601',
      createdAtUtc: '2026-01-28T10:00:00Z',
      schemaVersion: 'L0',
      backend_git_sha: '1d93f844ceed921b5d015ef3c9d8a6573843c6b',
      backend_build_time_utc: '2026-01-28T09:30:00Z',
      backend_app_version: '2.14.0',
    };

    // When: mapping the response
    const dashState = mapL0SnapshotResponse(resolverResponse);

    // Then: backendBuildTimeUtc should NOT be undefined or empty
    expect(dashState.status).toBe('AVAILABLE');
    expect(dashState.backendBuildTimeUtc).toBe('2026-01-28T09:30:00Z');
    expect(dashState.backendBuildTimeUtc).not.toBe('NOT_AVAILABLE');
    expect(dashState.backendBuildTimeUtc).not.toBe('');
  });

  it('MUST show NOT_AVAILABLE only when backend build fields are truly absent', () => {
    // When: resolver returns AVAILABLE but WITHOUT backend build identity fields
    const resolverResponse = {
      status: 'AVAILABLE',
      snapshotId: 'snap-prod-202601',
      createdAtUtc: '2026-01-28T10:00:00Z',
      schemaVersion: 'L0',
      // No backend_git_sha, backend_build_time_utc, or backend_app_version
    };

    // When: mapping the response
    const dashState = mapL0SnapshotResponse(resolverResponse);

    // Then: backendBuildSha and backendBuildTimeUtc should be undefined (so rendering will show NOT_AVAILABLE as fallback)
    expect(dashState.status).toBe('AVAILABLE');
    expect(dashState.backendBuildSha).toBeUndefined();
    expect(dashState.backendBuildTimeUtc).toBeUndefined();
  });

  it('MUST fallback to metadata.provenance.buildShaAtCapture if backend_git_sha absent', () => {
    // When: resolver returns AVAILABLE with buildShaAtCapture in metadata.provenance
    const resolverResponse = {
      status: 'AVAILABLE',
      snapshotId: 'snap-prod-202601',
      createdAtUtc: '2026-01-28T10:00:00Z',
      schemaVersion: 'L0',
      metadata: {
        provenance: {
          buildShaAtCapture: 'cafebabe1234567890abcdef1234567890abcdef',
          capturedAtUtc: '2026-01-28T09:15:00Z',
        }
      }
    };

    // When: mapping the response
    const dashState = mapL0SnapshotResponse(resolverResponse);

    // Then: should extract from metadata.provenance
    expect(dashState.status).toBe('AVAILABLE');
    expect(dashState.backendBuildSha).toBe('cafebabe1234567890abcdef1234567890abcdef');
    expect(dashState.backendBuildTimeUtc).toBe('2026-01-28T09:15:00Z');
  });

  it('MUST prefer direct backend_git_sha over metadata.provenance.buildShaAtCapture', () => {
    // When: both direct field and metadata.provenance contain values, prefer direct
    const resolverResponse = {
      status: 'AVAILABLE',
      snapshotId: 'snap-prod-202601',
      createdAtUtc: '2026-01-28T10:00:00Z',
      schemaVersion: 'L0',
      backend_git_sha: '1d93f844ceed921b5d015ef3c9d8a6573843c6b',
      backend_build_time_utc: '2026-01-28T09:30:00Z',
      metadata: {
        provenance: {
          buildShaAtCapture: 'cafebabe1234567890abcdef1234567890abcdef',
          capturedAtUtc: '2026-01-28T09:15:00Z',
        }
      }
    };

    // When: mapping the response
    const dashState = mapL0SnapshotResponse(resolverResponse);

    // Then: should use direct field (higher priority)
    expect(dashState.status).toBe('AVAILABLE');
    expect(dashState.backendBuildSha).toBe('1d93f844ceed921b5d015ef3c9d8a6573843c6b');
    expect(dashState.backendBuildTimeUtc).toBe('2026-01-28T09:30:00Z');
  });
});
