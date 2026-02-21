/**
 * UI Snapshot Action Model — Contract Tests (v7.42.x)
 *
 * Verifies the pure functions: computeActionModel() and normalizeSnapshotKind()
 * These are the SINGLE SOURCE OF TRUTH for button rendering across all variants.
 */
import { describe, it, expect } from 'vitest';
import { computeActionModel, normalizeSnapshotKind } from '../src/gadget-ui/src/snapshotActionModel';
import type { ActionModelInput, ActionModelOutput, SnapshotKind } from '../src/gadget-ui/src/snapshotActionModel';

// ── normalizeSnapshotKind ───────────────────────────────────────────────────

describe('normalizeSnapshotKind', () => {
  it('maps canonical strings correctly', () => {
    expect(normalizeSnapshotKind('latest')).toBe('latest');
    expect(normalizeSnapshotKind('seed')).toBe('seed');
    expect(normalizeSnapshotKind('governance')).toBe('governance');
  });

  it('is case-insensitive', () => {
    expect(normalizeSnapshotKind('LATEST')).toBe('latest');
    expect(normalizeSnapshotKind('Seed')).toBe('seed');
    expect(normalizeSnapshotKind('GOVERNANCE')).toBe('governance');
  });

  it('returns unknown for null, undefined, empty, or garbage', () => {
    expect(normalizeSnapshotKind(null)).toBe('unknown');
    expect(normalizeSnapshotKind(undefined)).toBe('unknown');
    expect(normalizeSnapshotKind('')).toBe('unknown');
    expect(normalizeSnapshotKind(42)).toBe('unknown');
    expect(normalizeSnapshotKind('foobar')).toBe('unknown');
    expect(normalizeSnapshotKind({})).toBe('unknown');
  });

  it('trims whitespace', () => {
    expect(normalizeSnapshotKind('  latest  ')).toBe('latest');
    expect(normalizeSnapshotKind('\tseed\n')).toBe('seed');
  });
});

// ── computeActionModel ──────────────────────────────────────────────────────

function baseInput(overrides?: Partial<ActionModelInput>): ActionModelInput {
  return {
    status: 'AVAILABLE',
    selectedVariant: 'governance',
    sealed: false,
    exportEligible: true,
    hasCanonicalHash: true,
    buildCoherenceOk: true,
    ...overrides,
  };
}

describe('computeActionModel', () => {
  it('returns all-visible + enabled for governance AVAILABLE + coherent', () => {
    const result = computeActionModel(baseInput());
    expect(result.runVisible).toBe(true);
    expect(result.runEnabled).toBe(true);
    expect(result.sealVisible).toBe(true);
    expect(result.sealEnabled).toBe(true);
    expect(result.exportVisible).toBe(true);
    expect(result.exportEnabled).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('disables everything when buildCoherenceOk is false', () => {
    const result = computeActionModel(baseInput({ buildCoherenceOk: false }));
    expect(result.runVisible).toBe(true);
    expect(result.runEnabled).toBe(false);
    expect(result.sealEnabled).toBe(false);
    expect(result.exportEnabled).toBe(false);
    expect(result.customerMessage).toContain('Update in progress');
    expect(result.reasons).toContain('BUILD_INCOHERENT');
  });

  it('hides everything when status is NOT_AVAILABLE', () => {
    const result = computeActionModel(baseInput({ status: 'NO_SNAPSHOT' }));
    expect(result.runVisible).toBe(false);
    expect(result.runEnabled).toBe(false);
    expect(result.sealVisible).toBe(false);
    expect(result.sealEnabled).toBe(false);
    expect(result.exportVisible).toBe(false);
    expect(result.reasons).toContain('NOT_AVAILABLE');
  });

  it('hides export + seal for seed variant but run stays enabled (R5)', () => {
    const result = computeActionModel(baseInput({ selectedVariant: 'seed' }));
    expect(result.runVisible).toBe(true);
    expect(result.runEnabled).toBe(true);
    expect(result.sealVisible).toBe(false);
    expect(result.exportVisible).toBe(false);
    expect(result.exportEnabled).toBe(false);
    expect(result.reasons).toContain('SEED_NO_EXPORT');
  });

  it('disables run and seal when sealed', () => {
    const result = computeActionModel(baseInput({ sealed: true }));
    expect(result.runEnabled).toBe(false);
    expect(result.sealEnabled).toBe(false);
    expect(result.exportVisible).toBe(true);
    expect(result.exportEnabled).toBe(true);
    expect(result.reasons).toContain('SEALED');
  });

  it('hides export when governance but not eligible', () => {
    const result = computeActionModel(baseInput({ exportEligible: false }));
    expect(result.exportVisible).toBe(false);
    expect(result.exportEnabled).toBe(false);
    expect(result.reasons).toContain('NOT_EXPORT_ELIGIBLE');
  });

  it('shows export but disabled when hash is missing', () => {
    const result = computeActionModel(baseInput({ hasCanonicalHash: false }));
    expect(result.exportVisible).toBe(true);
    expect(result.exportEnabled).toBe(false);
    expect(result.customerMessage).toContain('run an access review');
    expect(result.reasons).toContain('MISSING_HASH');
  });

  it('handles HARD_ERROR status like NOT_AVAILABLE', () => {
    const result = computeActionModel(baseInput({ status: 'HARD_ERROR' }));
    expect(result.runVisible).toBe(false);
    expect(result.runEnabled).toBe(false);
    expect(result.sealVisible).toBe(false);
    expect(result.exportVisible).toBe(false);
    expect(result.reasons).toContain('NOT_AVAILABLE');
  });

  it('latest variant: run visible, seal hidden, export hidden', () => {
    const result = computeActionModel(baseInput({ selectedVariant: 'latest' }));
    expect(result.runVisible).toBe(true);
    expect(result.runEnabled).toBe(true);
    expect(result.sealVisible).toBe(false);
    expect(result.sealEnabled).toBe(false);
    expect(result.exportVisible).toBe(false);
  });
});
