/**
 * RESOLVER TESTS: Config Visibility Resolver
 * 
 * Tests for:
 * - Every request method is GET
 * - Handles 403 and sets null + issues properly
 * - Returns snapshot with correct completeness and boundaries constants
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeSnapshot } from '../../src/resolvers/config_visibility_resolver';

// Mock @forge/api
vi.mock('@forge/api', () => {
  return {
    default: {
      asApp: vi.fn(() => ({
        requestJira: vi.fn(),
      })),
    },
  };
});

import api from '@forge/api';

describe('Config Visibility Resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET-only enforcement', () => {
    it('should only use GET requests', async () => {
      const mockRequestJira = vi.fn();

      // Mock successful responses
      mockRequestJira.mockImplementation((path: string, options?: any) => {
        const method = (options?.method || 'GET').toUpperCase();
        
        // Verify GET only
        if (method !== 'GET') {
          throw new Error('NON_GET_BLOCKED');
        }

        // Return mock data
        if (path.includes('/field')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{}, {}, {}]),
          });
        } else if (path.includes('/workflow/search')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ values: [{}, {}] }),
          });
        } else if (path.includes('/workflowscheme')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ values: [{ workflows: [{}, {}] }] }),
          });
        } else if (path.includes('/screens')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ values: [{}, {}] }),
          });
        } else if (path.includes('/permissionscheme')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ permissionSchemes: [{}] }),
          });
        }

        return Promise.resolve({ ok: false, status: 404 });
      });

      (api.asApp as any).mockReturnValue({
        requestJira: mockRequestJira,
      });

      // This should not throw
      const result = await computeSnapshot('test-cloud-id');
      
      // Verify all calls were made
      expect(mockRequestJira.mock.calls.length).toBeGreaterThan(0);
      
      // Verify snapshot boundaries
      expect(result.boundaries.noJiraWrites).toBe(true);
      expect(result.boundaries.noConfigChanges).toBe(true);
      expect(result.boundaries.noEnforcement).toBe(true);
    });
  });

  describe('error handling', () => {
    it('sets metric to null on 403 response', async () => {
      const mockRequestJira = vi.fn();

      mockRequestJira.mockImplementation((path: string) => {
        if (path.includes('/field')) {
          return Promise.resolve({
            ok: false,
            status: 403,
          });
        }

        // Other endpoints return success
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ values: [] }),
        });
      });

      (api.asApp as any).mockReturnValue({
        requestJira: mockRequestJira,
      });

      const result = await computeSnapshot('test-cloud-id');

      // customFieldCount should be null
      expect(result.metrics.customFieldCount).toBeNull();
      
      // Should have an issue for this metric
      const customFieldIssue = result.issues.find((i) => i.metric === 'customFieldCount');
      expect(customFieldIssue).toBeDefined();
      expect(customFieldIssue?.errorCode).toBe('JIRA_403');
    });

    it('handles network timeout gracefully', async () => {
      const mockRequestJira = vi.fn();

      mockRequestJira.mockImplementation((path: string) => {
        if (path.includes('/field')) {
          return Promise.reject(new Error('Connection timeout'));
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ values: [] }),
        });
      });

      (api.asApp as any).mockReturnValue({
        requestJira: mockRequestJira,
      });

      const result = await computeSnapshot('test-cloud-id');

      // customFieldCount should be null
      expect(result.metrics.customFieldCount).toBeNull();
      
      // Should have an issue with JIRA_UNKNOWN or JIRA_TIMEOUT
      const customFieldIssue = result.issues.find((i) => i.metric === 'customFieldCount');
      expect(customFieldIssue).toBeDefined();
      expect(['JIRA_UNKNOWN', 'JIRA_TIMEOUT']).toContain(customFieldIssue?.errorCode);
    });
  });

  describe('snapshot structure', () => {
    it('always returns complete snapshot structure', async () => {
      const mockRequestJira = vi.fn();

      mockRequestJira.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ values: [] }),
      });

      (api.asApp as any).mockReturnValue({
        requestJira: mockRequestJira,
      });

      const result = await computeSnapshot('test-cloud-id');

      // Verify all required fields
      expect(result.metrics).toBeDefined();
      expect(result.riskBand).toBeDefined();
      expect(result.evaluatedAtISO).toBeDefined();
      expect(result.completeness).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.mode).toBe('scheduled-read-only');
      expect(result.boundaries).toBeDefined();
    });

    it('sets completeness correctly', async () => {
      const mockRequestJira = vi.fn();

      mockRequestJira.mockImplementation((path: string) => {
        if (path.includes('/field')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{}]),
          });
        }

        // Others fail
        return Promise.resolve({
          ok: false,
          status: 403,
        });
      });

      (api.asApp as any).mockReturnValue({
        requestJira: mockRequestJira,
      });

      const result = await computeSnapshot('test-cloud-id');

      // Some null, some non-null = PARTIAL
      expect(result.completeness).toBe('PARTIAL');
    });
  });
});
