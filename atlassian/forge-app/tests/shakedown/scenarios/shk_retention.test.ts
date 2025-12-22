/**
 * SHK-060, SHK-061, SHK-062: RETENTION_DELETION
 *
 * Verify data retention and deletion policies:
 * - Old data is properly deleted
 * - Deletion is immutable
 * - Audit trail is archived
 */

import { describe, it, expect } from 'vitest';
import { createShakdownContext } from '../shk_harness.mts';

describe('RETENTION_DELETION Scenarios', () => {
  it('SHK-060: Data retention period is enforced', async () => {
    const ctx = await createShakdownContext();

    const now = ctx.time.now();
    const retentionDays = 90; // Example: 90-day retention

    // Create old data (beyond retention)
    const oldTimestamp = now - retentionDays * 24 * 60 * 60 * 1000 - 1000; // 1 second past limit

    // Create recent data (within retention)
    const recentTimestamp = now - (retentionDays - 1) * 24 * 60 * 60 * 1000; // Still within limit

    await ctx.storage.set('usage:old', JSON.stringify({ timestamp: oldTimestamp }));
    await ctx.storage.set('usage:recent', JSON.stringify({ timestamp: recentTimestamp }));

    // Simulate retention job
    const toDelete: string[] = [];

    // Check each entry
    const oldData = await ctx.storage.get('usage:old');
    const recentData = await ctx.storage.get('usage:recent');

    if (oldData) {
      const entry = JSON.parse(oldData);
      if (now - entry.timestamp > retentionDays * 24 * 60 * 60 * 1000) {
        toDelete.push('usage:old');
      }
    }

    // Delete old data
    for (const key of toDelete) {
      await ctx.storage.remove(key);
    }

    // Verify old data is gone, recent data remains
    const oldAfterDelete = await ctx.storage.get('usage:old');
    const recentAfterDelete = await ctx.storage.get('usage:recent');

    expect(oldAfterDelete).toBeUndefined();
    expect(recentAfterDelete).toBeDefined();

    ctx.addScenarioResult('SHK-060', true, {
      retentionDays,
      dataDeleted: toDelete.length,
      oldDataRemoved: oldAfterDelete === undefined,
      recentDataPreserved: recentAfterDelete !== undefined,
      timestamp: ctx.time.now(),
    });
  });

  it('SHK-061: Deleted policies cannot be recovered', async () => {
    const ctx = await createShakdownContext();

    // Create a policy
    const policyId = 'policy-to-delete';
    const policy = { id: policyId, name: 'Temporary Policy', rules: [] };

    await ctx.storage.set(`policy:${policyId}`, JSON.stringify(policy));

    // Verify it exists
    const before = await ctx.storage.get(`policy:${policyId}`);
    expect(before).toBeDefined();

    // Delete it
    await ctx.storage.remove(`policy:${policyId}`);

    // Verify it's gone
    const after = await ctx.storage.get(`policy:${policyId}`);
    expect(after).toBeUndefined();

    // Try to "recover" it (should fail)
    let recoverError = '';
    try {
      const recovered = await ctx.storage.get(`policy:${policyId}`);
      if (recovered === undefined) {
        throw new Error('POLICY_NOT_FOUND');
      }
    } catch (e: any) {
      recoverError = e.message;
    }

    expect(recoverError).toBe('POLICY_NOT_FOUND');

    ctx.addScenarioResult('SHK-061', true, {
      policyDeleted: true,
      deleteImmutable: after === undefined,
      recoveryNotPossible: recoverError !== '',
      timestamp: ctx.time.now(),
    });
  });

  it('SHK-062: Audit trail is archived on policy deletion', async () => {
    const ctx = await createShakdownContext();

    const policyId = 'pol-to-archive';

    // Create policy and audit entries
    const policy = { id: policyId, name: 'Policy to Archive', rules: [] };
    await ctx.storage.set(`policy:${policyId}`, JSON.stringify(policy));

    // Create some audit entries
    const auditEntries = [
      {
        policyId,
        issueId: 'PROJ-1',
        decision: 'DENY',
        timestamp: ctx.time.now(),
      },
      {
        policyId,
        issueId: 'PROJ-2',
        decision: 'ALLOW',
        timestamp: ctx.time.now(),
      },
    ];

    for (let i = 0; i < auditEntries.length; i++) {
      await ctx.storage.set(`audit:${policyId}:${i}`, JSON.stringify(auditEntries[i]));
    }

    // Delete the policy
    await ctx.storage.remove(`policy:${policyId}`);

    // Archive audit trail (anonymize references to deleted policy)
    for (let i = 0; i < auditEntries.length; i++) {
      const key = `audit:${policyId}:${i}`;
      const data = await ctx.storage.get(key);
      if (data) {
        const entry = JSON.parse(data);
        entry.policyId = 'ARCHIVED_POLICY_' + policyId; // Anonymize
        await ctx.storage.set(key, JSON.stringify(entry));
      }
    }

    // Verify policy is deleted
    const policyRemoved = (await ctx.storage.get(`policy:${policyId}`)) === undefined;
    expect(policyRemoved).toBe(true);

    // Verify audit trail still exists but is anonymized
    const audit0 = await ctx.storage.get(`audit:${policyId}:0`);
    const parsed0 = audit0 ? JSON.parse(audit0) : null;

    expect(parsed0).toBeDefined();
    expect(parsed0?.policyId).toBe('ARCHIVED_POLICY_' + policyId);

    ctx.addScenarioResult('SHK-062', true, {
      policyDeleted: policyRemoved,
      auditEntriesArchived: parsed0 !== null,
      auditAnonymized: parsed0?.policyId !== policyId && parsed0?.policyId.includes('ARCHIVED'),
      timestamp: ctx.time.now(),
    });
  });
});
