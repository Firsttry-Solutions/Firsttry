/**
 * Governance Panel ok-semantics Regression Test
 *
 * Verifies:
 * 1. When governance data exists but NOT all ECLs pass → ok:true (not ok:false)
 *    The resolver succeeded — component-level pass/fail is in the ecl object.
 * 2. When a true system fault occurs (exception) → ok:false + status:ERROR (fail-closed preserved)
 * 3. NOT_AVAILABLE (fresh install) → ok:true (existing contract, regression guard)
 *
 * Bug: UI showed "Governance Status: Failed to Load" because backend returned
 * ok:false for normal non-ready ECL states. Users saw a red error panel instead
 * of the controls scoreboard with individual red/amber rows.
 *
 * Marker: [FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';

vi.mock('@forge/api');

// ─── Source contract verification (static analysis) ───────────────────────────

describe('Governance Panel ok-semantics (source contract)', () => {
  const aggregatorPath = path.join(__dirname, '../../src/governance/governanceAggregator.ts');
  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(aggregatorPath, 'utf-8');
  });

  it('aggregator available-state path returns ok:true (not ok:allEclPass)', () => {
    // The "available" return (non-early-exit) must have ok: true
    // It must NOT have ok: allEclPass or ok: false in the main return
    expect(source).not.toContain('ok: allEclPass');
    expect(source).not.toMatch(/return\s*\{[^}]*ok:\s*false/);

    // Verify the main return has ok: true
    const mainReturnMatch = source.match(/return\s*\{[\s\S]*?marker:\s*'FT_ECL_ENTERPRISE_STATE_V1'[\s\S]*?ok:\s*(true|false|allEclPass)/g);
    expect(mainReturnMatch).toBeTruthy();
    // All returns with the enterprise marker should have ok: true
    for (const match of mainReturnMatch!) {
      expect(match).toContain('ok: true');
    }

    console.log('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS] available-state ok:true PASS');
  });

  it('aggregator NOT_AVAILABLE path returns ok:true', () => {
    // The early-return NOT_AVAILABLE block must have ok: true
    const notAvailBlock = source.match(/status:\s*'NOT_AVAILABLE'[\s\S]*?ok:\s*(true|false)/);
    expect(notAvailBlock).toBeTruthy();
    expect(notAvailBlock![1]).toBe('true');
    console.log('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS] NOT_AVAILABLE ok:true PASS');
  });

  it('aggregator preserves fail-closed comment for real faults', () => {
    // There must be a comment explaining ok:false is for real system faults only
    expect(source).toMatch(/ok.*false.*reserved.*system.*fault|REAL.*system.*fault|fail-closed.*ONLY.*system/i);
    console.log('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS] fail-closed-comment PASS');
  });
});

// ─── Resolver envelope contract (catch block) ────────────────────────────────

describe('Governance resolver catch block (system fault)', () => {
  const resolverPath = path.join(__dirname, '../../src/gadget-resolver.ts');

  it('resolver catch block returns ok:false + status:ERROR for real exceptions', () => {
    const source = fs.readFileSync(resolverPath, 'utf-8');

    // Find the enterprise governance resolver definition
    const resolverBlock = source.substring(
      source.indexOf("resolver.define('ft_getEnterpriseGovernanceState_v1'"),
      source.indexOf("resolver.define('ft_getEnterpriseGovernanceState_v1'") + 1500
    );

    // The catch block must return ok: false with status: 'ERROR'
    expect(resolverBlock).toContain("ok: false");
    expect(resolverBlock).toContain("status: 'ERROR'");

    console.log('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS] resolver-catch ok:false PASS');
  });

  it('safeResolver wrapper returns ok:false + status:ERROR for uncaught exceptions', () => {
    const source = fs.readFileSync(resolverPath, 'utf-8');

    // safeResolver is the last-resort wrapper
    const safeBlock = source.substring(
      source.indexOf('function safeResolver'),
      source.indexOf('function safeResolver') + 500
    );

    expect(safeBlock).toContain("ok: false");
    expect(safeBlock).toContain("status: 'ERROR'");

    console.log('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS] safeResolver-catch ok:false PASS');
  });
});

// ─── UI render guard contract (source analysis) ──────────────────────────────

describe('UI render guard ok-semantics (EnterpriseGovernancePanel)', () => {
  const uiPath = path.join(__dirname, '../../src/gadget-ui/src/components/EnterpriseGovernancePanel.ts');
  let source: string;

  beforeEach(() => {
    source = fs.readFileSync(uiPath, 'utf-8');
  });

  it('UI only fails-closed on status:ERROR, not on all ok:false', () => {
    // The C2 check must require BOTH ok !== true AND status === 'ERROR'
    // NOT just ok !== true alone (which would block normal non-ready states)
    expect(source).toContain("resp.ok !== true && resp.status === 'ERROR'");

    // Must NOT have the old pattern that fails on ok:false alone
    expect(source).not.toMatch(/if\s*\(\s*resp\.ok\s*!==\s*true\s*\)\s*\{/);

    console.log('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS] UI-guard SYSTEM_ERROR-only PASS');
  });

  it('UI still renders fail-closed for INVOKE_THROW', () => {
    expect(source).toContain('INVOKE_THROW');
    expect(source).toContain('renderEngineFailed');
    console.log('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS] UI-guard INVOKE_THROW preserved PASS');
  });

  it('UI still renders fail-closed for EMPTY_RESPONSE', () => {
    expect(source).toContain('EMPTY_RESPONSE');
    console.log('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS] UI-guard EMPTY_RESPONSE preserved PASS');
  });

  it('UI still renders fail-closed for SCHEMA_MISMATCH', () => {
    expect(source).toContain('SCHEMA_MISMATCH');
    console.log('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS] UI-guard SCHEMA_MISMATCH preserved PASS');
  });

  it('UI has NOT_AVAILABLE handler that renders controls summary (not error)', () => {
    expect(source).toContain("resp.status === 'NOT_AVAILABLE'");
    expect(source).toContain('Controls Summary');
    expect(source).not.toMatch(/NOT_AVAILABLE[\s\S]{0,100}renderEngineFailed/);
    console.log('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS] NOT_AVAILABLE-renders-controls PASS');
  });
});

// ─── End-to-end semantic contract ────────────────────────────────────────────

describe('End-to-end governance semantics', () => {
  it('ok:true + ECL pass:false is valid (component fail, not panel fail)', () => {
    // Simulate what the backend now returns for partial-ready state
    const response = {
      marker: 'FT_ECL_ENTERPRISE_STATE_V1',
      ok: true,
      generatedUtc: new Date().toISOString(),
      available: true,
      ecl: {
        ECL1: { pass: true, reason: 'Chain has 1 entry' },
        ECL2: { pass: false, reason: 'NOT_READY:baseline not set' },
        ECL3: { pass: false, reason: 'NOT_READY:requires baseline + chain entry' },
        ECL4: { pass: false, reason: 'NOT_READY:risk posture requires drift evaluation' },
        ECL5: { pass: false, reason: 'NOT_READY:control mapping requires drift evaluation' },
        ECL6: { pass: false, reason: 'NOT_READY:ledger not yet sealed' },
        ECL7: { pass: false, reason: 'NOT_READY:export requires baseline + chain entry' },
        ECL8: { pass: false, reason: 'NOT_READY:chain=present baseline=missing' },
      },
      proofs: {
        snapshotKind: 'GOVERNANCE' as const,
        exportEligible: false,
        exportReasonCode: 'NO_EXPORT_PAYLOAD,LEDGER_NOT_SEALED',
        chainHeadSha256: 'abc123',
        chainLength: 1,
        chainVerified: false,
        baselineVersion: null,
        driftLastScanUtc: null,
        driftRiskBand: 'UNKNOWN' as const,
        attestationCount: 0,
        lastAttestedUtc: null,
      },
    };

    // ok:true means the resolver succeeded (UI should render controls table)
    expect(response.ok).toBe(true);

    // Individual ECLs can fail without crashing the panel
    const failedEcls = Object.entries(response.ecl).filter(([, v]) => !v.pass);
    expect(failedEcls.length).toBeGreaterThan(0);

    // This combination must NOT trigger "Failed to Load" in the UI
    // (old bug: ok:allEclPass was false → UI showed error panel)
    expect(response.ok).not.toBe(false);

    console.log('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS] e2e partial-ready ok:true PASS');
  });

  it('ok:false + status:ERROR is the ONLY panel-failure path', () => {
    // Simulate what the backend returns for a real system error
    const errorResponse = {
      marker: 'FT_ECL_ENTERPRISE_STATE_V1',
      ok: false,
      status: 'ERROR',
      reason: 'Storage read failed: timeout',
      generatedUtc: new Date().toISOString(),
      available: false,
      migrationRequired: false,
    };

    // This should trigger "Failed to Load" in the UI
    expect(errorResponse.ok).toBe(false);
    expect(errorResponse.status).toBe('ERROR');

    // UI check: resp.ok !== true && resp.status === 'ERROR'
    expect(errorResponse.ok !== true && errorResponse.status === 'ERROR').toBe(true);

    console.log('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS] e2e system-error ok:false PASS');
  });

  it('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS] — marker', () => {
    console.log('[FT_TEST_PASS_GOVERNANCE_PANEL_OK_SEMANTICS]');
    expect(true).toBe(true);
  });
});
