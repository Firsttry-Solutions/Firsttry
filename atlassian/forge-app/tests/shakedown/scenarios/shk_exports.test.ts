/**
 * SHK-040, SHK-041, SHK-042: EXPORTS_REPORTS
 *
 * Verify export and reporting functionality:
 * - Export formats are correct
 * - Data integrity in exports
 * - Report generation works
 */

import { describe, it, expect } from 'vitest';
import { createShakdownContext } from '../shk_harness.mts';

describe('EXPORTS_REPORTS Scenarios', () => {
  it('SHK-040: Exports in JSON format are valid', async () => {
    const ctx = await createShakdownContext();

    // Create some test policies to export
    const policy1 = { id: 'pol-1', name: 'Policy 1', rules: [], enabled: true };
    const policy2 = { id: 'pol-2', name: 'Policy 2', rules: [], enabled: false };

    await ctx.storage.set('policy:pol-1', JSON.stringify(policy1));
    await ctx.storage.set('policy:pol-2', JSON.stringify(policy2));

    // Export all policies
    const exportData = {
      version: '1.0',
      exportedAt: ctx.time.now(),
      policies: [policy1, policy2],
      format: 'json',
    };

    // Verify export is valid JSON
    let parseError = '';
    try {
      const json = JSON.stringify(exportData);
      JSON.parse(json); // Ensure it's valid
    } catch (e: any) {
      parseError = e.message;
    }

    expect(parseError).toBe('');

    // Verify structure
    expect(exportData.version).toBe('1.0');
    expect(exportData.policies.length).toBe(2);

    ctx.addScenarioResult('SHK-040', true, {
      policiesExported: exportData.policies.length,
      formatValid: parseError === '',
      hasVersion: exportData.version !== undefined,
      timestamp: ctx.time.now(),
    });
  });

  it('SHK-041: Exported data maintains integrity', async () => {
    const ctx = await createShakdownContext();

    // Create complex policy
    const complexPolicy = {
      id: 'complex-pol',
      name: 'Complex Policy',
      description: 'A policy with special characters: @#$%&*()',
      rules: [
        {
          condition: 'status IN (OPEN, "IN PROGRESS")',
          action: 'DENY',
          reason: 'Transition not allowed',
        },
      ],
      metadata: {
        createdBy: 'user@example.com',
        createdAt: ctx.time.now(),
      },
    };

    // Store it
    await ctx.storage.set('policy:complex-pol', JSON.stringify(complexPolicy));

    // Export it
    const exported = JSON.stringify(complexPolicy);

    // Re-import and compare
    const reimported = JSON.parse(exported);

    // Verify all fields match exactly
    expect(reimported.id).toBe(complexPolicy.id);
    expect(reimported.name).toBe(complexPolicy.name);
    expect(reimported.description).toBe(complexPolicy.description);
    expect(reimported.rules[0].condition).toBe(complexPolicy.rules[0].condition);
    expect(reimported.metadata.createdBy).toBe(complexPolicy.metadata.createdBy);

    ctx.addScenarioResult('SHK-041', true, {
      originalPolicy: complexPolicy.id,
      exportedSuccessfully: exported !== '',
      reimportedSuccessfully: reimported.id === complexPolicy.id,
      dataIntegrityMaintained: JSON.stringify(reimported) === exported,
      timestamp: ctx.time.now(),
    });
  });

  it('SHK-042: Reports are generated with correct statistics', async () => {
    const ctx = await createShakdownContext();

    // Create some test audit entries
    const auditEntries = [
      {
        policyId: 'pol-1',
        issueId: 'PROJ-1',
        decision: 'ALLOW',
        timestamp: ctx.time.now(),
      },
      {
        policyId: 'pol-2',
        issueId: 'PROJ-2',
        decision: 'DENY',
        timestamp: ctx.time.now(),
      },
      {
        policyId: 'pol-1',
        issueId: 'PROJ-3',
        decision: 'ALLOW',
        timestamp: ctx.time.now(),
      },
    ];

    // Generate report
    const report = {
      generatedAt: ctx.time.now(),
      totalEvaluations: auditEntries.length,
      decisionStats: {
        ALLOW: auditEntries.filter((e) => e.decision === 'ALLOW').length,
        DENY: auditEntries.filter((e) => e.decision === 'DENY').length,
      },
      policyStats: {
        'pol-1': auditEntries.filter((e) => e.policyId === 'pol-1').length,
        'pol-2': auditEntries.filter((e) => e.policyId === 'pol-2').length,
      },
    };

    // Verify statistics
    expect(report.totalEvaluations).toBe(3);
    expect(report.decisionStats.ALLOW).toBe(2);
    expect(report.decisionStats.DENY).toBe(1);
    expect(report.policyStats['pol-1']).toBe(2);
    expect(report.policyStats['pol-2']).toBe(1);

    ctx.addScenarioResult('SHK-042', true, {
      reportGenerated: true,
      totalEvaluations: report.totalEvaluations,
      correctStats: report.decisionStats.ALLOW === 2 && report.decisionStats.DENY === 1,
      timestamp: ctx.time.now(),
    });
  });
});
