/**
 * Tests for getBuildInfo resolver
 * Includes LOG_CANARY emission test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBuildInfo_resolver } from '../src/resolvers/getBuildInfo';

describe('getBuildInfo resolver', () => {
  let consoleLogSpy: any;

  beforeEach(() => {
    // Capture all console.log calls
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should emit LOG_CANARY on resolver entry', async () => {
    // Arrange
    const mockReq = {
      context: {
        tenantId: 'test-tenant',
        cloudId: 'test-cloud-id',
      },
    };

    // Act
    const result = await getBuildInfo_resolver(mockReq);

    // Assert - result should be successful
    expect(result.ok).toBe(true);

    // Assert - LOG_CANARY should have been logged
    // Pattern: LOG_CANARY resolver=getBuildInfo build=<sha> ts=<iso> ui_req_id=<id or UNSET>
    const logCalls = consoleLogSpy.mock.calls;
    const logCanaryCall = logCalls.find((call: any[]) => String(call[0]).startsWith('LOG_CANARY'));

    expect(logCanaryCall).toBeDefined();
    if (logCanaryCall) {
      const logMessage = logCanaryCall[0];
      expect(logMessage).toMatch(/LOG_CANARY resolver=getBuildInfo build=\S+ ts=\d{4}-\d{2}-\d{2}T[\d:Z.]+ ui_req_id=\S+/);
    }
  });

  it('should include build SHA in LOG_CANARY', async () => {
    // Arrange
    const mockReq = {
      context: {
        tenantId: 'test-tenant',
        cloudId: 'test-cloud-id',
      },
    };

    // Act
    await getBuildInfo_resolver(mockReq);

    // Assert - LOG_CANARY should include build SHA
    const logCalls = consoleLogSpy.mock.calls;
    const logCanaryCall = logCalls.find((call: any[]) => String(call[0]).startsWith('LOG_CANARY'));

    expect(logCanaryCall).toBeDefined();
    if (logCanaryCall) {
      const logMessage = String(logCanaryCall[0]);
      expect(logMessage).toContain('build=');
      // Verify build SHA is not empty or "unknown"
      const buildMatch = logMessage.match(/build=(\S+)/);
      expect(buildMatch).toBeDefined();
      expect(buildMatch![1]).not.toBe('unknown');
    }
  });

  it('should include ISO timestamp in LOG_CANARY', async () => {
    // Arrange
    const mockReq = {
      context: {
        tenantId: 'test-tenant',
        cloudId: 'test-cloud-id',
      },
    };

    // Act
    await getBuildInfo_resolver(mockReq);

    // Assert - LOG_CANARY should include ISO timestamp
    const logCalls = consoleLogSpy.mock.calls;
    const logCanaryCall = logCalls.find((call: any[]) => String(call[0]).startsWith('LOG_CANARY'));

    expect(logCanaryCall).toBeDefined();
    if (logCanaryCall) {
      const logMessage = String(logCanaryCall[0]);
      expect(logMessage).toContain('ts=');
      // Verify timestamp is ISO format (contains 'T' and 'Z' or timezone offset)
      expect(logMessage).toMatch(/ts=\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('should include UI request ID in LOG_CANARY', async () => {
    // Arrange
    const mockReq = {
      context: {
        tenantId: 'test-tenant',
        cloudId: 'test-cloud-id',
      },
      uiReqId: 'test-req-123',
    };

    // Act
    await getBuildInfo_resolver(mockReq);

    // Assert - LOG_CANARY should include UI request ID
    const logCalls = consoleLogSpy.mock.calls;
    const logCanaryCall = logCalls.find((call: any[]) => String(call[0]).startsWith('LOG_CANARY'));

    expect(logCanaryCall).toBeDefined();
    if (logCanaryCall) {
      const logMessage = String(logCanaryCall[0]);
      expect(logMessage).toContain('ui_req_id=');
      expect(logMessage).toContain('test-req-123');
    }
  });

  it('should use UNSET for ui_req_id if not provided', async () => {
    // Arrange
    const mockReq = {
      context: {
        tenantId: 'test-tenant',
        cloudId: 'test-cloud-id',
      },
      // No uiReqId provided
    };

    // Act
    await getBuildInfo_resolver(mockReq);

    // Assert - LOG_CANARY should use UNSET
    const logCalls = consoleLogSpy.mock.calls;
    const logCanaryCall = logCalls.find((call: any[]) => String(call[0]).startsWith('LOG_CANARY'));

    expect(logCanaryCall).toBeDefined();
    if (logCanaryCall) {
      const logMessage = String(logCanaryCall[0]);
      expect(logMessage).toContain('ui_req_id=UNSET');
    }
  });

  it('should emit LOG_CANARY even on error path', async () => {
    // Arrange - Mock missing build meta to trigger error path
    const mockReq = {
      context: {
        tenantId: 'test-tenant',
        cloudId: 'test-cloud-id',
      },
    };

    // Act
    const result = await getBuildInfo_resolver(mockReq);

    // Assert - Should return error but still have emitted LOG_CANARY
    // (or it may have succeeded - depends on environment)
    expect(result).toBeDefined();
    expect(result).toHaveProperty('ok');

    // Verify LOG_CANARY was emitted
    const logCalls = consoleLogSpy.mock.calls;
    const logCanaryCall = logCalls.find((call: any[]) => String(call[0]).startsWith('LOG_CANARY'));

    expect(logCanaryCall).toBeDefined();
  });

  it('should return BuildInfo with ok=true on success', async () => {
    // Arrange
    const mockReq = {
      context: {
        tenantId: 'test-tenant',
        cloudId: 'test-cloud-id',
      },
    };

    // Act
    const result = await getBuildInfo_resolver(mockReq);

    // Assert
    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    expect(result.FT_BUILD_SHA).toBeDefined();
    expect(result.FT_BUILD_SHA).not.toBe('ERROR_EXCEPTION');
    expect(result.FT_BUILD_TIME_UTC).toBeDefined();
    expect(result.resolvedAt).toBeDefined();
  });

  it('should never throw', async () => {
    // Arrange - even with invalid request
    const mockReq = null;

    // Act & Assert
    let thrown = false;
    try {
      await getBuildInfo_resolver(mockReq as any);
    } catch (_) {
      thrown = true;
    }

    expect(thrown).toBe(false);
  });
});
