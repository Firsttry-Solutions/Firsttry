/**
 * "NO JIRA WRITES" CONTRACT TEST
 * 
 * This test proves that the config visibility resolver and scheduler
 * NEVER attempt to make non-GET requests to Jira.
 * 
 * If any POST/PUT/PATCH/DELETE is attempted -> test fails immediately
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeSnapshot } from '../../src/resolvers/config_visibility_resolver';
import { run as schedulerRun } from '../../src/scheduled/config_visibility_scheduler';

// Mock @forge/api
vi.mock('@forge/api', () => ({
  default: {
    asApp: vi.fn(() => ({
      requestJira: vi.fn(),
    })),
    storage: {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

// Mock tenant identity resolver
vi.mock('../../src/core/tenant_identity', () => ({
  resolveTenantIdentity: vi.fn(() => ({
    tenantKey: 'test-install-context',
    cloudId: 'test-cloud-id',
    source: 'installContext',
  })),
}));

import api from '@forge/api';

describe('NO_JIRA_WRITES Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolver: computeSnapshot', () => {
    it('MUST enforce GET-only for all Jira requests', async () => {
      let nonGetAttempted = false;

      const mockRequestJira = vi.fn((path: string, options?: any) => {
        const method = (options?.method || 'GET').toUpperCase();

        // FAIL_CLOSED: If non-GET detected, record failure
        if (method !== 'GET') {
          nonGetAttempted = true;
          throw new Error('NON_GET_BLOCKED');
        }

        // Return mock success for all GET requests
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ values: [] }),
        });
      });

      (api.asApp as any).mockReturnValue({
        requestJira: mockRequestJira,
      });

      // Run resolver
      await computeSnapshot('test-cloud-id');

      // CRITICAL: No non-GET should have been attempted
      expect(nonGetAttempted).toBe(false);
    });

    it('logs all requests for audit trail', async () => {
      const requestLog: Array<{ method: string; path: string }> = [];

      const mockRequestJira = vi.fn((path: string, options?: any) => {
        const method = (options?.method || 'GET').toUpperCase();
        requestLog.push({ method, path });

        if (method !== 'GET') {
          throw new Error('NON_GET_BLOCKED');
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ values: [] }),
        });
      });

      (api.asApp as any).mockReturnValue({
        requestJira: mockRequestJira,
      });

      await computeSnapshot('test-cloud-id');

      // Verify all logged requests are GET
      for (const req of requestLog) {
        expect(req.method).toBe('GET');
      }

      // Should have made requests to all endpoints
      expect(requestLog.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('scheduler: config_visibility_scheduler', () => {
    it('MUST NOT make any non-GET requests', async () => {
      let nonGetAttempted = false;

      const mockRequestJira = vi.fn((path: string, options?: any) => {
        const method = (options?.method || 'GET').toUpperCase();

        if (method !== 'GET') {
          nonGetAttempted = true;
          throw new Error('NON_GET_BLOCKED');
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ values: [] }),
        });
      });

      (api.asApp as any).mockReturnValue({
        requestJira: mockRequestJira,
      });

      // Run scheduler
      await schedulerRun(
        {},
        {
          installContext: 'ari:cloud:jira::installation/test-install-context',
          cloudId: 'test-cloud-id',
        }
      );

      // CRITICAL: No non-GET should have been attempted
      expect(nonGetAttempted).toBe(false);
    });

    it('gracefully handles failures without attempting writes', async () => {
      let nonGetAttempted = false;

      const mockRequestJira = vi.fn((path: string, options?: any) => {
        const method = (options?.method || 'GET').toUpperCase();

        if (method !== 'GET') {
          nonGetAttempted = true;
          throw new Error('NON_GET_BLOCKED');
        }

        // Simulate partial failures
        if (path.includes('/field')) {
          return Promise.resolve({
            ok: false,
            status: 403,
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ values: [] }),
        });
      });

      (api.asApp as any).mockReturnValue({
        requestJira: mockRequestJira,
      });

      // Run scheduler - should handle errors without throwing
      await expect(
        schedulerRun(
          {},
          {
            installContext: 'ari:cloud:jira::installation/test-install-context',
            cloudId: 'test-cloud-id',
          }
        )
      ).resolves.not.toThrow();

      // CRITICAL: Even with failures, no non-GET attempted
      expect(nonGetAttempted).toBe(false);
    });
  });

  describe('audit trail', () => {
    it('all operations are READ-ONLY', async () => {
      const auditLog: Array<{
        op: string;
        method: string;
        endpoint: string;
      }> = [];

      const mockRequestJira = vi.fn((path: string, options?: any) => {
        const method = (options?.method || 'GET').toUpperCase();
        auditLog.push({
          op: 'requestJira',
          method,
          endpoint: path,
        });

        if (method !== 'GET') {
          throw new Error('NON_GET_BLOCKED');
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ values: [] }),
        });
      });

      (api.asApp as any).mockReturnValue({
        requestJira: mockRequestJira,
      });

      await computeSnapshot('test-cloud-id');

      // Audit requirement: all are GET
      const nonReadOps = auditLog.filter((log) => log.method !== 'GET');
      expect(nonReadOps).toHaveLength(0);

      // Audit trail should not be empty
      expect(auditLog.length).toBeGreaterThan(0);
    });
  });
});
