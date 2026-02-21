/**
 * Contract Test: Seed Does NOT Disable Run Access Review (R5) — v7.45
 *
 * Verifies that selecting seed variant keeps Run Access Review enabled
 * while hiding export and seal (which are governance-only).
 * v7.45: Uses effectiveKind='SEED' instead of variant string.
 *
 * PASS marker: [FT_TEST_PASS_UI_SEED_DOES_NOT_DISABLE_RUN_CONTRACT]
 */
import { describe, it, expect } from 'vitest';
import { computeActionModel } from '../src/gadget-ui/src/snapshotActionModel';
import type { ActionModelInput } from '../src/gadget-ui/src/snapshotActionModel';

function seedInput(overrides?: Partial<ActionModelInput>): ActionModelInput {
  return {
    status: 'AVAILABLE',
    selectedVariant: 'seed',
    effectiveKind: 'SEED',
    exportGateOk: false,
    sealed: false,
    buildCoherenceOk: true,
    ...overrides,
  };
}

describe('Seed Does NOT Disable Run Access Review (R5)', () => {
  it('R5: seed + AVAILABLE → runEnabled=true, runVisible=true', () => {
    const model = computeActionModel(seedInput());
    expect(model.runEnabled).toBe(true);
    expect(model.runVisible).toBe(true);
    console.log('[FT_TEST_PASS_UI_SEED_DOES_NOT_DISABLE_RUN_CONTRACT]');
  });

  it('R3: SEED effectiveKind → exportVisible=false regardless of exportGateOk', () => {
    const model = computeActionModel(seedInput({ exportGateOk: true }));
    expect(model.exportVisible).toBe(false);

    const model2 = computeActionModel(seedInput({ exportGateOk: false }));
    expect(model2.exportVisible).toBe(false);
  });

  it('R4: SEED effectiveKind → sealVisible=false', () => {
    const model = computeActionModel(seedInput());
    expect(model.sealVisible).toBe(false);
  });

  it('seed + NOT_AVAILABLE → runEnabled=false (status takes precedence)', () => {
    const model = computeActionModel(seedInput({ status: 'NO_SNAPSHOT' }));
    expect(model.runEnabled).toBe(false);
    expect(model.runVisible).toBe(false);
  });

  it('seed + build incoherent → runEnabled=false but runVisible=true', () => {
    const model = computeActionModel(seedInput({ buildCoherenceOk: false }));
    expect(model.runVisible).toBe(true);
    expect(model.runEnabled).toBe(false);
  });
});
