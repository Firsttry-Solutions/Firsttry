/**
 * Contract Test: Initial Action Model on Mount (R1, R7)
 *
 * Verifies that the action model is computed on initial dashboard load
 * with default selection "Latest" and the [FT_PROOF_UI_ACTION_MODEL_INITIAL]
 * proof marker exists in main.ts source.
 *
 * PASS marker: [FT_TEST_PASS_UI_SNAPSHOT_INITIAL_ACTION_MODEL_CONTRACT]
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { computeActionModel, normalizeSnapshotKind } from '../src/gadget-ui/src/snapshotActionModel';
import type { ActionModelInput } from '../src/gadget-ui/src/snapshotActionModel';

const MAIN_TS_PATH = path.resolve(__dirname, '../src/gadget-ui/src/main.ts');

function defaultLatestInput(overrides?: Partial<ActionModelInput>): ActionModelInput {
  return {
    status: 'AVAILABLE',
    selectedVariant: 'latest',
    sealed: false,
    exportEligible: true,
    hasCanonicalHash: true,
    buildCoherenceOk: true,
    ...overrides,
  };
}

describe('Initial Action Model on Mount', () => {
  it('R1: default selection "latest" produces correct initial model', () => {
    const model = computeActionModel(defaultLatestInput());
    // R2: Run visible + enabled for AVAILABLE
    expect(model.runVisible).toBe(true);
    expect(model.runEnabled).toBe(true);
    // R3: export visible only for governance — latest is NOT governance
    expect(model.exportVisible).toBe(false);
    // R4: seal visible only for governance — latest is NOT governance
    expect(model.sealVisible).toBe(false);

    console.log('[FT_TEST_PASS_UI_SNAPSHOT_INITIAL_ACTION_MODEL_CONTRACT]');
  });

  it('R1: default governance selection shows export when eligible', () => {
    const model = computeActionModel(defaultLatestInput({ selectedVariant: 'governance' }));
    expect(model.runVisible).toBe(true);
    expect(model.runEnabled).toBe(true);
    expect(model.exportVisible).toBe(true);
    expect(model.exportEnabled).toBe(true);
    expect(model.sealVisible).toBe(true);
    expect(model.sealEnabled).toBe(true);
  });

  it('R7: [FT_PROOF_UI_ACTION_MODEL_INITIAL] marker string exists in main.ts source', () => {
    const source = fs.readFileSync(MAIN_TS_PATH, 'utf-8');
    expect(source).toContain('[FT_PROOF_UI_ACTION_MODEL_INITIAL]');
  });

  it('R7: [FT_PROOF_UI_ACTION_MODEL] marker string exists in main.ts source', () => {
    const source = fs.readFileSync(MAIN_TS_PATH, 'utf-8');
    expect(source).toContain('[FT_PROOF_UI_ACTION_MODEL]');
  });

  it('R7: [FT_PROOF_UI_SNAPSHOT_SELECTED] marker string exists in main.ts source', () => {
    const source = fs.readFileSync(MAIN_TS_PATH, 'utf-8');
    expect(source).toContain('[FT_PROOF_UI_SNAPSHOT_SELECTED]');
  });
});
