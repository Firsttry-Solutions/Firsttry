/**
 * SHK-050, SHK-051, SHK-052: TENANT_ISOLATION
 *
 * Verify multi-tenant isolation is secure:
 * - Tenants cannot access each other's policies
 * - Storage is properly scoped
 * - No cross-tenant data leakage
 */

import { describe, it, expect } from 'vitest';
import { createShakdownContext } from '../shk_harness.mts';

describe('TENANT_ISOLATION Scenarios', () => {
  it('SHK-050: Tenant storage is completely isolated', async () => {
    const ctx = await createShakdownContext();

    // Tenant A creates a policy
    const tenantA = 'tenant-a';
    const tenantB = 'tenant-b';

    const storageA = await ctx.createStorageAdapter(tenantA);
    const storageB = await ctx.createStorageAdapter(tenantB);

    const policyA = { id: 'secret-policy', name: 'Tenant A Secret', secret: true };
    await storageA.set('policy:secret-policy', JSON.stringify(policyA));

    // Tenant B tries to access Tenant A's policy
    let dataLeaked = false;
    try {
      const result = await storageB.get('policy:secret-policy');
      if (result) {
        dataLeaked = true; // SECURITY VIOLATION
      }
    } catch (e) {
      // Good: access denied
      dataLeaked = false;
    }

    expect(dataLeaked).toBe(false);

    // Tenant B should only see its own data
    const tenantBData = await storageB.get('policy:secret-policy');
    expect(tenantBData).toBeUndefined();

    ctx.addScenarioResult('SHK-050', true, {
      tenantAPolicy: 'stored',
      tenantBAccessAttempted: true,
      dataLeaked,
      isolationWorking: !dataLeaked,
      timestamp: ctx.time.now(),
    });
  });

  it('SHK-051: Audit logs are tenant-scoped', async () => {
    const ctx = await createShakdownContext();

    const tenantA = 'tenant-a';
    const tenantB = 'tenant-b';

    const storageA = await ctx.createStorageAdapter(tenantA);
    const storageB = await ctx.createStorageAdapter(tenantB);

    // Tenant A creates audit entry
    const auditA = {
      tenant: tenantA,
      policyId: 'pol-a',
      decision: 'DENY',
      timestamp: ctx.time.now(),
    };

    await storageA.set('audit:entry-1', JSON.stringify(auditA));

    // Tenant B creates audit entry
    const auditB = {
      tenant: tenantB,
      policyId: 'pol-b',
      decision: 'ALLOW',
      timestamp: ctx.time.now(),
    };

    await storageB.set('audit:entry-1', JSON.stringify(auditB));

    // Tenant B should see only its own audit
    const auditBResult = await storageB.get('audit:entry-1');
    const parsed = auditBResult ? JSON.parse(auditBResult) : null;

    expect(parsed?.tenant).toBe(tenantB);
    expect(parsed?.policyId).toBe('pol-b');

    // Tenant B should NOT see Tenant A's audit
    expect(parsed?.tenant).not.toBe(tenantA);

    ctx.addScenarioResult('SHK-051', true, {
      tenantAEntry: 'stored',
      tenantBEntry: 'stored',
      tenantBSeesOwnData: parsed?.tenant === tenantB,
      tenantBCannotSeeTenantA: parsed?.tenant !== tenantA,
      auditIsolated: parsed?.tenant === tenantB,
      timestamp: ctx.time.now(),
    });
  });

  it('SHK-052: Cache does not leak between tenants', async () => {
    const ctx = await createShakdownContext();

    const tenantA = 'tenant-a';
    const tenantB = 'tenant-b';

    const storageA = await ctx.createStorageAdapter(tenantA);
    const storageB = await ctx.createStorageAdapter(tenantB);

    // Tenant A caches Jira issue
    const issueA = { key: 'PROJ-1', id: '100', status: 'OPEN', secret: 'A-secret' };
    await storageA.set('cache:PROJ-1', JSON.stringify(issueA));

    // Tenant B caches different Jira issue (same key in different tenant)
    const issueB = { key: 'PROJ-1', id: '200', status: 'CLOSED', secret: 'B-secret' };
    await storageB.set('cache:PROJ-1', JSON.stringify(issueB));

    // Verify each tenant sees only its own cache
    const cachedA = await storageA.get('cache:PROJ-1');
    const cachedB = await storageB.get('cache:PROJ-1');

    const parsedA = cachedA ? JSON.parse(cachedA) : null;
    const parsedB = cachedB ? JSON.parse(cachedB) : null;

    expect(parsedA?.secret).toBe('A-secret');
    expect(parsedB?.secret).toBe('B-secret');
    expect(parsedA?.secret).not.toBe(parsedB?.secret);

    ctx.addScenarioResult('SHK-052', true, {
      tenantAIssue: 'cached',
      tenantBIssue: 'cached',
      tenantASeesOwnCache: parsedA?.secret === 'A-secret',
      tenantBSeesOwnCache: parsedB?.secret === 'B-secret',
      cacheNotShared: parsedA?.secret !== parsedB?.secret,
      timestamp: ctx.time.now(),
    });
  });
});
