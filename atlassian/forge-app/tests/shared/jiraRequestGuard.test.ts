/**
 * Unit tests for jiraRequestGuard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  guardedRequestJiraAsApp,
  guardedRequestJiraAsUser,
  ReadOnlyViolationError,
  validateReadOnlyScopes,
} from '../../src/shared/jiraRequestGuard';

vi.mock('@forge/api', () => ({
  default: {
    asApp: () => ({
      requestJira: vi.fn().mockResolvedValue({ ok: true }),
    }),
    asUser: () => ({
      requestJira: vi.fn().mockResolvedValue({ ok: true }),
    }),
  },
}));

describe('jiraRequestGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('guardedRequestJiraAsApp', () => {
    it('should allow GET requests', async () => {
      await expect(
        guardedRequestJiraAsApp('/rest/api/3/project', { method: 'GET' })
      ).resolves.toBeDefined();
    });

    it('should allow requests with no method (defaults to GET)', async () => {
      await expect(
        guardedRequestJiraAsApp('/rest/api/3/project')
      ).resolves.toBeDefined();
    });

    it('should block POST requests', async () => {
      await expect(
        guardedRequestJiraAsApp('/rest/api/3/project', { method: 'POST' })
      ).rejects.toThrow(ReadOnlyViolationError);
    });

    it('should block PUT requests', async () => {
      await expect(
        guardedRequestJiraAsApp('/rest/api/3/project/123', { method: 'PUT' })
      ).rejects.toThrow(ReadOnlyViolationError);
    });

    it('should block PATCH requests', async () => {
      await expect(
        guardedRequestJiraAsApp('/rest/api/3/project/123', { method: 'PATCH' })
      ).rejects.toThrow(ReadOnlyViolationError);
    });

    it('should block DELETE requests', async () => {
      await expect(
        guardedRequestJiraAsApp('/rest/api/3/project/123', { method: 'DELETE' })
      ).rejects.toThrow(ReadOnlyViolationError);
    });

    it('should handle case-insensitive method names', async () => {
      await expect(
        guardedRequestJiraAsApp('/rest/api/3/project', { method: 'get' })
      ).resolves.toBeDefined();

      await expect(
        guardedRequestJiraAsApp('/rest/api/3/project', { method: 'post' })
      ).rejects.toThrow(ReadOnlyViolationError);
    });
  });

  describe('guardedRequestJiraAsUser', () => {
    it('should allow GET requests', async () => {
      await expect(
        guardedRequestJiraAsUser('/rest/api/3/project', { method: 'GET' })
      ).resolves.toBeDefined();
    });

    it('should allow requests with no method', async () => {
      await expect(
        guardedRequestJiraAsUser('/rest/api/3/project')
      ).resolves.toBeDefined();
    });

    it('should block POST requests', async () => {
      await expect(
        guardedRequestJiraAsUser('/rest/api/3/project', { method: 'POST' })
      ).rejects.toThrow(ReadOnlyViolationError);
    });

    it('should block PUT requests', async () => {
      await expect(
        guardedRequestJiraAsUser('/rest/api/3/project/123', { method: 'PUT' })
      ).rejects.toThrow(ReadOnlyViolationError);
    });
  });

  describe('validateReadOnlyScopes', () => {
    it('should not throw', () => {
      expect(() => validateReadOnlyScopes()).not.toThrow();
    });
  });
});
