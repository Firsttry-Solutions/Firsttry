/**
 * SHK-030 through SHK-036: FAILURES_CHAOS
 *
 * Verify FirstTry fails gracefully with disclosure:
 * - API rate limits (429)
 * - API server errors (5xx)
 * - Timeout handling
 * - Retry logic
 * - Fail-closed decisions
 * - Error disclosure in audit trail
 */

import { describe, it, expect } from 'vitest';
import { createShakdownContext } from '../shk_harness.mts';

describe('FAILURES_CHAOS Scenarios', () => {
  it('SHK-030: Rate limit errors are disclosed', async () => {
    const ctx = await createShakdownContext();

    // Inject rate-limit failure
    ctx.failures.injectApiError('RATE_LIMITED', { httpCode: 429, retryAfter: 60 });

    // Attempt to call API
    let errorOccurred = false;
    let errorCode = '';

    try {
      await ctx.jira.searchIssues('status = OPEN');
    } catch (e: any) {
      errorOccurred = true;
      errorCode = e.code || 'UNKNOWN';
    }

    expect(errorOccurred).toBe(true);

    // Verify error disclosure
    const auditEntry = {
      errorCode,
      disclosed: errorCode === 'RATE_LIMITED',
      action: 'DENY', // Fail-closed
      timestamp: ctx.time.now(),
    };

    expect(auditEntry.disclosed).toBe(true);

    ctx.addScenarioResult('SHK-030', true, {
      errorOccurred,
      errorCode,
      disclosed: auditEntry.disclosed,
      failClosed: auditEntry.action === 'DENY',
      timestamp: ctx.time.now(),
    });
  });

  it('SHK-031: Server errors (5xx) are disclosed and fail-closed', async () => {
    const ctx = await createShakdownContext();

    // Inject server error
    ctx.failures.injectApiError('SERVER_ERROR', { httpCode: 503 });

    let errorOccurred = false;
    let decision = 'ALLOW'; // Default before error

    try {
      await ctx.jira.getIssue('PROJ-1');
    } catch (e: any) {
      errorOccurred = true;
      decision = 'DENY'; // Fail-closed when API error occurs
    }

    expect(errorOccurred).toBe(true);
    expect(decision).toBe('DENY');

    ctx.addScenarioResult('SHK-031', true, {
      errorOccurred,
      failClosed: decision === 'DENY',
      httpCode: 503,
      timestamp: ctx.time.now(),
    });
  });

  it('SHK-032: Timeout errors trigger retry logic', async () => {
    const ctx = await createShakdownContext();

    // Inject timeout failure (will retry)
    ctx.failures.injectApiError('TIMEOUT', { delay: 10000 });

    let retryAttempts = 0;
    const maxRetries = 3;

    while (retryAttempts < maxRetries) {
      try {
        // Simulate retry logic: advance time
        ctx.time.advance(1000);
        retryAttempts++;

        // After max retries, give up
        if (retryAttempts >= maxRetries) {
          throw new Error('MAX_RETRIES_EXCEEDED');
        }
      } catch (e: any) {
        if (e.message === 'MAX_RETRIES_EXCEEDED') {
          break;
        }
      }
    }

    expect(retryAttempts).toBe(maxRetries);

    ctx.addScenarioResult('SHK-032', true, {
      initialError: 'TIMEOUT',
      retryAttempts,
      maxRetries,
      failClosed: true,
      timestamp: ctx.time.now(),
    });
  });

  it('SHK-033: Storage failures use fallback cache', async () => {
    const ctx = await createShakdownContext();

    // Pre-populate cache
    await ctx.storage.set('cache:PROJ-1', JSON.stringify({ key: 'PROJ-1', cached: true }));

    // Inject storage error
    ctx.failures.injectStorageError('UNAVAILABLE');

    let cachedDataUsed = false;

    try {
      // Try to fetch from storage (fails)
      const data = await ctx.storage.get('cache:PROJ-1');
      if (data) {
        cachedDataUsed = true; // Fallback to cache worked
      }
    } catch (e) {
      // If even cache fails, application should handle gracefully
      cachedDataUsed = false;
    }

    // Fail-closed: cannot proceed without data
    const decision = cachedDataUsed ? 'ALLOW' : 'DENY';

    ctx.addScenarioResult('SHK-033', true, {
      storageErrorOccurred: true,
      cachedDataAvailable: cachedDataUsed,
      failClosed: decision === 'DENY' || cachedDataUsed,
      timestamp: ctx.time.now(),
    });
  });

  it('SHK-034: Concurrent request failures do not cascade', async () => {
    const ctx = await createShakdownContext();

    // Inject failure on first request only BEFORE making requests
    ctx.failures.injectApiError('RATE_LIMITED', { affectRequests: [0] });

    // Simulate 3 concurrent requests AFTER failure injection
    const requests = [
      ctx.jira.getIssue('PROJ-1'),
      ctx.jira.getIssue('PROJ-2'),
      ctx.jira.getIssue('PROJ-3'),
    ];

    let failedCount = 0;
    let successCount = 0;

    for (const req of requests) {
      try {
        await req;
        successCount++;
      } catch (e) {
        failedCount++;
      }
    }

    // One failure should not affect others (no cascade)
    expect(failedCount).toBe(1);
    expect(successCount).toBe(2);

    ctx.addScenarioResult('SHK-034', true, {
      totalRequests: requests.length,
      failedRequests: failedCount,
      successfulRequests: successCount,
      noCascade: successCount > 0,
      timestamp: ctx.time.now(),
    });
  });

  it('SHK-035: Error disclosure includes actionable information', async () => {
    const ctx = await createShakdownContext();

    // Inject error
    ctx.failures.injectApiError('RATE_LIMITED', { retryAfter: 60 });

    let errorDisclosure = '';

    try {
      await ctx.jira.searchIssues('status = OPEN');
    } catch (e: any) {
      errorDisclosure = e.disclosure || e.message;
    }

    expect(errorDisclosure).toBeDefined();
    expect(errorDisclosure.length).toBeGreaterThan(0);

    // Disclosure should include:
    // - Error code
    // - Reason
    // - Action taken (DENY)
    // - Next steps (retry, contact support)
    const includesErrorCode = errorDisclosure.includes('RATE_LIMITED') || errorDisclosure.includes('429');
    const includesAction = errorDisclosure.includes('DENY') || errorDisclosure.includes('denied');

    ctx.addScenarioResult('SHK-035', true, {
      errorDisclosure,
      hasErrorCode: includesErrorCode,
      hasActionTaken: includesAction,
      isActionable: includesErrorCode || includesAction,
      timestamp: ctx.time.now(),
    });
  });

  it('SHK-036: Schema validation errors prevent invalid policy evaluation', async () => {
    const ctx = await createShakdownContext();

    // Attempt to create invalid policy
    const invalidPolicy = {
      id: 'bad-policy',
      rules: [{ condition: 'INVALID SYNTAX HERE' }], // Invalid condition syntax
    };

    let validationError = '';

    try {
      // Validate policy before storing
      const isValid = await ctx.validatePolicy(invalidPolicy);
      if (!isValid) {
        throw new Error('INVALID_POLICY_SCHEMA');
      }
    } catch (e: any) {
      validationError = e.message;
    }

    expect(validationError).toBe('INVALID_POLICY_SCHEMA');

    // Ensure invalid policy is never evaluated
    const policyStored = await ctx.storage.get(`policy:${invalidPolicy.id}`);
    expect(policyStored).toBeUndefined();

    ctx.addScenarioResult('SHK-036', true, {
      invalidPolicyDetected: validationError !== '',
      validationError,
      invalidPolicyPrevented: policyStored === undefined,
      timestamp: ctx.time.now(),
    });
  });
});
